const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const PlatformSettings = require('../models/PlatformSettings');
const { genTempPassword } = require('../utils/tempPassword');
const { sendEmail, tenantWelcomeEmail, paymentReceiptEmail } = require('../utils/email');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────
const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
const daysBetween = (a, b) => Math.ceil((new Date(a) - new Date(b)) / 86400000);

const genInvoiceNumber = async () => {
  const n = await SubscriptionPayment.countDocuments({}) + 1;
  return `INV${String(n).padStart(5, '0')}`;
};

// Derived status that accounts for suspension + trial/period expiry.
const effectiveStatus = (school) => {
  if (school.isActive === false) return 'suspended';
  const s = school.subscription || {};
  const now = new Date();
  if (s.status === 'active') return (s.currentPeriodEnd && now > new Date(s.currentPeriodEnd)) ? 'expired' : 'active';
  if (s.status === 'trial') return (s.trialEndDate && now > new Date(s.trialEndDate)) ? 'expired' : 'trial';
  return s.status || 'trial';
};

const countsBySchool = async () => {
  const [students, employees] = await Promise.all([
    Student.aggregate([{ $group: { _id: '$school', n: { $sum: 1 } } }]),
    Employee.aggregate([{ $group: { _id: '$school', n: { $sum: 1 } } }]),
  ]);
  const sm = Object.fromEntries(students.map(x => [String(x._id), x.n]));
  const em = Object.fromEntries(employees.map(x => [String(x._id), x.n]));
  return { sm, em };
};

const seedDefaultPlans = async () => {
  if (await SubscriptionPlan.countDocuments({}) > 0) return;
  // Core modules every paid tier includes; higher tiers layer on more.
  const CORE = ['students', 'parents', 'employees', 'classes', 'subjects', 'timetable', 'calendar', 'attendance', 'exams', 'homework', 'fees'];
  const STANDARD = [...CORE, 'salary', 'expenses', 'library', 'sms'];
  const ALL = [...STANDARD, 'visits', 'outpass', 'inventory', 'transport'];
  await SubscriptionPlan.create([
    { name: 'Basic', code: 'basic', price: 200, billingCycleMonths: 1, sortOrder: 1, description: 'For small schools getting started', modules: CORE, limits: { maxStudents: 1000, maxStaff: 100 }, features: ['Core school modules', 'SMS notifications', 'Up to 1,000 students'] },
    { name: 'Standard', code: 'standard', price: 500, billingCycleMonths: 1, sortOrder: 2, description: 'For growing schools', modules: STANDARD, limits: { maxStudents: 2000, maxStaff: 200 }, features: ['Everything in Basic', 'Salary, Expenses, Library & SMS', 'Up to 2,000 students'] },
    { name: 'Premium', code: 'premium', price: 1500, billingCycleMonths: 1, sortOrder: 3, description: 'For large institutions', modules: ALL, limits: { maxStudents: 0, maxStaff: 0 }, features: ['All modules unlocked', 'Unlimited students & staff', 'Priority support'] },
  ]);
};

// Auto-provision the platform super admin on startup (idempotent), from the
// SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars — so a fresh deployment
// (Render/Railway/Atlas) is ready to log in without a manual init call.
const createDefaultSuperAdmin = async () => {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[startup] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping super-admin seed');
    return;
  }
  if (await User.findOne({ role: 'super_admin' })) return;   // already provisioned
  await User.create({ name: 'Super Admin', email, password, role: 'super_admin' });  // pre-save hook hashes
  console.log(`[startup] Super admin provisioned: ${email}`);
};

