const mongoose = require('mongoose');

const feeTermSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feeBreakdown: [{
    type: { type: String },
    amount: Number,
    description: String
  }],
  totalAmount: { type: Number, default: 0 },
  discount: {
    amount: { type: Number, default: 0 },
    reason: String
  },
  netAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
  // true when this category was added for this student only (not part of the
  // class-wide fee structure) — such categories stay editable/deletable per student.
  custom: { type: Boolean, default: false }
}, { _id: true });

const feeCollectionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYear: { type: String, required: true },

  // Per-term fee structure (new)
  terms: [feeTermSchema],

  // Legacy top-level breakdown (kept for backward compat)
  feeBreakdown: [{
    type: { type: String },
    amount: Number,
    description: String
  }],

  // Aggregate totals (sum across all terms)
  totalAmount: { type: Number, default: 0 },
  discount: {
    amount: { type: Number, default: 0 },
    reason: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  lateFee: { type: Number, default: 0 },
  netAmount: { type: Number, default: 0 },

  payments: [{
    termName: String,
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank_transfer', 'online', 'cheque'], required: true },
    date: { type: Date, default: Date.now },
    transactionId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    receiptNumber: String,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: String,
    // Discounts applied as part of this transaction, so a reversal can undo them too.
    discounts: [{ termName: String, amount: Number, reason: String }]
  }],

  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },

  installmentPlan: [{
    name: String,
    amount: Number,
    dueDate: Date,
    paidDate: Date,
    status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' }
  }],

  term: { type: String }  // legacy single-term field
}, { timestamps: true });

feeCollectionSchema.index({ school: 1, student: 1, academicYear: 1 });

module.exports = mongoose.model('FeeCollection', feeCollectionSchema);
