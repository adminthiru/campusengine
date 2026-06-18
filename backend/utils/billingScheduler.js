const School = require('../models/School');
const { sendEmail, expiryReminderEmail } = require('./email');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const REMINDER_DAYS = [5, 1, 0];

// Daily: auto-expire trials/subscriptions past their end date, and email expiry
// reminders at T-5 / T-1 / on-expiry (deduped via subscription.lastReminderDays).
const runBillingChecks = async () => {
  const now = new Date();
  const schools = await School.find({ isActive: { $ne: false } }).select('name email subscription');
  for (const s of schools) {
    const sub = s.subscription || {};
    if (sub.status !== 'trial' && sub.status !== 'active') continue;
    const kind = sub.status === 'active' ? 'subscription' : 'trial';
    const endDate = sub.status === 'active' ? sub.currentPeriodEnd : sub.trialEndDate;
    if (!endDate) continue;

    const daysLeft = Math.ceil((new Date(endDate) - now) / 86400000);

    if (daysLeft < 0) {
      await School.findByIdAndUpdate(s._id, { $set: { 'subscription.status': 'expired' } });
    }

    if (REMINDER_DAYS.includes(daysLeft) && sub.lastReminderDays !== daysLeft) {
      if (process.env.EMAIL_USER && s.email) {
        sendEmail(expiryReminderEmail(s.email, s.name, { daysLeft, kind, loginUrl: CLIENT_URL })).catch(() => {});
      }
      await School.findByIdAndUpdate(s._id, { $set: { 'subscription.lastReminderDays': daysLeft } });
    }
  }
};

const startBillingScheduler = () => {
  setTimeout(() => runBillingChecks().catch(e => console.error('Billing check error:', e.message)), 30 * 1000);
  setInterval(() => runBillingChecks().catch(e => console.error('Billing check error:', e.message)), 24 * 60 * 60 * 1000);
  console.log('Billing scheduler started');
};

module.exports = { startBillingScheduler, runBillingChecks };