// ── Tenants ───────────────────────────────────────────────────────────────────
const listSchools = async (req, res) => {
  try {
    const schools = await School.find().populate('subscription.plan', 'name price').sort({ createdAt: -1 }).lean();
    const { sm, em } = await countsBySchool();
    const out = schools.map(s => {
      const sub = s.subscription || {};
      const status = effectiveStatus(s);
      const expiryDate = sub.status === 'active' ? sub.currentPeriodEnd : sub.trialEndDate;
      return {
        _id: s._id, name: s.name, code: s.code, email: s.email, phone: s.phone,
        logo: s.logo, createdAt: s.createdAt, isActive: s.isActive !== false,
        students: sm[String(s._id)] || 0, employees: em[String(s._id)] || 0,
        subscription: { ...sub, status, planName: sub.planName || sub.plan?.name, amount: sub.amount },
        expiryDate, daysLeft: expiryDate ? daysBetween(expiryDate, new Date()) : null,
      };
    });
    res.json({ success: true, schools: out });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id).populate('subscription.plan').lean();
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    const [admin, students, employees, classes, payments] = await Promise.all([
      User.findOne({ school: school._id, role: 'admin' }).select('name email phone firstLogin lastLogin isActive').lean(),
      Student.countDocuments({ school: school._id }),
      Employee.countDocuments({ school: school._id }),
      require('../models/Class').countDocuments({ school: school._id }),
      SubscriptionPayment.find({ school: school._id }).populate('plan', 'name').sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    res.json({
      success: true,
      school: { ...school, isActive: school.isActive !== false, status: effectiveStatus(school) },
      admin, usage: { students, employees, classes },
      limits: school.subscription?.limits || {}, modules: school.subscription?.modules || [],
      payments,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createTenant = async (req, res) => {
  try {
    const { schoolName, adminName, adminEmail, phone, planId } = req.body;
    if (!schoolName?.trim()) return res.status(400).json({ success: false, message: 'School name is required' });
    if (!adminName?.trim()) return res.status(400).json({ success: false, message: 'Admin name is required' });
    if (!adminEmail?.trim()) return res.status(400).json({ success: false, message: 'Admin email is required' });

    const email = adminEmail.trim().toLowerCase();
    let plan = null;
    if (planId) { plan = await SubscriptionPlan.findById(planId); if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' }); }

    // Unique school code (retry on the rare collision)
    let code;
    for (let i = 0; i < 5; i++) {
      code = schoolName.substring(0, 3).toUpperCase() + (Date.now() + i).toString().slice(-5);
      if (!(await School.findOne({ code }))) break;
    }

    const school = await School.create({
      name: schoolName.trim(), code, phone, email,
      subscription: {
        plan: plan?._id, planName: plan?.name, amount: plan?.price ?? 200,
        modules: plan?.modules || [], limits: plan?.limits || {},
      },
    });

    const tempPassword = genTempPassword();
    await User.create({
      school: school._id, name: adminName.trim(), email, phone,
      password: tempPassword, role: 'admin', accessType: 'full', firstLogin: true, isActive: true,
    });

    if (process.env.EMAIL_USER) {
      sendEmail(tenantWelcomeEmail(adminName.trim(), schoolName.trim(), code, email, tempPassword, CLIENT_URL)).catch(() => {});
    }
    res.json({ success: true, school: { _id: school._id, name: school.name, code }, code, tempPassword });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateSchool = async (req, res) => {
  try {
    const { name, phone, email, principalName, planId, amount } = req.body;
    const current = await School.findById(req.params.id).select('subscription.status');
    if (!current) return res.status(404).json({ success: false, message: 'School not found' });
    const isActivePaid = current.subscription?.status === 'active';
    const set = {};
    if (name !== undefined) set.name = name;
    if (phone !== undefined) set.phone = phone;
    if (email !== undefined) set.email = email;
    if (principalName !== undefined) set.principalName = principalName;
    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
      // Entitlements always follow the assigned plan.
      set['subscription.plan'] = plan._id; set['subscription.planName'] = plan.name;
      set['subscription.modules'] = plan.modules || []; set['subscription.limits'] = plan.limits || {};
      if (isActivePaid) {
        // A paid, active school keeps its paid amount/cycle/period; only let the
        // super admin override the amount explicitly.
        if (amount !== undefined) set['subscription.amount'] = amount;
      } else {
        // Not active: set the price snapshot and, for a trial plan, (re)start the
        // trial for its configured length.
        set['subscription.amount'] = amount ?? plan.price;
        if ((plan.trialDays || 0) > 0) {
          set['subscription.status'] = 'trial';
          set['subscription.trialStartDate'] = new Date();
          set['subscription.trialEndDate'] = new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000);
        }
      }
    } else if (amount !== undefined) {
      set['subscription.amount'] = amount;
    }
    const school = await School.findByIdAndUpdate(req.params.id, { $set: set }, { returnDocument: 'after' });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const suspendSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id,
      { $set: { isActive: false, suspendedReason: req.body.reason || '', suspendedAt: new Date() } },
      { returnDocument: 'after' });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.json({ success: true, message: 'School suspended' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const reactivateSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id,
      { $set: { isActive: true }, $unset: { suspendedReason: '', suspendedAt: '' } },
      { returnDocument: 'after' });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.json({ success: true, message: 'School reactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const resetAdminPassword = async (req, res) => {
  try {
    const admin = await User.findOne({ school: req.params.id, role: 'admin' });
    if (!admin) return res.status(404).json({ success: false, message: 'School admin not found' });
    const tempPassword = genTempPassword();
    admin.password = tempPassword;
    admin.firstLogin = true;
    await admin.save();
    const school = await School.findById(req.params.id).select('name code');
    if (process.env.EMAIL_USER) {
      sendEmail(tenantWelcomeEmail(admin.name, school?.name || 'School', school?.code || '', admin.email, tempPassword, CLIENT_URL)).catch(() => {});
    }
    res.json({ success: true, tempPassword, email: admin.email });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Manual subscription adjustment (extend trial / activate / set period).
const updateSubscription = async (req, res) => {
  try {
    const { status, trialEndDate, currentPeriodStart, currentPeriodEnd, planId, amount } = req.body;
    const set = {};
    if (status) set['subscription.status'] = status;
    if (trialEndDate) set['subscription.trialEndDate'] = new Date(trialEndDate);
    if (currentPeriodStart) set['subscription.currentPeriodStart'] = new Date(currentPeriodStart);
    if (currentPeriodEnd) set['subscription.currentPeriodEnd'] = new Date(currentPeriodEnd);
    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) { set['subscription.plan'] = plan._id; set['subscription.planName'] = plan.name; set['subscription.amount'] = amount ?? plan.price; set['subscription.modules'] = plan.modules || []; set['subscription.limits'] = plan.limits || {}; }
    } else if (amount !== undefined) set['subscription.amount'] = amount;
    const school = await School.findByIdAndUpdate(req.params.id, { $set: set }, { returnDocument: 'after' });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Record an offline / manual payment and activate the subscription.
const recordPayment = async (req, res) => {
  try {
    const school = await School.findById(req.params.id).populate('subscription.plan');
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    const { amount, method = 'cash', months, notes } = req.body;
    const plan = school.subscription?.plan;
    const cycle = months || plan?.billingCycleMonths || 1;
    const amt = amount ?? school.subscription?.amount ?? plan?.price ?? 200;

    const start = (school.subscription?.currentPeriodEnd && new Date(school.subscription.currentPeriodEnd) > new Date())
      ? new Date(school.subscription.currentPeriodEnd) : new Date();
    const end = addMonths(start, cycle);

    const invoiceNumber = await genInvoiceNumber();
    const payment = await SubscriptionPayment.create({
      school: school._id, plan: plan?._id, planName: plan?.name || school.subscription?.planName,
      invoiceNumber, amount: amt, method, status: 'paid', periodStart: start, periodEnd: end,
      recordedBy: req.user._id, notes,
    });

    await School.findByIdAndUpdate(school._id, {
      $set: { 'subscription.status': 'active', 'subscription.currentPeriodStart': start, 'subscription.currentPeriodEnd': end },
    });

    if (process.env.EMAIL_USER && school.email) {
      sendEmail(paymentReceiptEmail(school.email, school.name, { invoiceNumber, amount: amt, planName: plan?.name, periodEnd: end, method })).catch(() => {});
    }
    res.json({ success: true, payment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Stats / revenue ─────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const schools = await School.find().select('subscription isActive createdAt').lean();
    const counts = { total: schools.length, trial: 0, active: 0, expired: 0, suspended: 0 };
    let mrr = 0;
    for (const s of schools) {
      const st = effectiveStatus(s);
      counts[st] = (counts[st] || 0) + 1;
      if (st === 'active') mrr += (s.subscription?.amount || 0);
    }
    const paidAgg = await SubscriptionPayment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    const recentPayments = await SubscriptionPayment.find({ status: 'paid' }).populate('school', 'name code').sort({ createdAt: -1 }).limit(8).lean();
    // signups last 6 months
    const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
    const signups = await School.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    res.json({
      success: true,
      stats: {
        ...counts,
        mrr,
        totalRevenue: paidAgg[0]?.total || 0,
        paymentCount: paidAgg[0]?.count || 0,
        recentPayments,
        signups: signups.map(s => ({ label: `${s._id.y}-${String(s._id.m).padStart(2, '0')}`, count: s.n })),
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const listPayments = async (req, res) => {
  try {
    const { status, school, page = 1, limit = 30 } = req.query;
    const q = {};
    if (status) q.status = status;
    if (school) q.school = school;
    const total = await SubscriptionPayment.countDocuments(q);
    const payments = await SubscriptionPayment.find(q).populate('school', 'name code').sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit)).lean();
    res.json({ success: true, payments, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Plans ───────────────────────────────────────────────────────────────────────
const listPlans = async (req, res) => {
  try { res.json({ success: true, plans: await SubscriptionPlan.find().sort({ sortOrder: 1, price: 1 }) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getActivePlans = async (req, res) => {
  try { res.json({ success: true, plans: await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createPlan = async (req, res) => {
  try {
    const { name, code, monthlyPrice, monthlyDiscount, yearlyPrice, yearlyDiscount, trialDays, description, features, modules, limits, sortOrder, isActive } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' });
    // A plan must have a price OR be a free-trial plan (trialDays > 0).
    if ((Number(monthlyPrice) || 0) <= 0 && (Number(yearlyPrice) || 0) <= 0 && (Number(trialDays) || 0) <= 0)
      return res.status(400).json({ success: false, message: 'Enter a monthly/yearly price, or set free-trial days' });
    if (await SubscriptionPlan.findOne({ code })) return res.status(400).json({ success: false, message: 'Plan code already exists' });
    const plan = await SubscriptionPlan.create({
      name, code,
      monthlyPrice: Number(monthlyPrice) || 0, monthlyDiscount: Number(monthlyDiscount) || 0,
      yearlyPrice: Number(yearlyPrice) || 0, yearlyDiscount: Number(yearlyDiscount) || 0,
      trialDays: Number(trialDays) || 0,
      description, features, modules, limits, sortOrder, isActive,
    });
    res.json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updatePlan = async (req, res) => {
  try {
    // Use save() (not findByIdAndUpdate) so the pre-save price mirror runs.
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const fields = ['name', 'monthlyPrice', 'monthlyDiscount', 'yearlyPrice', 'yearlyDiscount', 'trialDays', 'description', 'features', 'modules', 'limits', 'sortOrder', 'isActive'];
    for (const k of fields) if (req.body[k] !== undefined) plan[k] = req.body[k];
    await plan.save();
    // Cascade entitlements to every school currently on this plan so live tenants
    // stay in sync with the edited modules/limits/name.
    await School.updateMany(
      { 'subscription.plan': plan._id },
      { $set: { 'subscription.modules': plan.modules || [], 'subscription.limits': plan.limits || {}, 'subscription.planName': plan.name } }
    );
    res.json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deletePlan = async (req, res) => {
  try {
    const inUse = await School.countDocuments({ 'subscription.plan': req.params.id });
    if (inUse > 0) return res.status(400).json({ success: false, message: `Cannot delete — ${inUse} school(s) use this plan. Deactivate it instead.` });
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Payment / collection settings (singleton) ───────────────────────────────────
// Returns decrypted values WITHOUT the gateway secret (only a hasSecret flag).
const getPaymentSettings = async (req, res) => {
  try { res.json({ success: true, settings: (await PlatformSettings.get()).adminView() }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updatePaymentSettings = async (req, res) => {
  try {
    const s = await PlatformSettings.get();
    const { gateway, bankTransfer, upi, note } = req.body;
    if (gateway) {
      s.gateway.enabled = !!gateway.enabled;
      if (gateway.keyId !== undefined) s.gateway.keyId = gateway.keyId;
      // Only overwrite the secret when a new one is provided (frontend masks it).
      if (gateway.keySecret) s.gateway.keySecret = gateway.keySecret;
    }
    if (bankTransfer) {
      s.bankTransfer.enabled = !!bankTransfer.enabled;
      ['accountName', 'accountNumber', 'ifsc', 'bankName', 'branch'].forEach(k => { if (bankTransfer[k] !== undefined) s.bankTransfer[k] = bankTransfer[k]; });
    }
    if (upi) {
      s.upi.enabled = !!upi.enabled;
      ['upiId', 'payeeName'].forEach(k => { if (upi[k] !== undefined) s.upi[k] = upi[k]; });
    }
    if (note !== undefined) s.note = note;
    await s.save();   // pre-save encrypts the sensitive fields
    res.json({ success: true, settings: s.adminView() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  seedDefaultPlans, createDefaultSuperAdmin,
  listSchools, getSchool, createTenant, updateSchool, suspendSchool, reactivateSchool,
  resetAdminPassword, updateSubscription, recordPayment, getStats, listPayments,
  listPlans, getActivePlans, createPlan, updatePlan, deletePlan,
  getPaymentSettings, updatePaymentSettings,
};
