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
    enabled: { type: Boolean, default: true },
    twilioSid: String,
    twilioToken: String,
    twilioPhone: String
  },
  leaveTypes: [{
    code:       { type: String },
    label:      { type: String },
    enabled:    { type: Boolean, default: true },
    daysPerMonth:{ type: Number, default: 0 }
  }],
  feeTerms: [{ name: { type: String } }],
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
