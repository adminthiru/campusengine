const crypto = require('crypto');
const School = require('../models/School');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const PlatformSettings = require('../models/PlatformSettings');
const { sendEmail, paymentReceiptEmail } = require('../utils/email');

const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
// Sequential-ish invoice number with a collision retry (countDocuments isn't
// atomic, so re-derive + check on clash before falling back to a unique stamp).
const genInvoiceNumber = async () => {
  const base = await SubscriptionPayment.countDocuments({});
  for (let i = 1; i <= 6; i++) {
    const num = `INV${String(base + i).padStart(5, '0')}`;
    if (!(await SubscriptionPayment.findOne({ invoiceNumber: num }).select('_id').lean())) return num;
  }
  return `INV${Date.now().toString().slice(-8)}`;
};

// Gateway keys (decrypted) come from the super-admin Payment Settings, falling back to env.
const getGatewayKeys = async () => {
  const k = (await PlatformSettings.get()).gatewayKeys();
  return {
    enabled: k.enabled,
    keyId: k.keyId || process.env.RAZORPAY_KEY_ID,
    keySecret: k.keySecret || process.env.RAZORPAY_KEY_SECRET,
  };
};
const getRazorpay = (keyId, keySecret) => { const Razorpay = require('razorpay'); return new Razorpay({ key_id: keyId, key_secret: keySecret }); };

