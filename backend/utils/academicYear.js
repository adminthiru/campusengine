// Single source of truth for academic-year computation on the backend.
// An academic year is defined by a configurable start month and end month.
// When the end month is earlier than the start month (e.g. Apr → Mar) the year
// spans two calendar years and is labelled "2026-2027"; otherwise it stays
// within one calendar year and is labelled "2026".

function academicYearForDate(date, startMonth = 6, endMonth = 3) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1, y = d.getFullYear();
  const spansTwo = endMonth < startMonth;
  const startCalYear = m >= startMonth ? y : y - 1;
  return spansTwo ? `${startCalYear}-${startCalYear + 1}` : `${startCalYear}`;
}

// Re-derive the stored academicYear of a school's records from each record's
// own date under the given boundary. Used when the boundary changes so existing
// data stays aligned with the configured academic year. Returns a count summary.
async function retagAcademicYears(schoolId, startMonth, endMonth) {
  const { Exam, ExamResult } = require('../models/Exam');
  const FeeCollection = require('../models/FeeCollection');
  const Timetable = require('../models/Timetable');
  const summary = { fees: 0, exams: 0, examResults: 0, timetables: 0 };

  // Fees: anchored to when the fee record was created (the year it was raised).
  const fees = await FeeCollection.find({ school: schoolId }).select('createdAt academicYear');
  for (const f of fees) {
    const ay = academicYearForDate(f.createdAt, startMonth, endMonth);
    if (ay && ay !== f.academicYear) {
      await FeeCollection.updateOne({ _id: f._id }, { $set: { academicYear: ay } });
      summary.fees++;
    }
  }

  // Exams: anchored to the exam date (falls back to creation date).
  const exams = await Exam.find({ school: schoolId }).select('examDate createdAt academicYear');
  for (const e of exams) {
    const ay = academicYearForDate(e.examDate || e.createdAt, startMonth, endMonth);
    if (ay && ay !== e.academicYear) {
      await Exam.updateOne({ _id: e._id }, { $set: { academicYear: ay } });
      summary.exams++;
    }
    // Keep this exam's results aligned with the exam itself.
    if (ay) {
      const r = await ExamResult.updateMany(
        { school: schoolId, exam: e._id, academicYear: { $ne: ay } },
        { $set: { academicYear: ay } }
      );
      summary.examResults += r.modifiedCount || 0;
    }
  }

  // Timetables: anchored to when the timetable was set up.
  const timetables = await Timetable.find({ school: schoolId }).select('createdAt academicYear');
  for (const t of timetables) {
    const ay = academicYearForDate(t.createdAt, startMonth, endMonth);
    if (ay && ay !== t.academicYear) {
      await Timetable.updateOne({ _id: t._id }, { $set: { academicYear: ay } });
      summary.timetables++;
    }
  }

  return summary;
}

module.exports = { academicYearForDate, retagAcademicYears };
