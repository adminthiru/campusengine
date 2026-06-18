const mongoose = require('mongoose');

// Ledger of subscription payments (online via Razorpay or manually recorded by the
// super admin). Powers each school's billing history and the platform revenue view.
const subscriptionPaymentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  planName: { type: String },                 // snapshot for history even if plan changes
  invoiceNumber: { type: String, required: true },   // auto "INV-..."
  amount: { type: Number, required: true },          // ₹
  currency: { type: String, default: 'INR' },
  method: { type: String, enum: ['online', 'upi', 'card', 'netbanking', 'wallet', 'cash', 'bank_transfer'], default: 'online' },
  status: { type: String, enum: ['paid', 'failed', 'pending'], default: 'paid' },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  periodStart: { type: Date },
  periodEnd: { type: Date },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // set for manual entries
  notes: { type: String },
}, { timestamps: true });

subscriptionPaymentSchema.index({ school: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
