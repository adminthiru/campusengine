const StaffCheckin = require('../models/StaffCheckin');

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
  time: new Date(),
  lat: body.lat != null ? Number(body.lat) : undefined,
  lng: body.lng != null ? Number(body.lng) : undefined,
  accuracy: body.accuracy != null ? Number(body.accuracy) : undefined,
  address: body.address || undefined,
});

// ── Teacher / staff: check in (geo-tagged) ─────────────────────────────────────
const checkIn = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No employee profile linked to this account' });
    }

    const date = startOfDay();
    let record = await StaffCheckin.findOne({ school: schoolId, employee: employeeId, date });

    if (record && record.checkIn && record.checkIn.time) {
      return res.status(400).json({ success: false, message: 'Already checked in today', record });
    }

    const punch = buildPunch(req.body);
    if (!record) {
      record = await StaffCheckin.create({
        school: schoolId, employee: employeeId, user: req.user._id, date, checkIn: punch,
      });
    } else {
      record.checkIn = punch;
      record.user = req.user._id;
      await record.save();
    }

    res.json({ success: true, message: 'Checked in', record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Teacher / staff: check out (geo-tagged) ────────────────────────────────────
const checkOut = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'No employee profile linked to this account' });
    }

    const date = startOfDay();
    const record = await StaffCheckin.findOne({ school: schoolId, employee: employeeId, date });

    if (!record || !record.checkIn || !record.checkIn.time) {
      return res.status(400).json({ success: false, message: 'You have not checked in today' });
    }
    if (record.checkOut && record.checkOut.time) {
      return res.status(400).json({ success: false, message: 'Already checked out today', record });
    }

    record.checkOut = buildPunch(req.body);
    await record.save();

    res.json({ success: true, message: 'Checked out', record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Teacher / staff: today's own record (for state restore) ────────────────────
const getToday = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    if (!employeeId) return res.json({ success: true, record: null });

    const record = await StaffCheckin.findOne({
      school: req.user.school, employee: employeeId, date: startOfDay(),
    });
    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: track staff check-ins (login time + location) ───────────────────────
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

    const records = await StaffCheckin.find(query)
      .populate('employee', 'name employeeId photo designation role department')
      .sort({ 'checkIn.time': -1, createdAt: -1 });

    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkIn, checkOut, getToday, listCheckins };
