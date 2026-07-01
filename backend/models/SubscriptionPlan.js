const mongoose = require('mongoose');

// A subscription tier the product owner offers to school tenants (e.g. Basic,
// Standard). Price is in rupees; converted to paise when creating a Razorpay order.
const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },   // e.g. "basic"
  // A plan offers BOTH a monthly and a yearly option; the school picks one at
  // checkout. Prices are in ₹; discount is a flat ₹ amount off that price.
  monthlyPrice:    { type: Number, default: 0 },
  monthlyDiscount: { type: Number, default: 0 },   // flat ₹ off the monthly price
  yearlyPrice:     { type: Number, default: 0 },
  yearlyDiscount:  { type: Number, default: 0 },   // flat ₹ off the yearly price
  // Free-trial length this plan grants (days). 0 = not a trial plan. The super
  // admin can extend a tenant's trial later from the Tenants page.
  trialDays: { type: Number, default: 0 },
  // Legacy single-price field, kept for back-compat / display fallback; set to
  // the monthly net on save.
  price: { type: Number, default: 0 },
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

// Net (after-discount) prices, never below zero. Fall back to the legacy
// single price for plans created before dual pricing existed.
subscriptionPlanSchema.methods.monthlyNet = function () {
  const base = this.monthlyPrice || this.price || 0;
  return Math.max(0, base - (this.monthlyDiscount || 0));
};
subscriptionPlanSchema.methods.yearlyNet = function () {
  const base = this.yearlyPrice || 0;
  return Math.max(0, base - (this.yearlyDiscount || 0));
};
// Net price + billing months for a chosen cycle ('monthly' | 'yearly').
subscriptionPlanSchema.methods.netForCycle = function (cycle) {
  return cycle === 'yearly'
    ? { amount: this.yearlyNet(), months: 12 }
    : { amount: this.monthlyNet(), months: 1 };
};

// Keep the legacy `price` mirroring the monthly net so older code/UI still works.
subscriptionPlanSchema.pre('save', function () {
  this.price = this.monthlyNet();
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
