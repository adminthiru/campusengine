const Timetable = require('../models/Timetable');
const Employee = require('../models/Employee');
const Class = require('../models/Class');
const School = require('../models/School');
const { sendSMS } = require('../utils/sms');
const Student = require('../models/Student');

// Check for teacher double-booking conflicts across other classes
const checkConflicts = async (schoolId, excludeClassId, academicYear, day, period, teacher) => {
  const conflicts = [];
  if (!teacher) return conflicts;

  // Only check other classes — the current class's old data is being replaced
  const otherTimetables = await Timetable.find({
    school: schoolId, academicYear, isActive: true,
    class: { $ne: excludeClassId }
  });

  for (const tt of otherTimetables) {
    const daySchedule = tt.schedule.find(s => s.day === day);
    if (!daySchedule) continue;
    const slot = daySchedule.periods.find(p => p.periodNumber === period && !p.isBreak);
    if (slot && slot.teacher?.toString() === teacher.toString()) {
      const cls = await Class.findById(tt.class).select('name section');
      conflicts.push({
        type: 'teacher',
        message: `Teacher is already assigned to ${cls?.name} ${cls?.section} on ${day} Period ${period}`
      });
    }
  }

  return conflicts;
};

// Get free slots for a teacher
const getTeacherFreeSlots = async (req, res) => {
  try {
    const { teacherId, academicYear } = req.query;
    const school = await School.findById(req.user.school);
    const allTimetables = await Timetable.find({ school: req.user.school, academicYear, isActive: true });

    const days = Object.keys(school.workingDays).filter(d => school.workingDays[d]);
    const busySlots = {};

    for (const tt of allTimetables) {
      for (const daySchedule of tt.schedule) {
        for (const period of daySchedule.periods) {
          if (period.teacher?.toString() === teacherId) {
            const key = `${daySchedule.day}_${period.periodNumber}`;
            busySlots[key] = true;
          }
        }
      }
    }

    const freeSlots = [];
    for (const day of days) {
      for (let p = 1; p <= school.periodsPerDay; p++) {
        if (!busySlots[`${day}_${p}`]) {
          freeSlots.push({ day, period: p });
        }
      }
    }

    res.json({ success: true, freeSlots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create/update timetable
const saveTimetable = async (req, res) => {
  try {
    const { classId, academicYear, term, schedule } = req.body;
    const schoolId = req.user.school;

    // Validate all periods for conflicts
    for (const daySchedule of schedule) {
      for (const period of daySchedule.periods) {
        if (!period.isBreak && period.teacher) {
          const conflicts = await checkConflicts(
            schoolId, classId, academicYear,
            daySchedule.day, period.periodNumber, period.teacher
          );
          if (conflicts.length > 0) {
            return res.status(400).json({ success: false, message: conflicts[0].message, conflicts });
          }
        }
      }
    }

    const timetable = await Timetable.findOneAndUpdate(
      { school: schoolId, class: classId, academicYear },
      { school: schoolId, class: classId, academicYear, term, schedule, isActive: true },
      { upsert: true, returnDocument: 'after' }
    ).populate('class', 'name section')
     .populate('schedule.periods.subject', 'name code color')
     .populate('schedule.periods.teacher', 'name');

    // Send SMS to class students
    const students = await Student.find({ school: schoolId, currentClass: classId, status: 'active' })
      .populate('guardians', 'phone language');
    const school = await School.findById(schoolId);
    const cls = await Class.findById(classId);

    for (const student of students.slice(0, 50)) { // limit SMS
      for (const guardian of student.guardians) {
        if (guardian.phone) {
          const days = schedule.map(d => d.day).join(', ');
          await sendSMS(schoolId, guardian.phone, 'timetable',
            [`${cls.name} ${cls.section}`, 'this week'],
            guardian.language || school.language, { student: student._id, parent: guardian._id }
          );
          break; // one SMS per student
        }
      }
    }

    res.json({ success: true, timetable });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get timetable
const getTimetable = async (req, res) => {
  try {
    const { classId, teacherId, academicYear } = req.query;
    let timetable;

    if (teacherId) {
      // Get all classes where this teacher is assigned
      const ttQuery = { school: req.user.school, isActive: true };
      if (academicYear) ttQuery.academicYear = academicYear;
      const allTT = await Timetable.find(ttQuery)
        .populate('class', 'name section')
        .populate('schedule.periods.subject', 'name color')
        .populate('schedule.periods.teacher', 'name');

      const teacherTT = allTT.map(tt => {
        const ttObj = tt.toObject();
        return {
          ...ttObj,
          schedule: ttObj.schedule.map(d => {
            // Teaching-period ordinal: breaks don't consume a period number, so
            // P1, P2, break, P3, P4… — matches the admin timetable's labelling.
            const ordinalByPeriod = {};
            let n = 0;
            [...d.periods].sort((a, b) => a.periodNumber - b.periodNumber)
              .forEach(p => { if (!p.isBreak) ordinalByPeriod[p.periodNumber] = ++n; });
            return {
              ...d,
              periods: d.periods
                .filter(p => p.teacher?._id?.toString() === teacherId || p.teacher?.toString() === teacherId)
                .map(p => ({ ...p, displayPeriod: ordinalByPeriod[p.periodNumber] || p.periodNumber }))
            };
          }).filter(d => d.periods.length > 0)
        };
      }).filter(tt => tt.schedule.length > 0);

      return res.json({ success: true, timetables: teacherTT });
    }

    const query = { school: req.user.school, class: classId, isActive: true };
    if (academicYear) query.academicYear = academicYear;
    timetable = await Timetable.findOne(query).sort({ createdAt: -1 })
      .populate('class', 'name section')
      .populate('schedule.periods.subject', 'name code color')
      .populate('schedule.periods.teacher', 'name photo');

    res.json({ success: true, timetable });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete timetable period
const deletePeriod = async (req, res) => {
  try {
    const { timetableId, day, periodNumber } = req.body;
    const timetable = await Timetable.findOne({ _id: timetableId, school: req.user.school });
    if (!timetable) return res.status(404).json({ success: false, message: 'Not found' });

    const daySchedule = timetable.schedule.find(s => s.day === day);
    if (daySchedule) {
      daySchedule.periods = daySchedule.periods.filter(p => p.periodNumber !== periodNumber);
    }
    await timetable.save();
    res.json({ success: true, message: 'Period removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get free teachers for every period on a given day (for substitution planning)
const getDaySubstitutes = async (req, res) => {
  try {
    const { day, academicYear } = req.query;
    const schoolId = req.user.school;
    const school = await School.findById(schoolId);

    const allTT = await Timetable.find({ school: schoolId, academicYear, isActive: true });

    const busyByPeriod = {};
    for (const tt of allTT) {
      const daySchedule = tt.schedule.find(s => s.day === day);
      if (!daySchedule) continue;
      for (const period of daySchedule.periods) {
        if (period.teacher && !period.isBreak) {
          if (!busyByPeriod[period.periodNumber]) busyByPeriod[period.periodNumber] = new Set();
          busyByPeriod[period.periodNumber].add(period.teacher.toString());
        }
      }
    }

    const allTeachers = await Employee.find({ school: schoolId, role: 'teacher', status: 'active' })
      .select('name photo designation department');

    const substitutes = {};
    const periods = school.periodsPerDay || 8;
    for (let p = 1; p <= periods; p++) {
      const busy = busyByPeriod[p] || new Set();
      substitutes[p] = allTeachers.filter(t => !busy.has(t._id.toString()));
    }

    res.json({ success: true, substitutes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Busy-slot map for live (client-side) conflict detection: which teacher is
// already assigned in OTHER classes, keyed "teacherId_day_period".
const getTeacherBusy = async (req, res) => {
  try {
    const { academicYear, excludeClassId } = req.query;
    const query = { school: req.user.school, isActive: true };
    if (academicYear) query.academicYear = academicYear;
    if (excludeClassId) query.class = { $ne: excludeClassId };
    const tts = await Timetable.find(query).populate('class', 'name section');
    const busy = {};
    for (const tt of tts) {
      const label = `${tt.class?.name || ''}${tt.class?.section ? ' ' + tt.class.section : ''}`.trim();
      for (const ds of tt.schedule) {
        for (const p of ds.periods) {
          if (p.isBreak || !p.teacher) continue;
          busy[`${p.teacher}_${ds.day}_${p.periodNumber}`] = label || 'another class';
        }
      }
    }
    res.json({ success: true, busy });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { saveTimetable, getTimetable, getTeacherFreeSlots, deletePeriod, getDaySubstitutes, getTeacherBusy };
