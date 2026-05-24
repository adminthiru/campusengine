const mongoose = require('mongoose');
const smsCampaignSchema = new mongoose.Schema({
  school:       { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name:         { type: String },
  message:      { type: String, required: true },
  language:     { type: String, default: 'en' },
  type:         { type: String, default: 'general' },
  channel:      { type: String, enum: ['sms','whatsapp','both'], default: 'sms' },
  targetType:   { type: String, enum: ['all','all_students','all_parents','all_teachers','all_staff','class','class_section','specific_students','specific_parents','specific_teachers','specific_staff','section','department','custom'], required: true },
  targetFilter: { type: mongoose.Schema.Types.Mixed },
  totalCount:   { type: Number, default: 0 },
  sentCount:    { type: Number, default: 0 },
  failedCount:  { type: Number, default: 0 },
  deliveredCount:{ type: Number, default: 0 },
  status:       { type: String, enum: ['scheduled','running','completed','failed','cancelled'], default: 'running' },
  scheduledAt:  { type: Date },
  startedAt:    { type: Date },
  completedAt:  { type: Date },
  statusHistory:[{ status: String, at: { type: Date, default: Date.now }, note: String }],
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
smsCampaignSchema.index({ school: 1, status: 1, scheduledAt: 1 });
module.exports = mongoose.model('SmsCampaign', smsCampaignSchema);
