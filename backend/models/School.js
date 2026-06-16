const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  subdomain: { type: String, unique: true, sparse: true },
  logo: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  principalName: { type: String },
  affiliationNumber: { type: String },
  establishedYear: { type: Number },
  board: { type: String, enum: ['CBSE', 'ICSE', 'State Board', 'IB', 'Other'] },
  language: { type: String, enum: ['en', 'ta'], default: 'en' },
  academicYear: {
    current: { type: String },
    startMonth: { type: Number, default: 6 },
    endMonth: { type: Number, default: 3 },
    terms: [{
      name: String,
      startDate: Date,
      endDate: Date
    }]
  },
  workingDays: {
    monday: { type: Boolean, default: true },
    tuesday: { type: Boolean, default: true },
    wednesday: { type: Boolean, default: true },
    thursday: { type: Boolean, default: true },
    friday: { type: Boolean, default: true },
    saturday: { type: Boolean, default: false },
    sunday: { type: Boolean, default: false }
  },
  periodsPerDay: { type: Number, default: 8 },
  periodDuration: { type: Number, default: 45 },
  schoolStartTime: { type: String, default: '08:00' },
  subscription: {
    status: { type: String, enum: ['trial', 'active', 'expired', 'cancelled'], default: 'trial' },
    trialStartDate: { type: Date, default: Date.now },
    trialEndDate: { type: Date },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    razorpaySubscriptionId: { type: String },
    amount: { type: Number, default: 20000 }
  },
  pdfConfig: {
    primaryColor:    { type: String, default: '#1a56e8' },
    secondaryColor:  { type: String, default: '#0ea5e9' },
    headerStyle:     { type: String, enum: ['solid', 'minimal', 'stripe'], default: 'solid' },
    footerText:      { type: String, default: '' },
    signatureLabel:  { type: String, default: 'Principal / Authorized Signatory' },
    showBorderFrame: { type: Boolean, default: false },
    pdfName:         { type: String, default: '' },
    showLogo:        { type: Boolean, default: true },
  },
  salaryConfig: {
    lopMethod: {
      type: String,
      enum: ['calendar_days', 'fixed_30', 'working_days'],
      default: 'calendar_days'
    },
    workingDaysPerMonth:    { type: Number, default: 26 },
    halfDayEnabled:         { type: Boolean, default: true },
    halfDayDeductionFactor: { type: Number, default: 0.5 },
    empSaturdaySchedule: {
      type: String,
      enum: ['school_default', 'all_working', 'all_holiday', 'alternate', 'one_in_three'],
      default: 'school_default'
    },
  },
  gradeConfig: {
    system: { type: String, enum: ['percentage', 'gpa', 'letter', 'custom'], default: 'percentage' },
    grades: [{
      label: String,
      minScore: Number,
      maxScore: Number,
      gpa: Number,
      remarks: String
    }]
  },
  smsConfig: {
    enabled:          { type: Boolean, default: false },
    smsEnabled:       { type: Boolean, default: false },
    whatsappEnabled:  { type: Boolean, default: false },
    twilioSid: String,
    twilioToken: String,
    twilioPhone: String,
    messagingServiceSid: String,
    whatsappNumber: String,
    senderId: String,
    dltEntityId: String,
    defaultLanguage: { type: String, default: 'en' },
    supportedLanguages: { type: [String], default: ['en'] },
    countryCode: { type: String, default: '+91' },
    notifications: { type: Object, default: {} }
  },
  leaveTypes: [{
    code:         { type: String },
    label:        { type: String },
    enabled:      { type: Boolean, default: true },
    daysPerMonth: { type: Number, default: 0 },
    carryForward: { type: Boolean, default: false }, // unused leaves roll to next month
  }],
  feeTerms: [{ name: { type: String } }],
  leaveConfig: {
    casualLeave: { type: Number, default: 12 },
    sickLeave:   { type: Number, default: 10 }
  },
  teacherPermissions: {
    classTeacher: {
      markStudentAttendance: { type: Boolean, default: true },
      markOwnAttendance:     { type: Boolean, default: true },
      viewStudents:          { type: Boolean, default: true },
      viewFeeStatus:         { type: Boolean, default: true },
      assignHomework:        { type: Boolean, default: true },
      viewAndEnterExamMarks: { type: Boolean, default: true },
      viewTimetable:         { type: Boolean, default: true },
    },
    subjectTeacher: {
      markOwnAttendance:     { type: Boolean, default: true },
      assignHomework:        { type: Boolean, default: true },
      viewSubjectStudents:   { type: Boolean, default: true },
      enterExamMarks:        { type: Boolean, default: true },
      viewTimetable:         { type: Boolean, default: true },
    }
  },
  parentPermissions: {
    viewStudentInfo:          { type: Boolean, default: true },
    viewAttendance:           { type: Boolean, default: true },
    viewFees:                 { type: Boolean, default: true },
    viewExamResults:          { type: Boolean, default: true },
    viewTimetable:            { type: Boolean, default: true },
    viewHomework:             { type: Boolean, default: true },
    submitHomework:           { type: Boolean, default: true },
    submitLeaveRequest:       { type: Boolean, default: true },
    notifyOnAttendance:       { type: Boolean, default: true },
    notifyOnHomeworkAssigned: { type: Boolean, default: true },
    notifyOnExamScheduled:    { type: Boolean, default: true },
    notifyOnExamResults:      { type: Boolean, default: true },
    notifyOnFeePayment:       { type: Boolean, default: true },
    notifyOnFeeReminder:      { type: Boolean, default: true },
  },
  studentPermissions: {
    viewTimetable:            { type: Boolean, default: true },
    viewHomework:             { type: Boolean, default: true },
    submitHomework:           { type: Boolean, default: true },
    viewExams:                { type: Boolean, default: true },
    viewExamResults:          { type: Boolean, default: true },
    viewAttendance:           { type: Boolean, default: true },
    submitLeaveRequest:       { type: Boolean, default: true },
    viewFees:                 { type: Boolean, default: true },
    notifyOnHomeworkAssigned: { type: Boolean, default: true },
    notifyOnExamScheduled:    { type: Boolean, default: true },
    notifyOnExamResults:      { type: Boolean, default: true },
    notifyOnFeePayment:       { type: Boolean, default: true },
    notifyOnFeeReminder:      { type: Boolean, default: true },
    notifyOnAttendance:       { type: Boolean, default: true },
  },
  staffAttendanceTiming: {
    enabled:     { type: Boolean, default: true },    // staff check-in feature on/off
    onTimeBy:    { type: String, default: '10:00' },  // check-in by this = present
    lateFrom:    { type: String, default: '11:00' },  // after this = late
    halfDayFrom: { type: String, default: '12:30' },  // after this = half day
    schoolEndTime: { type: String, default: '16:00' }, // auto check-out at this time
    configured:  { type: Boolean, default: false },    // admin has explicitly set the rules
  },
  libraryConfig: {
    finePerDay: { type: Number, default: 2 }, // ₹ per day overdue
  },
  expenseCategories: { type: [String], default: [] },
  inventoryCategories: { type: [String], default: [] },
  inventoryLocations: { type: [String], default: [] },
  profileCompleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Generate trial end date before save
schoolSchema.pre('save', function() {
  if (this.isNew) {
    const trialDays = parseInt(process.env.TRIAL_DAYS) || 15;
    this.subscription.trialStartDate = new Date();
    this.subscription.trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
  }
});

module.exports = mongoose.model('School', schoolSchema);
