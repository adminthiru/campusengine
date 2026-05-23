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
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const { v4: uuidv4 } = require('uuid');

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

// Leave config
router.put('/school/leave-config', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { leaveTypes: req.body.leaveTypes }, { new: true });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/fee-terms', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { feeTerms: req.body.feeTerms }, { new: true });
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

router.post('/employees/bulk', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees) || !employees.length) return res.status(400).json({ success: false, message: 'No data provided' });
    const schoolId = req.user.school;
    const school = await School.findById(schoolId);
    const results = { created: 0, failed: 0, errors: [] };
    let baseCount = await Employee.countDocuments({ school: schoolId });
    const validRoles = ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'other'];
    for (let i = 0; i < employees.length; i++) {
      try {
        const e = employees[i];
        if (!e.name?.trim()) throw new Error('Name is required');
        if (!e.email?.trim()) throw new Error('Email is required');
        if (!e.phone?.trim()) throw new Error('Phone is required');
        if (!e.role?.trim()) throw new Error('Role is required');
        const role = e.role.toLowerCase().trim();
        if (!validRoles.includes(role)) throw new Error(`Invalid role "${e.role}". Use: ${validRoles.join(', ')}`);
        const employeeId = `EMP${school.code}${String(baseCount + 1).padStart(4, '0')}`;
        const emp = await Employee.create({
          school: schoolId, employeeId, name: e.name.trim(),
          email: e.email.trim().toLowerCase(), phone: String(e.phone).trim(), role,
          department: e.department || undefined, designation: e.designation || undefined,
          dateOfJoining: e.dateOfJoining ? new Date(e.dateOfJoining) : undefined,
          dateOfBirth: e.dateOfBirth ? new Date(e.dateOfBirth) : undefined,
          gender: e.gender?.toLowerCase().trim() || undefined,
          bloodGroup: e.bloodGroup || undefined,
          salary: { basic: Number(e.basicSalary) || 0, hra: Number(e.hra) || 0, da: Number(e.da) || 0 }
        });
        const existingUser = await User.findOne({ email: e.email.trim().toLowerCase(), school: schoolId });
        if (!existingUser) {
          const tempPassword = `Temp@${uuidv4().slice(0, 6)}`;
          const userRole = ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent'].includes(role) ? role : 'admin';
          const user = await User.create({ school: schoolId, name: e.name.trim(), email: e.email.trim().toLowerCase(), phone: String(e.phone).trim(), password: tempPassword, role: userRole, employeeId: emp._id });
          emp.user = user._id;
          await emp.save();
        }
        baseCount++;
        results.created++;
      } catch (err) { results.failed++; results.errors.push(`Row ${i + 2}: ${err.message}`); }
    }
    res.json({ success: true, ...results });
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

router.post('/students/bulk', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || !students.length) return res.status(400).json({ success: false, message: 'No data provided' });
    const schoolId = req.user.school;
    const school = await School.findById(schoolId);
    const results = { created: 0, failed: 0, errors: [] };
    let baseCount = await Student.countDocuments({ school: schoolId });
    for (let i = 0; i < students.length; i++) {
      try {
        const s = students[i];
        if (!s.name?.trim()) throw new Error('Name is required');
        if (!s.gender?.trim()) throw new Error('Gender is required');
        if (!s.dateOfBirth?.trim()) throw new Error('Date of Birth is required');
        const dob = new Date(s.dateOfBirth);
        if (isNaN(dob)) throw new Error('Invalid Date of Birth (use YYYY-MM-DD)');
        const admissionNumber = `ADM${school.code}${new Date().getFullYear()}${String(baseCount + 1).padStart(4, '0')}`;
        await Student.create({
          school: schoolId, admissionNumber, name: s.name.trim(),
          gender: s.gender.toLowerCase().trim(), dateOfBirth: dob,
          rollNumber: s.rollNumber || undefined, bloodGroup: s.bloodGroup || undefined,
          religion: s.religion || undefined, caste: s.caste || undefined,
          category: s.category || undefined,
          phone: s.phone ? String(s.phone) : undefined, email: s.email || undefined,
          address: { street: s.address || undefined, city: s.city || undefined, state: s.state || undefined, pincode: s.pincode ? String(s.pincode) : undefined }
        });
        baseCount++;
        results.created++;
      } catch (err) { results.failed++; results.errors.push(`Row ${i + 2}: ${err.message}`); }
    }
    res.json({ success: true, ...results });
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
    const classes = await Class.find(query).populate('classTeacher', 'name').populate('subjects', 'name code color').sort({ name: 1, section: 1 });
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
    const now = new Date();
    const y = now.getFullYear();
    const defaultYear = now.getMonth() >= 5 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
    const academicYear = req.body.academicYear || school.academicYear?.current || defaultYear;
    const { subjects, ...rest } = req.body;
    const cls = await Class.create({ ...rest, subjects: subjects || [], school: req.user.school, academicYear });
    if (subjects?.length) {
      await Subject.updateMany({ _id: { $in: subjects } }, { $addToSet: { classes: cls._id } });
    }
    res.status(201).json({ success: true, class: cls });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/classes/:id', protect, checkSubscription, async (req, res) => {
  try {
    const { name, section, capacity, room, classTeacher, academicYear, fees, subjects } = req.body;
    const $set = { name, section, capacity, room, academicYear };
    if (fees) $set.fees = fees;
    if (subjects !== undefined) $set.subjects = subjects;
    const $unset = {};
    if (classTeacher) $set.classTeacher = classTeacher; else $unset.classTeacher = '';
    const update = Object.keys($unset).length ? { $set, $unset } : { $set };
    const cls = await Class.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, update, { new: true });
    // Sync Subject.classes — remove this class from all subjects then re-add selected ones
    if (subjects !== undefined) {
      await Subject.updateMany({ school: req.user.school }, { $pull: { classes: cls._id } });
      if (subjects.length) {
        await Subject.updateMany({ _id: { $in: subjects } }, { $addToSet: { classes: cls._id } });
      }
    }
    res.json({ success: true, class: cls });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/classes/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    await Class.findOneAndDelete({ _id: req.params.id, school: req.user.school });
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
router.delete('/subjects/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    await Subject.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== ATTENDANCE ==============
router.post('/attendance/student', protect, checkSubscription, attCtrl.markStudentAttendance);
router.post('/attendance/employee', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), attCtrl.markEmployeeAttendance);
router.get('/attendance', protect, checkSubscription, attCtrl.getAttendance);
router.get('/attendance/summary', protect, checkSubscription, attCtrl.getStudentAttendanceSummary);

