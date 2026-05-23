const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  term: { type: String },
  schedule: [{
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], required: true },
    periods: [{
      periodNumber: { type: Number, required: true },
      startTime: { type: String },
      endTime: { type: String },
      subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      room: { type: String },
      isBreak: { type: Boolean, default: false },
      breakName: { type: String } // e.g., "Lunch Break"
    }]
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

timetableSchema.index({ school: 1, class: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
