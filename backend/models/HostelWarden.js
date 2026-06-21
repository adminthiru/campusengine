const mongoose = require('mongoose');

// Warden assignment — links an employee to a hostel. Multiple wardens per hostel
// are allowed, and one employee may be assigned to multiple hostels.
const hostelWardenSchema = new mongoose.Schema({
  school:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  employee:  { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  hostel:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },
  role:      { type: String, enum: ['chief_warden', 'assistant_warden', 'warden'], default: 'warden' },
  startDate: { type: Date },
  status:    { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

hostelWardenSchema.index({ school: 1, hostel: 1 });
hostelWardenSchema.index({ school: 1, employee: 1 });

module.exports = mongoose.model('HostelWarden', hostelWardenSchema);