// Employee leave balance for a given month (counts CL/SL usage per employee)
router.get('/attendance/leave-balance', protect, checkSubscription, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = Number(month), y = Number(year);
    const records = await Attendance.find({
      school: req.user.school, type: 'employee',
      date: { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) }
    });
    const used = {};
    for (const att of records) {
      for (const rec of att.records) {
        const id = rec.employee?.toString();
        if (!id) continue;
        if (!used[id]) used[id] = { cl: 0, sl: 0 };
        if (rec.status === 'cl') used[id].cl++;
        if (rec.status === 'sl') used[id].sl++;
      }
    }
    res.json({ success: true, used });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== FEES ==============
router.get('/fees', protect, checkSubscription, feesCtrl.getFees);
router.get('/fees/report', protect, checkSubscription, feesCtrl.getFeesReport);
router.post('/fees', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.createFeeRecord);
router.post('/fees/collect', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.collectPayment);
router.post('/fees/razorpay-order', protect, checkSubscription, feesCtrl.createRazorpayOrder);
router.post('/fees/razorpay-verify', protect, feesCtrl.verifyRazorpayPayment);
router.get('/fees/:id/receipt', protect, feesCtrl.getReceiptPDF);
router.post('/fees/bulk', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.createBulkFeeRecords);
router.post('/fees/send-reminder', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.sendFeeReminder);
router.put('/fees/class-structure', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.updateClassFeeStructure);
router.put('/fees/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.updateFeeRecord);
router.delete('/fees/:id/payment/:paymentId', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.reversePayment);
router.delete('/fees/:id/term', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.deleteFeeTerm);
router.delete('/fees/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.deleteFeeRecord);

// ============== SALARY ==============
router.get('/salaries', protect, checkSubscription, salCtrl.getSalaries);
router.get('/salaries/attendance-preview', protect, checkSubscription, salCtrl.getAttendanceSummary);
router.post('/salaries', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.createSalaryRecord);
router.post('/salaries/generate', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.generateSalary);
router.put('/salaries/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.updateSalary);
router.post('/salaries/:id/pay', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.paySalary);
router.post('/salaries/:id/revert', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.revertSalary);
router.delete('/salaries/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.deleteSalaryRecord);
router.get('/salaries/:id/payslip', protect, salCtrl.getPayslipPDF);

// ============== TIMETABLE ==============
router.get('/timetable', protect, checkSubscription, ttCtrl.getTimetable);
router.post('/timetable', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), ttCtrl.saveTimetable);
router.get('/timetable/free-slots', protect, checkSubscription, ttCtrl.getTeacherFreeSlots);
router.get('/timetable/day-substitutes', protect, checkSubscription, ttCtrl.getDaySubstitutes);
router.delete('/timetable/period', protect, checkSubscription, ttCtrl.deletePeriod);

// Substitution assignments
router.get('/timetable/substitutions', protect, checkSubscription, async (req, res) => {
  try {
    const Substitution = require('../models/Substitution');
    const { date, absentTeacherId } = req.query;
    if (!date || !absentTeacherId) return res.status(400).json({ success: false, message: 'date and absentTeacherId required' });
    const start = new Date(date + 'T00:00:00.000Z');
    const end   = new Date(date + 'T23:59:59.999Z');
    const subs = await Substitution.find({ school: req.user.school, absentTeacher: absentTeacherId, date: { $gte: start, $lte: end } })
      .populate('substituteTeacher', 'name designation department')
      .populate('classRef', 'name section')
      .populate('subject', 'name color');
    res.json({ success: true, substitutions: subs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/timetable/substitutions', protect, checkSubscription, async (req, res) => {
  try {
    const Substitution = require('../models/Substitution');
    const { date, absentTeacherId, substituteTeacherId, periodNumber, classId, subjectId, academicYear, note } = req.body;
    if (!date || !absentTeacherId || !substituteTeacherId || !periodNumber) {
      return res.status(400).json({ success: false, message: 'date, absentTeacherId, substituteTeacherId, periodNumber required' });
    }
    const dateObj = new Date(date + 'T00:00:00.000Z');
    const sub = await Substitution.findOneAndUpdate(
      { school: req.user.school, date: dateObj, absentTeacher: absentTeacherId, periodNumber: Number(periodNumber) },
      { $set: { substituteTeacher: substituteTeacherId, classRef: classId || null, subject: subjectId || null, academicYear, note: note || '', school: req.user.school, date: dateObj, absentTeacher: absentTeacherId, periodNumber: Number(periodNumber) } },
      { upsert: true, new: true }
    ).populate('substituteTeacher', 'name designation department');
    res.json({ success: true, substitution: sub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/timetable/substitutions/:id', protect, checkSubscription, async (req, res) => {
  try {
    const Substitution = require('../models/Substitution');
    await Substitution.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== EXAMS ==============
router.get('/exams', protect, checkSubscription, examCtrl.getExams);
router.post('/exams', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), examCtrl.createExam);
router.post('/exams/marks', protect, checkSubscription, examCtrl.enterMarks);
router.post('/exams/answer-paper', protect, checkSubscription, upload.single('answerPaper'), examCtrl.uploadAnswerPaper);
router.delete('/exams/results/:resultId/answer-paper', protect, checkSubscription, async (req, res) => {
  try {
    const { ExamResult } = require('../models/Exam');
    const { subjectId } = req.body;
    const result = await ExamResult.findOne({ _id: req.params.resultId, school: req.user.school });
    if (!result) return res.status(404).json({ success: false, message: 'Not found' });
    const markEntry = result.marks.find(m => m.subject?.toString() === subjectId);
    if (markEntry) { markEntry.answerPaper = undefined; await result.save(); }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/exams/:examId/publish', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), examCtrl.publishResults);
router.get('/exams/results', protect, checkSubscription, examCtrl.getResults);
router.get('/exams/results/:id/pdf', protect, examCtrl.getResultCardPDF);
router.get('/exams/award-list', protect, examCtrl.getAwardList);
router.get('/exams/:examId/hall-ticket/:studentId', protect, examCtrl.getHallTicket);
router.get('/exams/:id', protect, checkSubscription, examCtrl.getExamById);
router.put('/exams/:id', protect, checkSubscription, examCtrl.updateExam);
router.delete('/exams/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), examCtrl.deleteExam);

// ============== EXPENSES ==============
router.get('/expenses/report', protect, checkSubscription, async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    const query = { school: req.user.school };
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.date.$lte = e; }
    }
    const expenses = await Expense.find(query).populate('createdBy', 'name').sort({ date: 1 });
    const school   = await School.findById(req.user.school);
    const { generateExpensesReport } = require('../utils/pdf');
    const pdf = await generateExpensesReport(expenses.map(e => e.toObject()), school.toObject(), { startDate, endDate, category });
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=expenses_report_${dateStr}.pdf`);
    res.send(pdf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

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
    const routes = await Transport.find({ school: req.user.school });
    // Count students via Student.transportRoute (the authoritative field)
    const studentCounts = await Student.aggregate([
      { $match: { school: req.user.school, transportRoute: { $in: routes.map(r => r._id) }, status: { $ne: 'dropped' } } },
      { $group: { _id: '$transportRoute', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    studentCounts.forEach(s => { countMap[s._id.toString()] = s.count; });
    const result = routes.map(r => ({ ...r.toObject(), studentCount: countMap[r._id.toString()] || 0 }));
    res.json({ success: true, routes: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.get('/transport/:id/students', protect, async (req, res) => {
  try {
    const students = await Student.find({
      school: req.user.school, transportRoute: req.params.id, status: { $ne: 'dropped' }
    }).populate('currentClass', 'name section').select('name admissionNumber phone currentClass gender photo rollNumber').sort({ name: 1 });
    res.json({ success: true, students });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/transport', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const route = await Transport.create({ ...req.body, school: req.user.school });
    res.status(201).json({ success: true, route });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/transport/:id', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const route = await Transport.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school }, req.body, { new: true }
    );
    if (!route) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, route });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/transport/:id', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const route = await Transport.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!route) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
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
