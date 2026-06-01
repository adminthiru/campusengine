const mongoose = require('mongoose');

// Geo-tagged punch (shared shape for check-in & check-out)
const punchSchema = new mongoose.Schema({
  time:     { type: Date },
  lat:      { type: Number },
  lng:      { type: Number },
  accuracy: { type: Number }, // GPS accuracy in metres
  address:  { type: String }, // optional reverse-geocoded label
}, { _id: false });

// One self-service attendance record per staff member per day.
// Created when a teacher/staff taps "Check In" from the mobile app; the
// matching check-out fills the checkOut punch. Admins read these to track
// staff login time + location.
const staffCheckinSchema = new mongoose.Schema({
  school:   { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Day the punches belong to, normalised to local midnight for uniqueness.
  date:     { type: Date, required: true },
  checkIn:  { type: punchSchema },
  checkOut: { type: punchSchema },
}, { timestamps: true });

// One record per employee per day.
staffCheckinSchema.index({ school: 1, employee: 1, date: 1 }, { unique: true });
staffCheckinSchema.index({ school: 1, date: 1 });

module.exports = mongoose.model('StaffCheckin', staffCheckinSchema);
