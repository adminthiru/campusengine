const mongoose = require('mongoose');

// A student's bed allocation. A student has at most one `active` allocation at a
// time; transfers/vacates close the old record (status transferred/vacated) and
// keep it for history. Room occupancy = count of active allocations for a room.
const hostelAllocationSchema = new mongoose.Schema({
  school:         { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student:        { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  hostel:         { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },
  room:           { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  bedNumber:      { type: String, trim: true },     // B1, B2, B3…
  allocationDate: { type: Date, default: Date.now },
  status:         { type: String, enum: ['active', 'transferred', 'vacated'], default: 'active' },
  vacateDate:     { type: Date },
  reason:         { type: String, trim: true },     // transfer / vacate reason
  remarks:        { type: String, trim: true },
  allocatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

hostelAllocationSchema.index({ school: 1, student: 1 });
hostelAllocationSchema.index({ school: 1, room: 1, status: 1 });

module.exports = mongoose.model('HostelAllocation', hostelAllocationSchema);
