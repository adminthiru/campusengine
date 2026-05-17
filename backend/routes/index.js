// routes/index.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { protect, authorize, checkSubscription } = require('../middleware/auth');

// Controllers
const authCtrl = require('../controllers/authController');
const schoolCtrl = require('../controllers/schoolController');
const empCtrl = require('../controllers/employeeController');
const stuCtrl = require('../controllers/studentController');
const attCtrl = require('../controllers/attendanceController');
const feesCtrl = require('../controllers/feesController');
const salCtrl = require('../controllers/salaryController');
const ttCtrl = require('../controllers/timetableController');
const examCtrl = require('../controllers/examController');

// Models for simple CRUD
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Parent = require('../models/Parent');
const SmsLog = require('../models/SmsLog');
const { Expense, Transport } = require('../models/Expense');
const School = require('../models/School');
const User = require('../models/User');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============== AUTH ==============
router.post('/auth/register', authCtrl.registerSchool);
router.post('/auth/login', authCtrl.login);
router.post('/auth/init-super-admin', authCtrl.initSuperAdmin);
router.get('/auth/me', protect, authCtrl.getMe);
router.put('/auth/change-password', protect, authCtrl.changePassword);
router.put('/auth/profile', protect, authCtrl.updateProfile);
router.put('/auth/notifications/:notifId/read', protect, authCtrl.markNotification);

// ============== SCHOOL ==============
router.get('/school', protect, schoolCtrl.getSchool);
router.post('/school/setup', protect, authorize('admin', 'correspondent'), schoolCtrl.setupSchool);
router.put('/school', protect, authorize('admin', 'correspondent', 'super_admin'), schoolCtrl.updateSchool);
router.get('/school/dashboard', protect, checkSubscription, schoolCtrl.getDashboardStats);
router.get('/super-admin/schools', protect, authorize('super_admin'), schoolCtrl.getAllSchools);
router.post('/school/upload-logo', protect, upload.single('logo'), schoolCtrl.uploadLogo);

