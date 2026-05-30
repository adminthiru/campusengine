const mongoose = require('mongoose');

const studentLeaveSchema = new mongoose.Schema({
  school:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  parent:      { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
  submittedBy: { type: String, enum: ['parent', 'student'], default: 'parent' },
  fromDate:   { type: Date, required: true },
  toDate:     { type: Date, required: true },
  days:       { type: Number, required: true },
  reason:     { type: String, required: true },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:  { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('StudentLeave', studentLeaveSchema);
