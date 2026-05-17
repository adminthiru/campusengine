const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const { sendSMS } = require('../utils/sms');

// Mark student attendance
const markStudentAttendance = async (req, res) => {
  try {
    const { classId, date, period, subjectId, records } = req.body;
    const schoolId = req.user.school;

    // Check if already marked
    const existing = await Attendance.findOne({
      school: schoolId, class: classId, date: new Date(date),
      period, type: 'student'
    });
    if (existing) {
      // Update
      existing.records = records;
      existing.markedBy = req.user._id;
      await existing.save();
    } else {
      await Attendance.create({
        school: schoolId, type: 'student', date: new Date(date),
        class: classId, subject: subjectId, period,
        markedBy: req.user._id, records
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
                [student.name, dateStr, period], lang,
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

    res.json({ success: true, message: 'Attendance marked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Mark employee attendance
const markEmployeeAttendance = async (req, res) => {
  try {
    const { date, records } = req.body;
    const schoolId = req.user.school;

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
    res.json({ success: true, message: 'Attendance marked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get attendance
const getAttendance = async (req, res) => {
  try {
    const { type, classId, date, month, year, employeeId, studentId } = req.query;
    const query = { school: req.user.school };
    if (type) query.type = type;
    if (classId) query.class = classId;
    if (date) query.date = new Date(date);
    if (month && year) {
      query.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1)
      };
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

// Get student attendance summary
const getStudentAttendanceSummary = async (req, res) => {
  try {
    const { studentId, month, year } = req.query;
    const query = { school: req.user.school, type: 'student', 'records.student': studentId };
    if (month && year) {
      query.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
    }
    const records = await Attendance.find(query);
    let present = 0, absent = 0, late = 0;
    records.forEach(a => {
      const rec = a.records.find(r => r.student?.toString() === studentId);
      if (rec) {
        if (rec.status === 'present') present++;
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'late') late++;
      }
    });
    const total = present + absent + late;
    res.json({ success: true, summary: { present, absent, late, total, percentage: total ? Math.round((present / total) * 100) : 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markStudentAttendance, markEmployeeAttendance, getAttendance, getStudentAttendanceSummary };
