const mongoose = require('mongoose');
const calendarSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  endDate: { type: Date },  // for multi-day events
  type: { type: String, enum: ['holiday', 'event', 'exam_day', 'meeting', 'other'], default: 'event' },
  description: { type: String },
  color: { type: String },  // optional override hex color
}, { timestamps: true });
module.exports = mongoose.model('SchoolCalendar', calendarSchema);
