const mongoose = require('mongoose');

// A room inside a hostel. Beds are represented by `capacity` + per-allocation
// bedNumber (B1, B2…) rather than a separate collection. Live occupancy is
// derived from active HostelAllocation records, not stored here.
const hostelRoomSchema = new mongoose.Schema({
  school:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  hostel:     { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },
  floor:      { type: Number, default: 0 },
  roomNumber: { type: String, required: true, trim: true },
  roomType:   { type: String, enum: ['single', 'double', 'triple', 'custom'], default: 'single' },
  capacity:   { type: Number, required: true, default: 1, min: 1 },
  status:     { type: String, enum: ['available', 'full', 'maintenance', 'reserved'], default: 'available' },
}, { timestamps: true });

hostelRoomSchema.index({ school: 1, hostel: 1 });
hostelRoomSchema.index({ school: 1, hostel: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('HostelRoom', hostelRoomSchema);
