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
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

classSchema.index({ school: 1, name: 1, section: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
