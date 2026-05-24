const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  school:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType:  { type: String, enum: ['CL', 'SL', 'LOP'], required: true },
  fromDate:   { type: Date, required: true },
  toDate:     { type: Date, required: true },
  days:       { type: Number, required: true },
  reason:     { type: String, required: true },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:  { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
