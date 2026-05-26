const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  admissionNumber: { type: String, required: true },
  rollNumber: { type: String },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  photo: { type: String },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  bloodGroup: { type: String },
  caste: { type: String },
  category: { type: String, enum: ['general', 'obc', 'sc', 'st', 'other'] },
  nationality: { type: String, default: 'Indian' },
  religion: { type: String },
  motherTongue: { type: String },
  previousSchool: { type: String },
  identificationMark: { type: String },
  aadharNumber: { type: String },
  alternativeMobile: { type: String },
  remarks: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  currentClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  academicYear: { type: String },
  section: { type: String },
  previousClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  admissionDate: { type: Date, default: Date.now },
  guardians: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent'
  }],
  primaryGuardian: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
  transportRoute: { type: mongoose.Schema.Types.ObjectId, ref: 'Transport' },
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  medicalInfo: {
    conditions: [String],
    allergies: [String],
    medications: [String],
    emergencyContact: {
      name: String,
      relation: String,
      phone: String
    }
  },
  status: { type: String, enum: ['active', 'inactive', 'transferred', 'graduated', 'dropped'], default: 'active' },
  promotionHistory: [{
    fromClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    toClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    academicYear: String,
    promotedAt: Date,
    promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

studentSchema.index({ school: 1, admissionNumber: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
