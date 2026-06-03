const StaffCheckin = require('../models/StaffCheckin');
const Attendance   = require('../models/Attendance');
const School       = require('../models/School');

// ── Helpers ──────────────────────────────────────────────────────────────────
const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const buildPunch = (body) => ({
  time:     new Date(),
  lat:      body.lat      != null ? Number(body.lat)      : undefined,
  lng:      body.lng      != null ? Number(body.lng)      : undefined,
  accuracy: body.accuracy != null ? Number(body.accuracy) : undefined,
  address:  body.address  || undefined,
});

// Convert "HH:MM" string to total minutes since midnight
const toMinutes = (timeStr = '00:00') => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Format a minute-offset into "Xh Ym" label
const formatLate = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Derive attendance status from check-in time and school timing config
const resolveStatus = (timing = {}) => {
  const onTimeByMin    = toMinutes(timing.onTimeBy    || '10:00');
  const lateFromMin    = toMinutes(timing.lateFrom    || '11:00');
  const halfDayFromMin = toMinutes(timing.halfDayFrom || '12:30');

  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  if (nowMins > halfDayFromMin) {
    const late = nowMins - onTimeByMin;
    return { status: 'half_day', remarks: `Half day – arrived ${formatLate(late)} late` };
  }
  if (nowMins > lateFromMin) {
    const late = nowMins - onTimeByMin;
    return { status: 'late', remarks: `Late by ${formatLate(late)}` };
  }
  return { status: 'present', remarks: '' };
};

// Auto-create/update the Attendance record for this employee on today
const autoMarkAttendance = async ({ schoolId, employeeId, userId, status, remarks }) => {
  try {
    const today = startOfDay();
    const existing = await Attendance.findOne({ school: schoolId, type: 'employee', date: today });

    if (existing) {
      const idx = existing.records.findIndex(
        r => String(r.employee) === String(employeeId)
      );
      if (idx === -1) {
        existing.records.push({ employee: employeeId, status, remarks });
      } else {
        // Only overwrite if admin hasn't manually changed it to absent/od/cl/sl
        const cur = existing.records[idx].status;
        if (['present', 'late', 'half_day'].includes(cur)) {
          existing.records[idx].status  = status;
          existing.records[idx].remarks = remarks;
        }
      }
      await existing.save();
    } else {
      await Attendance.create({
        school: schoolId, type: 'employee', date: today,
        markedBy: userId,
        records: [{ employee: employeeId, status, remarks }],
      });
    }
  } catch (e) {
    // Non-fatal — checkin still succeeds even if attendance write fails
    console.error('autoMarkAttendance error:', e.message);
  }
};

