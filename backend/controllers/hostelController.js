// ── Hostel module ────────────────────────────────────────────────────────────
// Hostels → Rooms → Beds (bedNumber) → Students, plus warden assignments.
// Room occupancy is always derived from active HostelAllocation records, never
// stored, so counts can never drift out of sync.
const mongoose = require('mongoose');
const Hostel = require('../models/Hostel');
const HostelRoom = require('../models/HostelRoom');
const HostelWarden = require('../models/HostelWarden');
const HostelAllocation = require('../models/HostelAllocation');
const Student = require('../models/Student');

const STUDENT_FIELDS = 'name admissionNumber rollNumber gender photo currentClass';

// Active-allocation occupancy for a set of rooms → { roomId: { count, beds:[] } }.
async function occupancyMap(school, roomIds) {
  if (!roomIds.length) return {};
  const agg = await HostelAllocation.aggregate([
    { $match: { school: new mongoose.Types.ObjectId(school), room: { $in: roomIds.map(id => new mongoose.Types.ObjectId(id)) }, status: 'active' } },
    { $group: { _id: '$room', count: { $sum: 1 }, beds: { $push: '$bedNumber' } } },
  ]);
  const map = {};
  agg.forEach(r => { map[r._id.toString()] = { count: r.count, beds: r.beds.filter(Boolean) }; });
  return map;
}

// Next free bed label (B1, B2…) for a room given the taken bed labels.
function nextFreeBed(capacity, takenBeds) {
  const taken = new Set(takenBeds);
  for (let i = 1; i <= capacity; i++) {
    const label = `B${i}`;
    if (!taken.has(label)) return label;
  }
  return null;
}

// Recompute and persist a room's status from live occupancy (leaves
// maintenance/reserved untouched — those are set manually).
async function syncRoomStatus(room) {
  if (room.status === 'maintenance' || room.status === 'reserved') return;
  const count = await HostelAllocation.countDocuments({ room: room._id, status: 'active' });
  const next = count >= room.capacity ? 'full' : 'available';
  if (room.status !== next) { room.status = next; await room.save(); }
}

