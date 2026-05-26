const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  school:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employeeId: { type: String, required: true },
  name:       { type: String, required: true },
  email:      { type: String, required: true },
  phone:      { type: String },
  photo:      { type: String },
  status:     { type: String, enum: ['active', 'inactive', 'on_leave', 'resigned', 'terminated'], default: 'active' },

  // Personal
  dateOfBirth: { type: Date },
  gender:      { type: String, enum: ['male', 'female', 'other'] },
  bloodGroup:  { type: String },

  // Flat address (matches form)
  address:     { type: String },
  city:        { type: String },
  state:       { type: String },
  country:     { type: String },

  // Work
  role:           { type: String, enum: ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'admin', 'other'], required: true },
  department:     { type: String },
  designation:    { type: String },
  employmentType: { type: String },
  dateOfJoining:  { type: Date },
  workLocation:   { type: String },

  // Academics (matches form fields)
  academics: [{
    institutionName: String,
    qualification:   String,
    fieldOfStudy:    String,
    grade:           String,
    startYear:       Number,
    endYear:         Number,
  }],

  // Experience (matches form fields)
  experience: [{
    organizationName: String,
    designation:      String,
    employmentType:   String,
    skillsUsed:       String,
    startDate:        Date,
    endDate:          Date,
  }],

  // Emergency contacts array (matches form)
  emergencyContacts: [{
    name:                   String,
    relationship:           String,
    contactNumber:          String,
    alternateContactNumber: String,
    address:                String,
  }],

  // Documents (matches form fields)
  documents: [{
    documentType: String,
    fileData:     String,
    fileName:     String,
    uploadedAt:   { type: Date, default: Date.now },
  }],

  // Bank details (matches form)
  bank: {
    accountHolderName: String,
    bankName:          String,
    accountNumber:     String,
    ifscCode:          String,
    branchName:        String,
    upiId:             String,
  },

  // Salary (managed by Salary module, not the employee form)
  salary: {
    salaryType:      String,
    basic:           { type: Number, default: 0 },
    hra:             { type: Number, default: 0 },
    da:              { type: Number, default: 0 },
    allowances:      { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    deductions:      { type: Number, default: 0 },
    pfDeduction:     { type: Number, default: 0 },
    esiDeduction:    { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    paymentMode:     String,
    bankName:        String,
    accountNumber:   String,
    ifscCode:        String,
    upiId:           String,
  },

  // Subjects taught (for teachers)
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],

  // Tasks (for maintenance staff)
  tasks: [{
    title:       String,
    description: String,
    status:      { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    assignedAt:  Date,
    completedAt: Date,
  }],
}, { timestamps: true });

employeeSchema.index({ school: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
