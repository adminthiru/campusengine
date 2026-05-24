const mongoose = require('mongoose');
const smsLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  to: { type: String, required: true },
  recipientName: { type: String },
  message: { type: String, required: true },
  language: { type: String, default: 'en' },
  type: { type: String, enum: ['attendance','fee','exam','timetable','general','admission','invitation','salary','alert','otp','homework','holiday','emergency','ptmeeting','transport','meeting','circular','payroll','schedule_change','staff_attendance'], default: 'general' },
  status: { type: String, enum: ['sent','failed','pending','delivered','undelivered'], default: 'pending' },
  channel: { type: String, enum: ['sms', 'whatsapp'], default: 'sms' },
  twilioSid: { type: String },
  deliveryStatus: { type: String },
  deliveredAt: { type: Date },
  error: { type: String },
  retryCount: { type: Number, default: 0 },
  sentAt: { type: Date },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsCampaign' },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsTemplate' },
  recipient: {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' }
  }
}, { timestamps: true });
smsLogSchema.index({ school: 1, createdAt: -1 });
smsLogSchema.index({ twilioSid: 1 });
module.exports = mongoose.model('SmsLog', smsLogSchema);
