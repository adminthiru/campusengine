const mongoose = require('mongoose');
const smsTemplateSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['attendance','fee','exam','timetable','general','admission','invitation','salary','alert','homework','holiday','emergency','ptmeeting','transport','meeting','circular','payroll','schedule_change','staff_attendance','otp'], default: 'general' },
  content: {
    en: { type: String, required: true },
    ta: { type: String },
    hi: { type: String },
    te: { type: String },
    ml: { type: String }
  },
  variables: [{ type: String }], // e.g. ['student_name','amount','due_date']
  dltTemplateId: { type: String },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('SmsTemplate', smsTemplateSchema);
