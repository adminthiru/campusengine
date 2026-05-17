const mongoose = require('mongoose');

const feeCollectionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYear: { type: String, required: true },
  feeBreakdown: [{
    type: String,
    amount: Number,
    description: String
  }],
  totalAmount: { type: Number, required: true },
  discount: {
    amount: { type: Number, default: 0 },
    reason: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  lateFee: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  payments: [{
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank_transfer', 'online', 'cheque'], required: true },
    date: { type: Date, default: Date.now },
    transactionId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    receiptNumber: String,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: String
  }],
  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
  installmentPlan: [{
    name: String,
    amount: Number,
    dueDate: Date,
    paidDate: Date,
    status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' }
  }],
  term: { type: String }
}, { timestamps: true });

feeCollectionSchema.index({ school: 1, student: 1, academicYear: 1 });

module.exports = mongoose.model('FeeCollection', feeCollectionSchema);
