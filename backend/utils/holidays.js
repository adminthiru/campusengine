const SchoolCalendar = require('../models/SchoolCalendar');

/**
 * Returns a Set of 'YYYY-MM-DD' date strings for every holiday in the given month.
 * Handles single-day and multi-day holiday entries.
 */
async function getHolidaysForMonth(schoolId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  const entries = await SchoolCalendar.find({
    school: schoolId,
    type: 'holiday',
    $or: [
      { date: { $gte: start, $lte: end } },
      { endDate: { $gte: start, $lte: end } },
      { date: { $lte: start }, endDate: { $gte: end } },
    ],
  });

  const days = new Set();
  entries.forEach(h => {
    const from = new Date(h.date);
    const to   = h.endDate ? new Date(h.endDate) : new Date(h.date);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        days.add(d.toISOString().slice(0, 10));
      }
    }
  });
  return days;
}

/**
 * Returns true if the given Saturday is a working day for this class.
 * weekNum = 1-based week of month (1st Sat, 2nd Sat, etc.)
 */
function isSaturdayWorking(saturdaySchedule, date, schoolDefault) {
  const schedule = saturdaySchedule || 'school_default';
  if (schedule === 'all_working')  return true;
  if (schedule === 'all_holiday')  return false;

  const d = new Date(date);
  const weekNum = Math.ceil(d.getDate() / 7); // 1–5

  if (schedule === 'alternate')    return weekNum % 2 === 1; // 1st & 3rd working
  if (schedule === 'one_in_three') return weekNum % 3 === 1; // 1st of every 3 working

  return schoolDefault; // 'school_default'
}

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

/**
 * Returns the number of actual working days in a month, minus holidays and
 * non-working weekdays as configured for the school/class.
 *
 * @param {ObjectId} schoolId
 * @param {number}   year
 * @param {number}   month  (1–12)
 * @param {object}   schoolWorkingDays  — school.workingDays from School model
 * @param {string}   saturdaySchedule  — class-level override (optional)
 * @returns {{ workingDays: number, holidayCount: number, weekendCount: number }}
 */
async function getWorkingDaysForMonth(schoolId, year, month, schoolWorkingDays = {}, saturdaySchedule = 'school_default', upToDay = null) {
  const holidays   = await getHolidaysForMonth(schoolId, year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  // upToDay caps the count at a given day (e.g. "today" for the current month)
  // so an in-progress month doesn't count its not-yet-arrived working days.
  const lastDay = (upToDay && upToDay < daysInMonth) ? upToDay : daysInMonth;

  // Default to Mon–Fri if not configured
  const wd = {
    monday:    schoolWorkingDays.monday    ?? true,
    tuesday:   schoolWorkingDays.tuesday   ?? true,
    wednesday: schoolWorkingDays.wednesday ?? true,
    thursday:  schoolWorkingDays.thursday  ?? true,
    friday:    schoolWorkingDays.friday    ?? true,
    saturday:  schoolWorkingDays.saturday  ?? false,
    sunday:    schoolWorkingDays.sunday    ?? false,
  };

  let workingDays = 0, weekendCount = 0;

  for (let day = 1; day <= lastDay; day++) {
    const d       = new Date(year, month - 1, day);
    const dayName = DAY_NAMES[d.getDay()];
    const dateStr = d.toISOString().slice(0, 10);

    if (holidays.has(dateStr)) continue; // holiday — not working

    let isWorking = wd[dayName] ?? false;

    // Override Saturday based on class schedule
    if (d.getDay() === 6) {
      isWorking = isSaturdayWorking(saturdaySchedule, d, wd.saturday);
    }

    if (isWorking) workingDays++;
    else weekendCount++;
  }

  return { workingDays, holidayCount: holidays.size, weekendCount };
}

module.exports = { getHolidaysForMonth, isSaturdayWorking, getWorkingDaysForMonth };
