const mongoose = require('mongoose');

// Student gate / out pass. Records a student being taken out of school early by a
// parent or guardian, with the reason and pickup person's details, and produces a
// printable pass the security/watchman can verify against.
const outPassSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  passNumber: { type: String, required: true },

  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  parent:  { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' }, // when picked up by a registered parent

  // Who is collecting the student
  pickupType:     { type: String, enum: ['parent', 'guardian'], default: 'parent' },
  pickupName:     { type: String, required: true },
  pickupRelation: { type: String },               // father / mother / uncle / driver ...
  pickupPhone:    { type: String },
  pickupIdProof:  { type: String },               // ID proof no. captured for non-registered guardians

  reason: {
    type: String,
    enum: ['medical', 'family_function', 'emergency', 'half_day', 'early_leave', 'appointment', 'other'],
    default: 'early_leave'
  },
  reasonDetail: { type: String },

  exitDate:       { type: Date, default: Date.now }, // date & time of leaving
  expectedReturn: { type: Date },                    // if returning the same day

  status:    { type: String, enum: ['active', 'returned', 'cancelled'], default: 'active' },
  returnedAt:{ type: Date },

  approvedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks:   { type: String },
}, { timestamps: true });

outPassSchema.index({ school: 1, exitDate: -1 });
outPassSchema.index({ school: 1, passNumber: 1 }, { unique: true });

module.exports = mongoose.model('OutPass', outPassSchema);
