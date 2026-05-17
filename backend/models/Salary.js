const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  workingDays: { type: Number },
  presentDays: { type: Number },
  leaveDays: { type: Number },
  earnings: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 }
  },
  deductions: {
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    lossOfPay: { type: Number, default: 0 }
  },
  grossSalary: { type: Number },
  totalDeductions: { type: Number },
  netSalary: { type: Number },
  payment: {
    method: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'upi'] },
    date: Date,
    transactionId: String,
    remarks: String
  },
  status: { type: String, enum: ['pending', 'paid', 'on_hold'], default: 'pending' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  slipNumber: { type: String }
}, { timestamps: true });

salarySchema.index({ school: 1, employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);
