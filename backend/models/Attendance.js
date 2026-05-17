const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  type: { type: String, enum: ['student', 'employee'], required: true },
  date: { type: Date, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  period: { type: Number },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  records: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
    remarks: String,
    smsSent: { type: Boolean, default: false }
  }],
  academicYear: { type: String },
  term: { type: String }
}, { timestamps: true });

attendanceSchema.index({ school: 1, date: 1, class: 1, period: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
