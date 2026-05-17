const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  to: { type: String, required: true },
  message: { type: String, required: true },
  language: { type: String, enum: ['en', 'ta'], default: 'en' },
  type: {
    type: String,
    enum: ['attendance', 'fee', 'exam', 'timetable', 'general', 'admission', 'invitation', 'salary', 'alert'],
    required: true
  },
  status: { type: String, enum: ['sent', 'failed', 'pending'], default: 'pending' },
  twilioSid: { type: String },
  error: { type: String },
  sentAt: { type: Date },
  recipient: {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' }
  }
}, { timestamps: true });

module.exports = mongoose.model('SmsLog', smsLogSchema);
