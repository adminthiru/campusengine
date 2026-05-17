const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employeeId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  photo: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  bloodGroup: { type: String },
  religion: { type: String },
  caste: { type: String },
  nationality: { type: String, default: 'Indian' },
  aadharNumber: { type: String },
  panNumber: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  permanentAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  role: {
    type: String,
    enum: ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'admin', 'other'],
    required: true
  },
  department: { type: String },
  designation: { type: String },
  dateOfJoining: { type: Date },
  dateOfLeaving: { type: Date },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number,
    percentage: Number
  }],
  experience: [{
    institution: String,
    role: String,
    fromYear: Number,
    toYear: Number
  }],
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  salary: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    pfDeduction: { type: Number, default: 0 },
    esiDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    upiId: String
  },
  emergencyContact: {
    name: String,
    relation: String,
    phone: String
  },
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['active', 'inactive', 'on_leave', 'resigned', 'terminated'], default: 'active' },
  tasks: [{ // For maintenance staff
    title: String,
    description: String,
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    assignedAt: Date,
    completedAt: Date
  }]
}, { timestamps: true });

employeeSchema.index({ school: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