// Format "HH:MM" to "10:00 AM" style
const formatAmPm = (timeStr = '') => {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

// ── Teacher / staff: check in ─────────────────────────────────────────────────
const checkIn = async (req, res) => {
  try {
    const schoolId   = req.user.school;
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No employee profile linked to this account' });
    }

    // Enforce check-in window: only between onTimeBy and schoolEndTime
    const school   = await School.findById(schoolId).select('staffAttendanceTiming');
    const timing   = school?.staffAttendanceTiming || {};
    const startMin = toMinutes(timing.onTimeBy    || '10:00');
    const endMin   = toMinutes(timing.schoolEndTime || '16:00');
    const now      = new Date();
    const nowMins  = now.getHours() * 60 + now.getMinutes();

    if (nowMins < startMin) {
      const startLabel = formatAmPm(timing.onTimeBy || '10:00');
      return res.status(400).json({
        success: false,
        code: 'TOO_EARLY',
        message: `School starts by ${startLabel}. You can check in after that.`,
      });
    }
    if (nowMins >= endMin) {
      const endLabel   = formatAmPm(timing.schoolEndTime || '16:00');
      const startLabel = formatAmPm(timing.onTimeBy      || '10:00');
      return res.status(400).json({
        success: false,
        code: 'TOO_LATE',
        message: `School is finished by ${endLabel}. You can check in tomorrow by ${startLabel} only.`,
      });
    }

    const date = startOfDay();
    let record = await StaffCheckin.findOne({ school: schoolId, employee: employeeId, date });

    if (record?.checkIn?.time) {
      return res.status(400).json({ success: false, message: 'Already checked in today', record });
    }

    const punch = buildPunch(req.body);
    if (!record) {
      record = await StaffCheckin.create({
        school: schoolId, employee: employeeId, user: req.user._id, date, checkIn: punch,
      });
    } else {
      record.checkIn = punch;
      record.user    = req.user._id;
      await record.save();
    }

    const { status, remarks } = resolveStatus(timing);
    await autoMarkAttendance({ schoolId, employeeId, userId: req.user._id, status, remarks });

    res.json({ success: true, message: 'Checked in', record, attendanceStatus: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Derive attendance status from check-OUT time:
// If checking out before halfDayFrom → half_day (left early)
// Otherwise → keep the check-in derived status (no downgrade)
const resolveCheckoutStatus = (timing = {}, existingStatus) => {
  const halfDayFromMin = toMinutes(timing.halfDayFrom || '12:30');
  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  if (nowMins < halfDayFromMin) {
    // Left before half-day threshold → half day regardless of check-in time
    return { status: 'half_day', remarks: `Left early at ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}` };
  }
  // Checked out at a reasonable time — keep whatever check-in gave
  return null; // null = no change to attendance
};

// ── Teacher / staff: check out ────────────────────────────────────────────────
const checkOut = async (req, res) => {
  try {
    const schoolId   = req.user.school;
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No employee profile linked to this account' });
    }

    const date   = startOfDay();
    const record = await StaffCheckin.findOne({ school: schoolId, employee: employeeId, date });

    if (!record?.checkIn?.time) {
      return res.status(400).json({ success: false, message: 'You have not checked in today' });
    }

    // If already checked out (e.g. auto-checkout already ran), return record
    // gracefully — don't error, just sync the app state
    if (record.checkOut?.time) {
      return res.json({ success: true, message: 'Already checked out', record, alreadyDone: true });
    }

    const school = await School.findById(schoolId).select('staffAttendanceTiming');
    const timing = school?.staffAttendanceTiming;

    record.checkOut = buildPunch(req.body);
    await record.save();

    // Re-evaluate attendance if checking out early (before halfDayFrom)
    const override = resolveCheckoutStatus(timing, null);
    if (override) {
      await autoMarkAttendance({
        schoolId, employeeId, userId: req.user._id,
        status: override.status, remarks: override.remarks,
      });
    }

    res.json({ success: true, message: 'Checked out', record, attendanceStatus: override?.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Teacher / staff: today's own record ──────────────────────────────────────
const getToday = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    if (!employeeId) return res.json({ success: true, record: null });

    const record = await StaffCheckin.findOne({
      school: req.user.school, employee: employeeId, date: startOfDay(),
    });

    const school = await School.findById(req.user.school).select('staffAttendanceTiming');
    const timing = school?.staffAttendanceTiming;
    if (record) await applyAutoCheckout([record], timing);
    res.json({ success: true, record, timing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Auto-checkout helper: if school end time has passed today and employee hasn't
// checked out, set checkOut to today @ schoolEndTime
const applyAutoCheckout = async (records, timing) => {
  const endTime = timing?.schoolEndTime || '16:00';
  const now     = new Date();
  const todayEndMins = toMinutes(endTime);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  if (nowMins < todayEndMins) return records; // end time hasn't come yet

  const updates = [];
  for (const r of records) {
    if (r.checkIn?.time && !r.checkOut?.time) {
      // Build the checkout time = same date as checkIn, hours:mins from schoolEndTime
      const [endH, endM] = endTime.split(':').map(Number);
      const checkoutTime = new Date(r.checkIn.time);
      checkoutTime.setHours(endH, endM, 0, 0);
      r.checkOut = { time: checkoutTime };
      updates.push(
        StaffCheckin.findByIdAndUpdate(r._id, { checkOut: { time: checkoutTime } })
      );
    }
  }
  if (updates.length) await Promise.all(updates);
  return records;
};

// ── Admin: list staff check-ins ───────────────────────────────────────────────
const listCheckins = async (req, res) => {
  try {
    const { date, from, to, employeeId } = req.query;
    const query = { school: req.user.school };

    if (from && to) {
      query.date = { $gte: startOfDay(new Date(from)), $lte: endOfDay(new Date(to)) };
    } else {
      const d = date ? new Date(date) : new Date();
      query.date = { $gte: startOfDay(d), $lte: endOfDay(d) };
    }
    if (employeeId) query.employee = employeeId;

    const school = await School.findById(req.user.school).select('staffAttendanceTiming');
    const timing = school?.staffAttendanceTiming;

    let records = await StaffCheckin.find(query)
      .populate('employee', 'name employeeId photo designation role department')
      .sort({ 'checkIn.time': 1, createdAt: 1 });

    // Auto-checkout anyone who hasn't checked out once end time has passed
    records = await applyAutoCheckout(records, timing);

    res.json({ success: true, records, timing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkIn, checkOut, getToday, listCheckins };