// The collection methods a school may use (no secrets) — drives the Billing page.
const getPaymentMethods = async (req, res) => {
  try { res.json({ success: true, methods: (await PlatformSettings.get()).schoolMethods() }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// The school's current plan + subscription + payment history (Billing tab).
const getMySubscription = async (req, res) => {
  try {
    const school = await School.findById(req.user.school).populate('subscription.plan').lean();
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    const Student = require('../models/Student');
    const Employee = require('../models/Employee');
    const [payments, students, employees] = await Promise.all([
      SubscriptionPayment.find({ school: req.user.school }).sort({ createdAt: -1 }).limit(50).lean(),
      Student.countDocuments({ school: req.user.school }),
      Employee.countDocuments({ school: req.user.school }),
    ]);
    res.json({
      success: true,
      subscription: school.subscription || {},
      isActive: school.isActive !== false,
      suspendedReason: school.suspendedReason,
      usage: { students, employees },
      payments,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Resolve the plan + chosen cycle ('monthly'|'yearly') for a checkout request,
// returning the net amount (₹) and billing months. planId in the body wins;
// otherwise the school's currently-selected plan is used.
const resolvePlanCycle = async (req) => {
  const cycle = req.body.cycle === 'yearly' ? 'yearly' : 'monthly';
  let plan = null;
  if (req.body.planId) plan = await SubscriptionPlan.findById(req.body.planId);
  if (!plan) {
    const school = await School.findById(req.user.school).populate('subscription.plan');
    plan = school?.subscription?.plan || null;
  }
  const { amount, months } = plan ? plan.netForCycle(cycle) : { amount: 0, months: 1 };
  return { plan, cycle, amount, months };
};

const createOrder = async (req, res) => {
  try {
    const { enabled, keyId, keySecret } = await getGatewayKeys();
    if (!enabled || !keyId || !keySecret) return res.status(400).json({ success: false, message: 'Online payment is not configured. Please use another method or contact support.' });
    const { plan, cycle, amount } = await resolvePlanCycle(req);
    if (!plan) return res.status(400).json({ success: false, message: 'Select a plan first.' });
    if (amount < 1) return res.status(400).json({ success: false, message: 'This plan has no price for the selected billing cycle.' });
    const order = await getRazorpay(keyId, keySecret).orders.create({
      amount: Math.round(amount * 100),   // paise (min 100)
      currency: 'INR',
      receipt: `sub_${req.user.school}_${Date.now()}`.slice(0, 40),
    });
    res.json({ success: true, order, key: keyId, amount, cycle });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
      return res.status(400).json({ success: false, message: 'Missing payment fields' });

    const { keyId, keySecret } = await getGatewayKeys();
    if (!keySecret) return res.status(500).json({ success: false, message: 'Payment gateway not configured' });

    // Constant-time HMAC-SHA256(order|payment) check.
    const expected = crypto.createHmac('sha256', keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(String(razorpaySignature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    // Idempotency: if this payment id was already recorded, return its invoice
    // instead of activating (and extending the period) a second time.
    const already = await SubscriptionPayment.findOne({ school: req.user.school, razorpayPaymentId }).lean();
    if (already) return res.json({ success: true, message: 'Subscription already activated', invoiceNumber: already.invoiceNumber });

    // Recompute the amount/period server-side from the plan + chosen cycle
    // (never trust a client-sent amount). Reject if there's no priced plan.
    const { plan, cycle, amount: amt, months } = await resolvePlanCycle(req);
    if (!plan || amt < 1) return res.status(400).json({ success: false, message: 'No valid plan for this payment' });

    // Bind to the real Razorpay order: it must exist and its amount must equal
    // what we computed — stops replaying a cheaper/older order's signature.
    try {
      const order = await getRazorpay(keyId, keySecret).orders.fetch(razorpayOrderId);
      if (!order || Number(order.amount) !== Math.round(amt * 100))
        return res.status(400).json({ success: false, message: 'Order amount mismatch' });
    } catch {
      return res.status(400).json({ success: false, message: 'Could not verify the order with the gateway' });
    }

    const school = await School.findById(req.user.school);
    const start = (school.subscription?.currentPeriodEnd && new Date(school.subscription.currentPeriodEnd) > new Date())
      ? new Date(school.subscription.currentPeriodEnd) : new Date();
    const end = addMonths(start, months);

    const invoiceNumber = await genInvoiceNumber();
    await SubscriptionPayment.create({
      school: school._id, plan: plan?._id, planName: plan?.name || school.subscription?.planName,
      invoiceNumber, amount: amt, method: 'online', status: 'paid',
      razorpayOrderId, razorpayPaymentId, periodStart: start, periodEnd: end,
    });

    await School.findByIdAndUpdate(school._id, {
      $set: {
        'subscription.status': 'active',
        'subscription.plan': plan?._id,
        'subscription.planName': plan?.name,
        'subscription.amount': amt,
        'subscription.billingCycle': cycle,
        'subscription.modules': plan?.modules || [],
        'subscription.limits': plan?.limits || {},
        'subscription.currentPeriodStart': start,
        'subscription.currentPeriodEnd': end,
        'subscription.razorpaySubscriptionId': razorpayPaymentId,
      },
    });

    if (process.env.EMAIL_USER && school.email) {
      sendEmail(paymentReceiptEmail(school.email, school.name, { invoiceNumber, amount: amt, planName: plan?.name, periodEnd: end, method: 'online' })).catch(() => {});
    }
    res.json({ success: true, message: 'Subscription activated', invoiceNumber });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Invoice PDF for a payment (school admin downloads their own).
const getInvoicePdf = async (req, res) => {
  try {
    const payment = await SubscriptionPayment.findOne({ _id: req.params.id, school: req.user.school }).lean();
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const school = await School.findById(req.user.school).lean();

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    const done = new Promise(r => doc.on('end', () => r(Buffer.concat(chunks))));

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    // Header
    doc.fillColor('#1a56e8').fontSize(22).text('School ERP', 50, 50).fillColor('#0f172a').fontSize(10).text('Subscription Invoice', 50, 78);
    doc.fontSize(16).fillColor('#0f172a').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#64748b').text(payment.invoiceNumber, 400, 74, { align: 'right' });
    doc.text(fmt(payment.createdAt), 400, 88, { align: 'right' });
    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e2e8f0').stroke();

    // Billed to
    doc.fillColor('#64748b').fontSize(9).text('BILLED TO', 50, 130);
    doc.fillColor('#0f172a').fontSize(12).text(school?.name || '', 50, 144);
    doc.fillColor('#64748b').fontSize(10).text(`Code: ${school?.code || ''}`, 50, 162).text(school?.email || '', 50, 176);

    // Table
    let y = 220;
    doc.fillColor('#64748b').fontSize(9).text('DESCRIPTION', 50, y).text('PERIOD', 280, y).text('AMOUNT', 450, y, { width: 95, align: 'right' });
    doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor('#e2e8f0').stroke();
    y += 28;
    doc.fillColor('#0f172a').fontSize(11)
      .text(`${payment.planName || 'Subscription'} plan`, 50, y)
      .text(`${fmt(payment.periodStart)} – ${fmt(payment.periodEnd)}`, 280, y)
      .text(`Rs. ${payment.amount}`, 450, y, { width: 95, align: 'right' });
    y += 40;
    doc.moveTo(300, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 12;
    doc.fillColor('#0f172a').fontSize(13).text('Total Paid', 300, y).text(`Rs. ${payment.amount}`, 450, y, { width: 95, align: 'right' });
    y += 24;
    doc.fillColor('#64748b').fontSize(10).text(`Payment method: ${(payment.method || 'online').replace('_', ' ')}`, 300, y);
    doc.text(`Status: ${payment.status}`, 300, y + 14);

    doc.fillColor('#94a3b8').fontSize(9).text('Thank you for subscribing to School ERP.', 50, 760, { align: 'center', width: 495 });
    doc.end();

    const buf = await done;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${payment.invoiceNumber}.pdf`);
    res.send(buf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getMySubscription, getPaymentMethods, createOrder, verifyPayment, getInvoicePdf };
