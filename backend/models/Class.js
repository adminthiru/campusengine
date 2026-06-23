const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., "Grade 10"
  section: { type: String, default: '' },
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  academicYear: { type: String, required: true },
  capacity: { type: Number, default: 40 },
  room: { type: String },
  fees: {
    yearly: { type: Number, default: 0 },
    monthly: { type: Number, default: 0 },
    feeType: { type: String, enum: ['yearly', 'monthly', 'installment'], default: 'yearly' },
    installments: [{
      name: String,
      amount: Number,
      dueDate: Date
    }],
    lateFee: { type: Number, default: 0 },
    lateFeePerDay: { type: Number, default: 0 }
  },
  // Ordered daily slot template — periods and breaks in sequence (e.g.
  // P1, P2, Break, P3, P4, Lunch, P5…). Drives the timetable grid columns.
  // Empty = fall back to school.periodsPerDay (all periods, no breaks).
  periodStructure: [{
    kind: { type: String, enum: ['period', 'break'], default: 'period' },
    name: { type: String },        // break label e.g. "Lunch" (periods auto-number P1, P2…)
    startTime: { type: String },
    endTime: { type: String },
  }],
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  subjectTeachers: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
  }],
  saturdaySchedule: {
    type: String,
    enum: ['school_default', 'all_working', 'all_holiday', 'alternate', 'one_in_three'],
    default: 'school_default',
    // school_default  = use school.workingDays.saturday
    // alternate       = 1st & 3rd Saturdays working, 2nd & 4th holiday
    // one_in_three    = 1st Saturday working, 2nd & 3rd holiday (repeating)
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

classSchema.index({ school: 1, name: 1, section: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