// ── Dashboard ────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const school = req.user.school;
    const [hostels, rooms, activeAllocs, wardenCount, hostellerCount] = await Promise.all([
      Hostel.find({ school }).lean(),
      HostelRoom.find({ school }).lean(),
      HostelAllocation.find({ school, status: 'active' }).select('student room hostel').lean(),
      HostelWarden.countDocuments({ school, status: 'active' }),
      Student.countDocuments({ school, isHosteller: true, status: 'active' }),
    ]);

    const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const occupiedBeds = activeAllocs.length;
    const studentSet = new Set(activeAllocs.map(a => a.student.toString()));
    const occByRoom = {}, occByHostel = {};
    activeAllocs.forEach(a => {
      occByRoom[a.room.toString()] = (occByRoom[a.room.toString()] || 0) + 1;
      occByHostel[a.hostel.toString()] = (occByHostel[a.hostel.toString()] || 0) + 1;
    });

    const capByHostel = {};
    rooms.forEach(r => { capByHostel[r.hostel.toString()] = (capByHostel[r.hostel.toString()] || 0) + (r.capacity || 0); });

    const occupancySummary = hostels.map(h => ({
      _id: h._id, hostel: h.name, type: h.type,
      occupied: occByHostel[h._id.toString()] || 0,
      capacity: capByHostel[h._id.toString()] || 0,
    }));

    const hostelMap = {}; hostels.forEach(h => { hostelMap[h._id.toString()] = h.name; });
    const availableRooms = rooms
      .filter(r => r.status !== 'maintenance' && (occByRoom[r._id.toString()] || 0) < (r.capacity || 0))
      .map(r => ({ _id: r._id, room: r.roomNumber, hostel: hostelMap[r.hostel.toString()] || '—', available: (r.capacity || 0) - (occByRoom[r._id.toString()] || 0) }))
      .sort((a, b) => b.available - a.available)
      .slice(0, 8);

    res.json({
      success: true,
      stats: {
        totalHostels: hostels.filter(h => h.status === 'active').length,
        totalRooms: rooms.length,
        occupiedBeds,
        availableBeds: Math.max(0, totalCapacity - occupiedBeds),
        hostelStudents: studentSet.size,
        pendingAllocation: Math.max(0, hostellerCount - studentSet.size),
        wardensAssigned: wardenCount,
      },
      occupancySummary,
      availableRooms,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Hostels ──────────────────────────────────────────────────────────────────
exports.listHostels = async (req, res) => {
  try {
    const school = req.user.school;
    const hostels = await Hostel.find({ school }).sort({ name: 1 }).lean();
    const rooms = await HostelRoom.find({ school }).select('hostel capacity').lean();
    const activeAllocs = await HostelAllocation.find({ school, status: 'active' }).select('hostel').lean();
    const byHostel = {};
    hostels.forEach(h => { byHostel[h._id.toString()] = { rooms: 0, capacity: 0, occupied: 0 }; });
    rooms.forEach(r => { const k = r.hostel.toString(); if (byHostel[k]) { byHostel[k].rooms++; byHostel[k].capacity += r.capacity || 0; } });
    activeAllocs.forEach(a => { const k = a.hostel.toString(); if (byHostel[k]) byHostel[k].occupied++; });
    res.json({ success: true, hostels: hostels.map(h => ({ ...h, ...byHostel[h._id.toString()] })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createHostel = async (req, res) => {
  try {
    const { name, type, block, totalFloors, contactNumber, status } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Hostel name is required' });
    if (!['boys', 'girls', 'mixed'].includes(type)) return res.status(400).json({ success: false, message: 'Valid hostel type is required' });
    const hostel = await Hostel.create({ school: req.user.school, name: name.trim(), type, block, totalFloors, contactNumber, status });
    res.status(201).json({ success: true, hostel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateHostel = async (req, res) => {
  try {
    const { name, type, block, totalFloors, contactNumber, status } = req.body;
    const hostel = await Hostel.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { name, type, block, totalFloors, contactNumber, status },
      { returnDocument: 'after', runValidators: true }
    );
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    res.json({ success: true, hostel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteHostel = async (req, res) => {
  try {
    const active = await HostelAllocation.countDocuments({ hostel: req.params.id, school: req.user.school, status: 'active' });
    if (active) return res.status(400).json({ success: false, message: 'Vacate all students in this hostel before deleting it.' });
    const hostel = await Hostel.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    await Promise.all([
      HostelRoom.deleteMany({ hostel: req.params.id, school: req.user.school }),
      HostelWarden.deleteMany({ hostel: req.params.id, school: req.user.school }),
    ]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Rooms / Occupancy ──────────────────────────────────────────────────────
exports.listRooms = async (req, res) => {
  try {
    const { hostel, floor, status } = req.query;
    const query = { school: req.user.school };
    if (hostel) query.hostel = hostel;
    if (floor !== undefined && floor !== '') query.floor = Number(floor);
    if (status) query.status = status;
    const rooms = await HostelRoom.find(query).populate('hostel', 'name type').sort({ floor: 1, roomNumber: 1 }).lean();
    const occ = await occupancyMap(req.user.school, rooms.map(r => r._id));
    res.json({
      success: true,
      rooms: rooms.map(r => {
        const o = occ[r._id.toString()] || { count: 0 };
        return { ...r, occupied: o.count, available: Math.max(0, (r.capacity || 0) - o.count) };
      }),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createRoom = async (req, res) => {
  try {
    const { hostel, floor, roomNumber, roomType, capacity, status } = req.body;
    if (!hostel) return res.status(400).json({ success: false, message: 'Hostel is required' });
    if (!roomNumber?.trim()) return res.status(400).json({ success: false, message: 'Room number is required' });
    const owner = await Hostel.findOne({ _id: hostel, school: req.user.school });
    if (!owner) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const room = await HostelRoom.create({
      school: req.user.school, hostel, floor: Number(floor) || 0, roomNumber: roomNumber.trim(),
      roomType: roomType || 'single', capacity: Math.max(1, Number(capacity) || 1), status: status || 'available',
    });
    res.status(201).json({ success: true, room });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A room with this number already exists in this hostel.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { floor, roomNumber, roomType, capacity, status } = req.body;
    const room = await HostelRoom.findOne({ _id: req.params.id, school: req.user.school });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const occupied = await HostelAllocation.countDocuments({ room: room._id, status: 'active' });
    if (capacity !== undefined && Number(capacity) < occupied) {
      return res.status(400).json({ success: false, message: `Capacity can't be below current occupancy (${occupied}).` });
    }
    if (status === 'maintenance' && occupied > 0) {
      return res.status(400).json({ success: false, message: 'Vacate or transfer students before marking this room under maintenance.' });
    }
    if (floor !== undefined) room.floor = Number(floor) || 0;
    if (roomNumber !== undefined) room.roomNumber = roomNumber.trim();
    if (roomType !== undefined) room.roomType = roomType;
    if (capacity !== undefined) room.capacity = Math.max(1, Number(capacity));
    if (status !== undefined) room.status = status;
    await room.save();
    // If they cleared maintenance/reserved, re-derive available/full.
    await syncRoomStatus(room);
    res.json({ success: true, room });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A room with this number already exists in this hostel.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const active = await HostelAllocation.countDocuments({ room: req.params.id, school: req.user.school, status: 'active' });
    if (active) return res.status(400).json({ success: false, message: 'Vacate students in this room before deleting it.' });
    const room = await HostelRoom.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Students currently in a room (active allocations).
exports.getRoomStudents = async (req, res) => {
  try {
    const allocs = await HostelAllocation.find({ room: req.params.id, school: req.user.school, status: 'active' })
      .populate({ path: 'student', select: STUDENT_FIELDS, populate: { path: 'currentClass', select: 'name section' } })
      .sort({ bedNumber: 1 }).lean();
    res.json({ success: true, students: allocs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Rooms in a hostel that still have free beds, with the free bed labels.
exports.getAvailableRooms = async (req, res) => {
  try {
    const { hostel } = req.query;
    if (!hostel) return res.status(400).json({ success: false, message: 'hostel is required' });
    const rooms = await HostelRoom.find({ school: req.user.school, hostel, status: { $ne: 'maintenance' } }).sort({ floor: 1, roomNumber: 1 }).lean();
    const occ = await occupancyMap(req.user.school, rooms.map(r => r._id));
    const result = rooms.map(r => {
      const o = occ[r._id.toString()] || { count: 0, beds: [] };
      const freeBeds = [];
      const taken = new Set(o.beds);
      for (let i = 1; i <= r.capacity; i++) if (!taken.has(`B${i}`)) freeBeds.push(`B${i}`);
      return { _id: r._id, roomNumber: r.roomNumber, floor: r.floor, roomType: r.roomType, capacity: r.capacity, occupied: o.count, available: r.capacity - o.count, freeBeds };
    }).filter(r => r.available > 0);
    res.json({ success: true, rooms: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Wardens ──────────────────────────────────────────────────────────────────
exports.listWardens = async (req, res) => {
  try {
    const wardens = await HostelWarden.find({ school: req.user.school })
      .populate('employee', 'name employeeId phone designation')
      .populate('hostel', 'name type')
      .sort({ createdAt: -1 }).lean();
    res.json({ success: true, wardens });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.assignWarden = async (req, res) => {
  try {
    const { employee, hostel, role, startDate } = req.body;
    if (!employee || !hostel) return res.status(400).json({ success: false, message: 'Employee and hostel are required' });
    const owner = await Hostel.findOne({ _id: hostel, school: req.user.school });
    if (!owner) return res.status(404).json({ success: false, message: 'Hostel not found' });
    const exists = await HostelWarden.findOne({ school: req.user.school, employee, hostel, status: 'active' });
    if (exists) return res.status(400).json({ success: false, message: 'This warden is already assigned to this hostel.' });
    const warden = await HostelWarden.create({ school: req.user.school, employee, hostel, role: role || 'warden', startDate });
    await warden.populate('employee', 'name employeeId phone designation');
    await warden.populate('hostel', 'name type');
    res.status(201).json({ success: true, warden });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.removeWarden = async (req, res) => {
  try {
    const warden = await HostelWarden.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!warden) return res.status(404).json({ success: false, message: 'Warden assignment not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Allocations ──────────────────────────────────────────────────────────────
exports.listAllocations = async (req, res) => {
  try {
    const { status = 'active', hostel } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (hostel) query.hostel = hostel;
    const allocations = await HostelAllocation.find(query)
      .populate({ path: 'student', select: STUDENT_FIELDS, populate: { path: 'currentClass', select: 'name section' } })
      .populate('hostel', 'name type')
      .populate('room', 'roomNumber floor')
      .sort({ createdAt: -1 }).lean();
    res.json({ success: true, allocations });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Shared validation + create for a bed allocation.
async function doAllocate({ school, studentId, hostelId, roomId, bedNumber, allocationDate, remarks, userId }) {
  const student = await Student.findOne({ _id: studentId, school });
  if (!student) throw new Error('Student not found');

  const already = await HostelAllocation.findOne({ school, student: studentId, status: 'active' });
  if (already) throw new Error('Student already has an active hostel allocation. Transfer or vacate first.');

  const room = await HostelRoom.findOne({ _id: roomId, school, hostel: hostelId });
  if (!room) throw new Error('Room not found in the selected hostel');
  if (room.status === 'maintenance') throw new Error('This room is under maintenance');

  const hostel = await Hostel.findOne({ _id: hostelId, school });
  if (!hostel) throw new Error('Hostel not found');
  // Gender validation — boys hostel takes male students, girls takes female.
  if (hostel.type === 'boys' && student.gender !== 'male') throw new Error('Only male students can be allocated to a boys hostel.');
  if (hostel.type === 'girls' && student.gender !== 'female') throw new Error('Only female students can be allocated to a girls hostel.');

  const active = await HostelAllocation.find({ room: roomId, status: 'active' }).select('bedNumber').lean();
  if (active.length >= room.capacity) throw new Error('Selected room is full');

  const takenBeds = active.map(a => a.bedNumber).filter(Boolean);
  let bed = (bedNumber || '').trim();
  if (bed) { if (takenBeds.includes(bed)) throw new Error(`Bed ${bed} is already taken`); }
  else bed = nextFreeBed(room.capacity, takenBeds) || `B${active.length + 1}`;

  const allocation = await HostelAllocation.create({
    school, student: studentId, hostel: hostelId, room: roomId, bedNumber: bed,
    allocationDate: allocationDate || new Date(), remarks, allocatedBy: userId,
  });
  await Student.updateOne({ _id: studentId, school }, { isHosteller: true });
  await syncRoomStatus(room);
  return allocation;
}

exports.allocateStudent = async (req, res) => {
  try {
    const { student, hostel, room, bedNumber, allocationDate, remarks } = req.body;
    if (!student || !hostel || !room) return res.status(400).json({ success: false, message: 'Student, hostel and room are required' });
    const allocation = await doAllocate({ school: req.user.school, studentId: student, hostelId: hostel, roomId: room, bedNumber, allocationDate, remarks, userId: req.user._id });
    await allocation.populate({ path: 'student', select: STUDENT_FIELDS });
    await allocation.populate('hostel', 'name type');
    await allocation.populate('room', 'roomNumber floor');
    res.status(201).json({ success: true, allocation });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.transferStudent = async (req, res) => {
  try {
    const { hostel, room, bedNumber, reason } = req.body;
    if (!room) return res.status(400).json({ success: false, message: 'New room is required' });
    const current = await HostelAllocation.findOne({ _id: req.params.id, school: req.user.school, status: 'active' });
    if (!current) return res.status(404).json({ success: false, message: 'Active allocation not found' });
    const newHostel = hostel || current.hostel;
    const newRoom = await HostelRoom.findOne({ _id: room, school: req.user.school });
    if (!newRoom) return res.status(404).json({ success: false, message: 'New room not found' });
    if (newRoom._id.toString() === current.room.toString()) return res.status(400).json({ success: false, message: 'Choose a different room to transfer to.' });

    // Close the old allocation, then allocate the new bed (re-uses all validation).
    const studentId = current.student;
    current.status = 'transferred';
    current.vacateDate = new Date();
    current.reason = reason || 'Transferred';
    await current.save();

    let allocation;
    try {
      allocation = await doAllocate({ school: req.user.school, studentId, hostelId: newHostel, roomId: room, bedNumber, allocationDate: new Date(), remarks: reason, userId: req.user._id });
    } catch (e) {
      // Roll back: re-open the original allocation so the student isn't left bed-less.
      current.status = 'active'; current.vacateDate = undefined; current.reason = undefined; await current.save();
      return res.status(400).json({ success: false, message: e.message });
    }
    const oldRoom = await HostelRoom.findById(current.room);
    if (oldRoom) await syncRoomStatus(oldRoom);
    await allocation.populate({ path: 'student', select: STUDENT_FIELDS });
    await allocation.populate('hostel', 'name type');
    await allocation.populate('room', 'roomNumber floor');
    res.json({ success: true, allocation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.vacateStudent = async (req, res) => {
  try {
    const { vacateDate, reason } = req.body;
    const allocation = await HostelAllocation.findOne({ _id: req.params.id, school: req.user.school, status: 'active' });
    if (!allocation) return res.status(404).json({ success: false, message: 'Active allocation not found' });
    allocation.status = 'vacated';
    allocation.vacateDate = vacateDate || new Date();
    allocation.reason = reason || 'Vacated';
    await allocation.save();

    // Clear the hosteller flag if the student has no other active allocation.
    const stillActive = await HostelAllocation.countDocuments({ school: req.user.school, student: allocation.student, status: 'active' });
    if (!stillActive) await Student.updateOne({ _id: allocation.student, school: req.user.school }, { isHosteller: false });

    const room = await HostelRoom.findById(allocation.room);
    if (room) await syncRoomStatus(room);
    res.json({ success: true, allocation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// A student's hostel history (for the student profile).
exports.getStudentHistory = async (req, res) => {
  try {
    const allocations = await HostelAllocation.find({ school: req.user.school, student: req.params.studentId })
      .populate('hostel', 'name type').populate('room', 'roomNumber floor')
      .sort({ createdAt: -1 }).lean();
    res.json({ success: true, allocations });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
