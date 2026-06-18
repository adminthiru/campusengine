const mongoose = require('mongoose');

// A subscription tier the product owner offers to school tenants (e.g. Basic,
// Standard). Price is in rupees; converted to paise when creating a Razorpay order.
const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },   // e.g. "basic"
  price: { type: Number, required: true },                // ₹ per billing cycle
  billingCycleMonths: { type: Number, default: 1 },
  description: { type: String },
  features: [{ type: String }],
  // Module entitlements — which app modules this plan unlocks (keys from
  // config/modules.js). An empty array means "all modules" (unrestricted).
  modules: { type: [String], default: [] },
  // Usage caps. 0 (or null) means unlimited.
  limits: {
    maxStudents: { type: Number, default: 0 },
    maxStaff:    { type: Number, default: 0 },   // employees
  },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
