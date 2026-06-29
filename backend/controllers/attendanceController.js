const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const School = require('../models/School');
const { sendSMS } = require('../utils/sms');
const { notifyParentUsers, notifyStudentUsers } = require('../utils/notify');
const { notifyStudentParents } = require('../services/notificationService');
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
    const absentIds = [];
    for (const rec of records) {
      if (!rec.student) continue;
      const student = await Student.findById(rec.student).select('name');
      if (!student) continue;
      const tmpl = ATT_MSG[rec.status] || ATT_MSG.present;
      const { title: ntitle, msg: nmsg, type: ntype } = tmpl(student.name);
      // Student portal gets the per-status in-app alert for every status.
      notifyStudentUsers(schoolId, [rec.student], 'notifyOnAttendance', ntitle, nmsg, ntype);
      if (rec.status === 'absent') {
        absentIds.push(rec.student);   // handled below: parent in-app + push
      } else {
        notifyParentUsers(schoolId, [rec.student], 'notifyOnAttendance', ntitle, nmsg, ntype);
      }
    }

    // Absent → notify the parent(s): saves an in-app "Attendance Alert" AND sends
    // a Firebase push to their registered device(s). Reusable service.
    if (absentIds.length) {
      notifyStudentParents({
        schoolId,
        studentIds: absentIds,
        permKey: 'notifyOnAttendance',
        title: 'Attendance Alert',
        body: 'Your child was marked Absent today.',
        type: 'error',
        data: { kind: 'attendance', status: 'absent', date: new Date(date).toISOString() },
      });
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
    const { studentId, month, year, classId, academicYear } = req.query;
    const schoolId = req.user.school;

    const schoolDoc = await School.findById(schoolId).select('workingDays academicYear');
    const swd = schoolDoc?.workingDays || {};

    // Resolve the Saturday schedule from the explicit class, else the student's class.
    let satSchedule = 'school_default';
    let resolvedClassId = classId;
    if (!resolvedClassId && studentId) {
      const stu = await Student.findById(studentId).select('currentClass');
      resolvedClassId = stu?.currentClass?.toString();
    }
    if (resolvedClassId) {
      const classDoc = await Class.findById(resolvedClassId).select('saturdaySchedule');
      satSchedule = classDoc?.saturdaySchedule || 'school_default';
    }

    const now = new Date();
    const curY = now.getFullYear(), curM = now.getMonth() + 1;

    // Determine the attendance window and the set of months whose calendar
    // working days form the denominator. With an explicit month/year we use
    // that month; otherwise we span the active academic year up to the
    // current month. Each month contributes its FULL working-day count so the
    // total matches the Attendance/calendar module exactly.
    let dateFilter = null;
    const monthsToCount = [];
    if (month && year) {
      const y = Number(year), m = Number(month);
      dateFilter = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
      monthsToCount.push({ y, m });
    } else {
      const startMonth = schoolDoc?.academicYear?.startMonth || 6;
      const endMonth = schoolDoc?.academicYear?.endMonth || 3;
      // If a specific academicYear string is passed (e.g. "2026-2027"), derive its
      // start/end calendar years from that string rather than from today's date.
      // This ensures switching to a past or future year in the header shows the
      // correct attendance window (or 0/0 for a fully-future year).
      let ayStartYear, ayEndYear;
      if (academicYear) {
        ayStartYear = parseInt(academicYear); // "2026-2027" → 2026, "2026" → 2026
        ayEndYear = endMonth < startMonth ? ayStartYear + 1 : ayStartYear;
      } else {
        ayStartYear = curM >= startMonth ? curY : curY - 1;
        ayEndYear = endMonth < startMonth ? ayStartYear + 1 : ayStartYear;
      }
      const startIdx = ayStartYear * 12 + (startMonth - 1);
      const ayEndIdx = ayEndYear * 12 + (endMonth - 1);
      const todayIdx = curY * 12 + (curM - 1);
      // Cap at today so future months don't inflate the denominator.
      const lastIdx = Math.min(todayIdx, ayEndIdx);
      dateFilter = { $gte: new Date(ayStartYear, startMonth - 1, 1), $lte: new Date(ayEndYear, endMonth, 0) };
      for (let idx = startIdx; idx <= lastIdx; idx++) {
        monthsToCount.push({ y: Math.floor(idx / 12), m: (idx % 12) + 1 });
      }
    }

    const query = { school: schoolId, type: 'student', 'records.student': studentId };
    if (dateFilter) query.date = dateFilter;
    if (classId) query.class = classId;
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

    // Total days = calendar working days (from the calendar/holidays module),
    // not just the days that happen to have been marked.
    let workingDays = 0;
    for (const { y, m } of monthsToCount) {
      const r = await getWorkingDaysForMonth(schoolId, y, m, swd, satSchedule);
      workingDays += r.workingDays;
    }

    const total = workingDays;
    let percentage = workingDays
      ? Math.round(((present + half_day * 0.5) / workingDays) * 100)
      : 0;
    if (percentage > 100) percentage = 100;
    res.json({ success: true, summary: { present, absent, late, half_day, total, workingDays, percentage } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markStudentAttendance, markEmployeeAttendance, getAttendance, getStudentAttendanceSummary, getWorkingDaysForMonth };
