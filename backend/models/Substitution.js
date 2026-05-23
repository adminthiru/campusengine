const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  school:            { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  date:              { type: Date, required: true },
  absentTeacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  periodNumber:      { type: Number, required: true },
  classRef:          { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  subject:           { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  academicYear:      { type: String },
  note:              { type: String },
}, { timestamps: true });

// One substitute per absent-teacher + period + date
substitutionSchema.index({ school: 1, date: 1, absentTeacher: 1, periodNumber: 1 }, { unique: true });

module.exports = mongoose.model('Substitution', substitutionSchema);