// Grade config
router.put('/school/grade-config', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { gradeConfig: req.body }, { new: true });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Subscription
router.post('/subscription/create-order', protect, async (req, res) => {
  try {
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.create({ amount: 20000 * 100, currency: 'INR', receipt: `sub_${req.user.school}` });
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/subscription/verify', protect, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    if (sig !== razorpaySignature) return res.status(400).json({ success: false, message: 'Verification failed' });
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    await School.findByIdAndUpdate(req.user.school, {
      'subscription.status': 'active',
      'subscription.currentPeriodStart': now,
      'subscription.currentPeriodEnd': end,
      'subscription.razorpaySubscriptionId': razorpayPaymentId
    });
    res.json({ success: true, message: 'Subscription activated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== EMPLOYEES ==============
router.get('/employees', protect, checkSubscription, empCtrl.getEmployees);
router.post('/employees', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), empCtrl.createEmployee);
router.get('/employees/:id', protect, checkSubscription, empCtrl.getEmployee);
router.put('/employees/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), empCtrl.updateEmployee);
router.delete('/employees/:id', protect, checkSubscription, authorize('admin', 'correspondent'), empCtrl.deleteEmployee);
router.post('/employees/:id/job-offer-pdf', protect, empCtrl.getJobOfferPDF);
router.post('/employees/:id/tasks', protect, authorize('admin', 'correspondent', 'principal'), empCtrl.assignTask);
router.put('/employees/:id/tasks/:taskId', protect, empCtrl.updateTask);
router.post('/employees/:id/upload-photo', protect, upload.single('photo'), async (req, res) => {
  try {
    const url = `/uploads/${req.file.filename}`;
    await require('../models/Employee').findByIdAndUpdate(req.params.id, { photo: url });
    res.json({ success: true, url });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== STUDENTS ==============
router.get('/students', protect, checkSubscription, stuCtrl.getStudents);
router.post('/students', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), stuCtrl.createStudent);
router.get('/students/:id', protect, checkSubscription, stuCtrl.getStudent);
router.put('/students/:id', protect, checkSubscription, stuCtrl.updateStudent);
router.delete('/students/:id', protect, checkSubscription, authorize('admin', 'correspondent'), stuCtrl.deleteStudent);
router.post('/students/promote', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), stuCtrl.promoteStudents);
router.post('/students/:id/admission-letter-pdf', protect, stuCtrl.getAdmissionLetterPDF);
router.post('/students/id-card-data', protect, stuCtrl.getIDCardData);
router.post('/students/:id/upload-photo', protect, upload.single('photo'), async (req, res) => {
  try {
    const url = `/uploads/${req.file.filename}`;
    await require('../models/Student').findByIdAndUpdate(req.params.id, { photo: url });
    res.json({ success: true, url });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== PARENTS ==============
router.get('/parents', protect, async (req, res) => {
  try {
    const parents = await Parent.find({ school: req.user.school }).populate('students', 'name admissionNumber');
    res.json({ success: true, parents });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== CLASSES ==============
router.get('/classes', protect, checkSubscription, async (req, res) => {
  try {
    const { academicYear } = req.query;
    const query = { school: req.user.school };
    if (academicYear) query.academicYear = academicYear;
    const classes = await Class.find(query).populate('classTeacher', 'name').sort({ name: 1, section: 1 });
    // Add student count
    const Student = require('../models/Student');
    const classesWithCount = await Promise.all(classes.map(async (cls) => {
      const count = await Student.countDocuments({ school: req.user.school, currentClass: cls._id, status: 'active' });
      return { ...cls.toObject(), studentCount: count };
    }));
    res.json({ success: true, classes: classesWithCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/classes', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findById(req.user.school);
    const cls = await Class.create({ ...req.body, school: req.user.school, academicYear: req.body.academicYear || school.academicYear?.current });
    res.status(201).json({ success: true, class: cls });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/classes/:id', protect, checkSubscription, async (req, res) => {
  try {
    const { name, section, capacity, room, classTeacher, academicYear, fees } = req.body;
    const $set = { name, section, capacity, room, academicYear };
    if (fees) $set.fees = fees;
    const $unset = {};
    if (classTeacher) $set.classTeacher = classTeacher; else $unset.classTeacher = '';
    const update = Object.keys($unset).length ? { $set, $unset } : { $set };
    const cls = await Class.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, update, { new: true });
    res.json({ success: true, class: cls });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/classes/:id', protect, checkSubscription, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    await Class.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { isActive: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== SUBJECTS ==============
router.get('/subjects', protect, checkSubscription, async (req, res) => {
  try {
    const { classId } = req.query;
    const query = { school: req.user.school };
    if (classId) query.classes = classId;
    const subjects = await Subject.find(query).populate('teacher', 'name').populate('classes', 'name section');
    res.json({ success: true, subjects });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/subjects', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const body = { ...req.body, school: req.user.school };
    if (!body.code) delete body.code;
    if (!body.teacher) delete body.teacher;
    const subject = await Subject.create(body);
    if (req.body.classes?.length) {
      await Class.updateMany({ _id: { $in: req.body.classes } }, { $addToSet: { subjects: subject._id } });
    }
    res.status(201).json({ success: true, subject });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/subjects/:id', protect, checkSubscription, async (req, res) => {
  try {
    const subject = await Subject.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, req.body, { new: true });
    res.json({ success: true, subject });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/subjects/:id', protect, async (req, res) => {
  try {
    await Subject.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { isActive: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== ATTENDANCE ==============
router.post('/attendance/student', protect, checkSubscription, attCtrl.markStudentAttendance);
router.post('/attendance/employee', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), attCtrl.markEmployeeAttendance);
router.get('/attendance', protect, checkSubscription, attCtrl.getAttendance);
router.get('/attendance/summary', protect, checkSubscription, attCtrl.getStudentAttendanceSummary);

// ============== FEES ==============
router.get('/fees', protect, checkSubscription, feesCtrl.getFees);
router.post('/fees', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.createFeeRecord);
router.post('/fees/collect', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.collectPayment);
router.post('/fees/razorpay-order', protect, checkSubscription, feesCtrl.createRazorpayOrder);
router.post('/fees/razorpay-verify', protect, feesCtrl.verifyRazorpayPayment);
router.get('/fees/:id/receipt', protect, feesCtrl.getReceiptPDF);
router.post('/fees/send-reminder', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.sendFeeReminder);

// ============== SALARY ==============
router.get('/salaries', protect, checkSubscription, salCtrl.getSalaries);
router.post('/salaries/generate', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.generateSalary);
router.put('/salaries/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.updateSalary);
router.post('/salaries/:id/pay', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.paySalary);
router.get('/salaries/:id/payslip', protect, salCtrl.getPayslipPDF);

// ============== TIMETABLE ==============
router.get('/timetable', protect, checkSubscription, ttCtrl.getTimetable);
router.post('/timetable', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), ttCtrl.saveTimetable);
router.get('/timetable/free-slots', protect, checkSubscription, ttCtrl.getTeacherFreeSlots);
router.delete('/timetable/period', protect, checkSubscription, ttCtrl.deletePeriod);

// ============== EXAMS ==============
router.get('/exams', protect, checkSubscription, examCtrl.getExams);
router.post('/exams', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), examCtrl.createExam);
router.put('/exams/:id', protect, checkSubscription, examCtrl.updateExam);
router.post('/exams/marks', protect, checkSubscription, examCtrl.enterMarks);
router.post('/exams/:examId/publish', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), examCtrl.publishResults);
router.get('/exams/results', protect, checkSubscription, examCtrl.getResults);
router.get('/exams/results/:id/pdf', protect, examCtrl.getResultCardPDF);
router.get('/exams/award-list', protect, examCtrl.getAwardList);

// ============== EXPENSES ==============
router.get('/expenses', protect, checkSubscription, async (req, res) => {
  try {
    const { category, month, year } = req.query;
    const query = { school: req.user.school };
    if (category) query.category = category;
    if (month && year) query.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
    const expenses = await Expense.find(query).populate('createdBy', 'name').sort({ date: -1 });
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    res.json({ success: true, expenses, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/expenses', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), async (req, res) => {
  try {
    const exp = await Expense.create({ ...req.body, school: req.user.school, createdBy: req.user._id });
    res.status(201).json({ success: true, expense: exp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/expenses/:id', protect, async (req, res) => {
  try {
    const exp = await Expense.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, req.body, { new: true });
    res.json({ success: true, expense: exp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/expenses/:id', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== TRANSPORT ==============
router.get('/transport', protect, async (req, res) => {
  try {
    const routes = await Transport.find({ school: req.user.school }).populate('students', 'name admissionNumber');
    res.json({ success: true, routes });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/transport', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const route = await Transport.create({ ...req.body, school: req.user.school });
    res.status(201).json({ success: true, route });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== SMS ==============
router.get('/sms/logs', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const logs = await SmsLog.find({ school: req.user.school }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/sms/send', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { to, message, type } = req.body;
    const { sendSMS } = require('../utils/sms');
    const school = await School.findById(req.user.school);
    // Custom message send
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to: to.startsWith('+') ? to : `+91${to}` });
    await SmsLog.create({ school: req.user.school, to, message, type: type || 'general', status: 'sent', sentAt: new Date() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== SUPER ADMIN ==============
router.get('/super-admin/stats', protect, authorize('super_admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const [totalSchools, activeTrials, activeSubscriptions, expiredSchools] = await Promise.all([
      School.countDocuments(),
      School.countDocuments({ 'subscription.status': 'trial' }),
      School.countDocuments({ 'subscription.status': 'active' }),
      School.countDocuments({ 'subscription.status': 'expired' })
    ]);
    res.json({ success: true, stats: { totalSchools, activeTrials, activeSubscriptions, expiredSchools } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/super-admin/schools/:id/subscription', protect, authorize('super_admin'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, { subscription: req.body }, { new: true });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// User management by admin
router.get('/users', protect, authorize('admin', 'correspondent', 'super_admin'), async (req, res) => {
  try {
    const query = req.user.role === 'super_admin' ? {} : { school: req.user.school };
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/users/:id/toggle-status', protect, authorize('admin', 'correspondent', 'super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
