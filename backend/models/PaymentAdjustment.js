const mongoose = require('mongoose');

// A manual money movement the school records against a payment method (e.g.
// adding cash on hand, or correcting an over-entry). Credits add to the
// method's running balance; debits reduce it. Each shows in the balance ledger.
const paymentAdjustmentSchema = new mongoose.Schema({
  school:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  method:    { type: String, required: true },              // cash | bank_transfer | cheque | online | <custom label>
  direction: { type: String, enum: ['credit', 'debit'], required: true },
  amount:    { type: Number, required: true, min: 1 },      // always positive; direction gives the sign
  reason:    { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

paymentAdjustmentSchema.index({ school: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentAdjustment', paymentAdjustmentSchema);
