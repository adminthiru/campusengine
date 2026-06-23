const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const School = require('../models/School');
const { sendSMS } = require('../utils/sms');
const { notifyParentUsers, notifyStudentUsers } = require('../utils/notify');
const { getHolidaysForMonth, isSaturdayWorking, getWorkingDaysForMonth } = require('../utils/holidays');

// Mark student attendance
const markStudentAttendance = async (req, res) => {
  try {
    const { classId, date, records } = req.body;
    const schoolId = req.user.school;

    // Check if this date is a holiday or a Saturday holiday for the class
    const dateObj = new Date(date);
    const year  = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const holidays = await getHolidaysForMonth(schoolId, year, month);
    const dateStr   = dateObj.toISOString().slice(0, 10);
    const isHoliday = holidays.has(dateStr);

    let isSaturdayHoliday = false;
    if (!isHoliday && dateObj.getDay() === 6 && classId) {
      const classDoc = await Class.findById(classId).select('saturdaySchedule');
      const school   = await School.findById(schoolId).select('workingDays');
      const schoolSatDefault = school?.workingDays?.saturday ?? false;
      isSaturdayHoliday = !isSaturdayWorking(classDoc?.saturdaySchedule, dateObj, schoolSatDefault);
    }

    // Check if already marked (one record per class per day)
    const existing = await Attendance.findOne({
      school: schoolId, class: classId, date: new Date(date), type: 'student'
    });
    if (existing) {
      existing.records = records;
      existing.markedBy = req.user._id;
      await existing.save();
    } else {
      await Attendance.create({
        school: schoolId, type: 'student', date: new Date(date),
        class: classId, markedBy: req.user._id, records
      });
    }

    // Send SMS for absent students & check consecutive absences
    for (const rec of records) {
      if (rec.status === 'absent' && rec.student) {
        const student = await Student.findById(rec.student).populate('guardians');
        if (student) {
          const dateStr = new Date(date).toLocaleDateString('en-IN');
          for (const guardian of student.guardians) {
            if (guardian.phone && !rec.smsSent) {
              const lang = guardian.language || 'en';
              await sendSMS(schoolId, guardian.phone, 'absent',
                [student.name, dateStr], lang,
                { student: student._id, parent: guardian._id }
              );
            }
          }

          // Check consecutive absences
          const recentAbsences = await Attendance.find({
            school: schoolId, type: 'student', class: classId,
            'records.student': student._id, 'records.status': 'absent',
            date: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
          });
          if (recentAbsences.length >= 3) {
            for (const guardian of student.guardians) {
              if (guardian.phone) {
                await sendSMS(schoolId, guardian.phone, 'consecutive_absent',
                  [student.name, recentAbsences.length], guardian.language || 'en',
                  { student: student._id, parent: guardian._id }
                );
              }
            }
          }
        }
      }
    }

    // In-app notifications for parents (fire-and-forget)
    const dateLabel = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const ATT_MSG = {
      present:  (name) => ({ title: `${name} is Present`, msg: `Your child ${name} was marked present on ${dateLabel}.`, type: 'success' }),
      absent:   (name) => ({ title: `${name} is Absent`,  msg: `Your child ${name} was marked absent on ${dateLabel}.`,  type: 'error'   }),
      late:     (name) => ({ title: `${name} Arrived Late`, msg: `Your child ${name} arrived late on ${dateLabel}.`,     type: 'warning' }),
      excused:  (name) => ({ title: `${name} - Excused`,  msg: `Your child ${name} was marked excused on ${dateLabel}.`, type: 'info'    }),
      half_day: (name) => ({ title: `${name} - Half Day`, msg: `Your child ${name} was marked half-day on ${dateLabel}.`, type: 'warning' }),
    };
    for (const rec of records) {
      if (!rec.student) continue;
      const student = await Student.findById(rec.student).select('name');
      if (!student) continue;
      const tmpl = ATT_MSG[rec.status] || ATT_MSG.present;
      const { title: ntitle, msg: nmsg, type: ntype } = tmpl(student.name);
      notifyParentUsers(schoolId, [rec.student], 'notifyOnAttendance', ntitle, nmsg, ntype);
      notifyStudentUsers(schoolId, [rec.student], 'notifyOnAttendance', ntitle, nmsg, ntype);
    }

    res.json({
      success: true,
      message: 'Attendance marked',
      isHoliday,
      isSaturdayHoliday,
      holidayWarning: isHoliday
        ? 'This date is marked as a school holiday. Attendance saved but will not affect salary LOP.'
        : isSaturdayHoliday
        ? 'This Saturday is a holiday for this class based on the Saturday schedule.'
        : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Mark employee attendance
const markEmployeeAttendance = async (req, res) => {
  try {
    const { date, records } = req.body;
    const schoolId = req.user.school;

    // Holiday check
    const dateObj = new Date(date);
    const holidays = await getHolidaysForMonth(schoolId, dateObj.getFullYear(), dateObj.getMonth() + 1);
    const isHoliday = holidays.has(dateObj.toISOString().slice(0, 10));

    const existing = await Attendance.findOne({
      school: schoolId, type: 'employee',
      date: new Date(date)
    });
    if (existing) {
      existing.records = records;
      existing.markedBy = req.user._id;
      await existing.save();
    } else {
      await Attendance.create({
        school: schoolId, type: 'employee',
        date: new Date(date), markedBy: req.user._id, records
      });
    }
    res.json({
      success: true,
      message: 'Attendance marked',
      isHoliday,
      holidayWarning: isHoliday
        ? 'This date is marked as a school holiday. Attendance saved but will not affect salary LOP.'
        : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get attendance
const getAttendance = async (req, res) => {
  try {
    const { type, classId, date, month, year, employeeId, studentId, startDate, endDate } = req.query;
    const query = { school: req.user.school };
    if (type) query.type = type;
    // Employee attendance carries no class — ignore classId for it so a stale
    // class filter can't hide the records.
    if (classId && type !== 'employee') query.class = classId;
    if (date) query.date = new Date(date);
    if (month && year) {
      query.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1)
      };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.date.$lte = e; }
    }

    const attendance = await Attendance.find(query)
      .populate('class', 'name section')
      .populate('subject', 'name')
      .populate('markedBy', 'name')
      .populate('records.student', 'name admissionNumber rollNumber')
      .populate('records.employee', 'name employeeId')
      .sort({ date: -1 });

    res.json({ success: true, attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get student attendance summary (includes working days)
const getStudentAttendanceSummary = async (req, res) => {
  try {
    const { studentId, month, year, classId } = req.query;
    const schoolId = req.user.school;
    const query = { school: schoolId, type: 'student', 'records.student': studentId };
    if (month && year) {
      query.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
    }
    const records = await Attendance.find(query);
    let present = 0, absent = 0, late = 0, half_day = 0;
    records.forEach(a => {
      const rec = a.records.find(r => r.student?.toString() === studentId);
      if (rec) {
        if (rec.status === 'present')  present++;
        else if (rec.status === 'absent')   absent++;
        else if (rec.status === 'late')     late++;
        else if (rec.status === 'half_day') half_day++;
      }
    });

    // Calculate actual working days for the month
    let workingDays = null;
    if (month && year) {
      const schoolDoc = await School.findById(schoolId).select('workingDays');
      let satSchedule = 'school_default';
      if (classId) {
        const classDoc = await Class.findById(classId).select('saturdaySchedule');
        satSchedule = classDoc?.saturdaySchedule || 'school_default';
      }
      const result = await getWorkingDaysForMonth(schoolId, Number(year), Number(month), schoolDoc?.workingDays || {}, satSchedule);
      workingDays = result.workingDays;
    }

    const total = present + absent + late + half_day;
    const percentage = workingDays ? Math.round(((present + half_day * 0.5) / workingDays) * 100) : (total ? Math.round((present / total) * 100) : 0);
    res.json({ success: true, summary: { present, absent, late, half_day, total, workingDays, percentage } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markStudentAttendance, markEmployeeAttendance, getAttendance, getStudentAttendanceSummary, getWorkingDaysForMonth };
