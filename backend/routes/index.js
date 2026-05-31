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
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { v4: uuidv4 } = require('uuid');
const { notifyParentUsers, notifyStudentUsers } = require('../utils/notify');

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

// ============== REPAIR CREDENTIALS (one-time migration) ==============
// Creates User accounts for students/parents added before auto-credential feature
router.post('/admin/repair-credentials', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const schoolId = req.user.school;
    const school = await School.findById(schoolId);
    let studentsFixed = 0, parentsFixed = 0, errors = [];

    // Fix students without a user account
    const students = await Student.find({ school: schoolId });
    for (const student of students) {
      const existingUser = await User.findOne({ studentId: student._id, school: schoolId });
      if (!existingUser) {
        try {
          const studentEmail = student.email || `${student.admissionNumber.toLowerCase()}@skl.internal`;
          const stuUser = await User.create({
            school: schoolId, name: student.name, email: studentEmail,
            phone: student.phone, password: student.admissionNumber,
            role: 'student', studentId: student._id, admissionNumber: student.admissionNumber,
          });
          student.user = stuUser._id;
          await student.save();
          studentsFixed++;
        } catch (e) {
          errors.push(`Student ${student.admissionNumber}: ${e.message}`);
        }
      }
    }

    // Fix parents without a user account
    const parents = await Parent.find({ school: schoolId }).populate('students');
    for (const parent of parents) {
      const existingUser = await User.findOne({ parentId: parent._id, school: schoolId });
      if (!existingUser && parent.phone) {
        try {
          const parentEmail = parent.email || `${parent.phone}@skl.internal`;
          const parentUser = await User.create({
            school: schoolId, name: parent.name, email: parentEmail,
            phone: parent.phone, password: parent.phone, role: 'parent', parentId: parent._id,
          });
          parent.user = parentUser._id;
          await parent.save();
          parentsFixed++;
        } catch (e) {
          errors.push(`Parent ${parent.phone}: ${e.message}`);
        }
      }
    }

    res.json({ success: true, studentsFixed, parentsFixed, errors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
    const { search } = req.query;
    // Only parents who are primaryGuardian of at least one student
    const primaryIds = await Student.distinct('primaryGuardian', {
      school: req.user.school, primaryGuardian: { $ne: null }
    });
    const query = { _id: { $in: primaryIds }, school: req.user.school };
    if (search) query.$or = [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }];
    const parents = await Parent.find(query).sort({ name: 1 });

    // Query students directly (don't rely on parent.students[] which can be stale)
    const students = await Student.find({
      primaryGuardian: { $in: primaryIds }, school: req.user.school
    }).populate('currentClass', 'name section').select('name admissionNumber currentClass primaryGuardian');

    // Group students by their primaryGuardian ID
    const byParent = {};
    students.forEach(s => {
      const pid = s.primaryGuardian.toString();
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push({ _id: s._id, name: s.name, admissionNumber: s.admissionNumber, currentClass: s.currentClass });
    });

    const result = parents.map(p => ({ ...p.toObject(), students: byParent[p._id.toString()] || [] }));
    res.json({ success: true, parents: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== PARENT PORTAL ==============
const StudentLeave = require('../models/StudentLeave');

// Parent permissions update
router.put('/school/parent-permissions', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { parentPermissions: req.body }, { new: true });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Parent: list linked children
router.get('/parent/my-children', protect, authorize('parent'), async (req, res) => {
  try {
    if (!req.user.parentId) return res.status(400).json({ success: false, message: 'No parent profile linked' });
    const students = await Student.find({
      school: req.user.school,
      $or: [{ primaryGuardian: req.user.parentId }, { guardians: req.user.parentId }]
    })
      .populate('currentClass', 'name section')
      .select('name admissionNumber photo gender dateOfBirth currentClass status bloodGroup phone');
    res.json({ success: true, children: students });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Parent: submit student leave request
router.post('/parent/student-leave', protect, authorize('parent'), async (req, res) => {
  try {
    if (!req.user.parentId) return res.status(400).json({ success: false, message: 'No parent profile' });
    const { studentId, fromDate, toDate, days, reason } = req.body;
    const student = await Student.findOne({ _id: studentId, school: req.user.school, $or: [{ primaryGuardian: req.user.parentId }, { guardians: req.user.parentId }] });
    if (!student) return res.status(403).json({ success: false, message: 'Student not linked to this parent' });
    const leave = await StudentLeave.create({
      school: req.user.school, student: studentId, parent: req.user.parentId,
      fromDate, toDate, days: Number(days), reason
    });
    await leave.populate('student', 'name admissionNumber');
    res.status(201).json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Parent: my students' leave history
router.get('/parent/student-leave', protect, authorize('parent'), async (req, res) => {
  try {
    if (!req.user.parentId) return res.status(400).json({ success: false, message: 'No parent profile' });
    const { studentId } = req.query;
    const query = { school: req.user.school, parent: req.user.parentId };
    if (studentId) query.student = studentId;
    const leaves = await StudentLeave.find(query).populate('student', 'name admissionNumber').sort({ createdAt: -1 });
    res.json({ success: true, leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: view all student leave requests
router.get('/student-leaves', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { status, studentId } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (studentId) query.student = studentId;
    const leaves = await StudentLeave.find(query)
      .populate('student', 'name admissionNumber currentClass')
      .populate('parent', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: approve/reject student leave
router.put('/student-leaves/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const leave = await StudentLeave.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { status, adminNote: adminNote || '', approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    ).populate('student', 'name admissionNumber').populate('parent', 'name phone');
    if (!leave) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== STUDENT PORTAL ==============

// Student permissions update
router.put('/school/student-permissions', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { studentPermissions: req.body }, { new: true });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Student: own profile
router.get('/student/my-profile', protect, authorize('student'), async (req, res) => {
  try {
    if (!req.user.studentId) return res.status(400).json({ success: false, message: 'No student profile linked' });
    const student = await Student.findById(req.user.studentId)
      .populate('currentClass', 'name section')
      .select('name admissionNumber rollNumber photo gender dateOfBirth bloodGroup currentClass status address phone email');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Student: submit own leave request
router.post('/student/leave', protect, authorize('student'), async (req, res) => {
  try {
    if (!req.user.studentId) return res.status(400).json({ success: false, message: 'No student profile linked' });
    const { fromDate, toDate, days, reason } = req.body;
    const student = await Student.findOne({ _id: req.user.studentId, school: req.user.school });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const leave = await StudentLeave.create({
      school: req.user.school, student: req.user.studentId,
      parent: student.primaryGuardian || undefined,
      submittedBy: 'student', fromDate, toDate, days: Number(days), reason
    });
    await leave.populate('student', 'name admissionNumber');
    res.status(201).json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Student: own leave history
router.get('/student/leave', protect, authorize('student'), async (req, res) => {
  try {
    if (!req.user.studentId) return res.status(400).json({ success: false, message: 'No student profile linked' });
    const leaves = await StudentLeave.find({ student: req.user.studentId, school: req.user.school }).sort({ createdAt: -1 });
    res.json({ success: true, leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== CLASSES ==============
router.get('/classes', protect, checkSubscription, async (req, res) => {
  try {
    const { academicYear } = req.query;
    const query = { school: req.user.school };
    if (academicYear) query.academicYear = academicYear;
    const classes = await Class.find(query)
      .populate('classTeacher', 'name')
      .populate('subjects', 'name code color')
      .populate('subjectTeachers.subject', 'name code color')
      .populate('subjectTeachers.teacher', 'name designation')
      .sort({ name: 1, section: 1 });
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
    const { subjects, subjectTeachers, ...rest } = req.body;
    const cls = await Class.create({ ...rest, subjects: subjects || [], subjectTeachers: subjectTeachers || [], school: req.user.school, academicYear });
    if (subjects?.length) {
      await Subject.updateMany({ _id: { $in: subjects } }, { $addToSet: { classes: cls._id } });
    }
    res.status(201).json({ success: true, class: cls });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/classes/:id', protect, checkSubscription, async (req, res) => {
  try {
    const { name, section, capacity, room, classTeacher, academicYear, fees, subjects, subjectTeachers } = req.body;
    const $set = { name, section, capacity, room, academicYear };
    if (fees) $set.fees = fees;
    if (subjects !== undefined) $set.subjects = subjects;
    if (subjectTeachers !== undefined) $set.subjectTeachers = subjectTeachers;
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

// Student day-by-day attendance records for detail view
router.get('/attendance/student-records', protect, checkSubscription, async (req, res) => {
  try {
    const { studentId, month, year } = req.query;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId required' });
    const query = { school: req.user.school, type: 'student', 'records.student': studentId };
    if (month && year) {
      query.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
    }
    const docs = await Attendance.find(query)
      .populate('class', 'name section')
      .populate('subject', 'name')
      .populate('markedBy', 'name')
      .sort({ date: 1, period: 1 });
    const records = docs.map(doc => {
      const rec = doc.records.find(r => r.student?.toString() === studentId);
      if (!rec) return null;
      return {
        _id: doc._id,
        date: doc.date,
        period: doc.period,
        class: doc.class,
        subject: doc.subject,
        markedBy: doc.markedBy,
        status: rec.status,
        remarks: rec.remarks || null,
      };
    }).filter(Boolean);
    res.json({ success: true, records });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Employee day-by-day attendance records for detail view
router.get('/attendance/employee-records', protect, checkSubscription, async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId required' });
    const query = { school: req.user.school, type: 'employee', 'records.employee': employeeId };
    if (month && year) {
      query.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
    }
    const docs = await Attendance.find(query).populate('markedBy', 'name').sort({ date: 1 });
    const records = docs.map(doc => {
      const rec = doc.records.find(r => r.employee?.toString() === employeeId);
      if (!rec) return null;
      return { _id: doc._id, date: doc.date, markedBy: doc.markedBy, status: rec.status, remarks: rec.remarks || null };
    }).filter(Boolean);
    res.json({ success: true, records });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Employee attendance summary (all-time stats)
router.get('/attendance/employee-summary', protect, checkSubscription, async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId required' });
    const docs = await Attendance.find({ school: req.user.school, type: 'employee', 'records.employee': employeeId });
    let present = 0, absent = 0, late = 0, halfDay = 0, od = 0, cl = 0, sl = 0;
    docs.forEach(doc => {
      const rec = doc.records.find(r => r.employee?.toString() === employeeId);
      if (!rec) return;
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'half_day') halfDay++;
      else if (rec.status === 'od') od++;
      else if (rec.status === 'cl') cl++;
      else if (rec.status === 'sl') sl++;
    });
    const total = present + absent + late + halfDay + od + cl + sl;
    res.json({ success: true, summary: { present, absent, late, halfDay, od, cl, sl, total, percentage: total ? Math.round((present / total) * 100) : 0 } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

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
router.post('/salaries/:id/recalculate', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), salCtrl.recalculateSalary);
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
    const end = new Date(date + 'T23:59:59.999Z');
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

// ============== SCHOOL CALENDAR ==============
const SchoolCalendar = require('../models/SchoolCalendar');

router.get('/calendar', protect, authorize('admin', 'correspondent', 'principal', 'teacher', 'accountant', 'student', 'parent'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const query = { school: req.user.school };
    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      query.$or = [
        { date: { $gte: start, $lte: end } },
        { endDate: { $gte: start, $lte: end } },
        { date: { $lte: start }, endDate: { $gte: end } }
      ];
    } else if (year) {
      const start = new Date(Number(year), 0, 1);
      const end = new Date(Number(year), 11, 31, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    }
    const events = await SchoolCalendar.find(query).sort({ date: 1 });
    res.json({ success: true, events });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/calendar', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const event = await SchoolCalendar.create({ ...req.body, school: req.user.school });
    res.status(201).json({ success: true, event });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/calendar/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const event = await SchoolCalendar.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school }, req.body, { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/calendar/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    await SchoolCalendar.findOneAndDelete({ _id: req.params.id, school: req.user.school });
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
    const school = await School.findById(req.user.school);
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
const smsCtrl = require('../controllers/smsController');
router.get('/sms/settings', protect, authorize('admin', 'correspondent'), smsCtrl.getSettings);
router.put('/sms/settings', protect, authorize('admin', 'correspondent'), smsCtrl.updateSettings);
router.post('/sms/test', protect, authorize('admin', 'correspondent'), smsCtrl.testSms);
router.get('/sms/templates', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.getTemplates);
router.post('/sms/templates', protect, authorize('admin', 'correspondent'), smsCtrl.createTemplate);
router.put('/sms/templates/:id', protect, authorize('admin', 'correspondent'), smsCtrl.updateTemplate);
router.delete('/sms/templates/:id', protect, authorize('admin', 'correspondent'), smsCtrl.deleteTemplate);
router.post('/sms/send', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.sendBulk);
router.get('/sms/batches', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.getBatches);
router.get('/sms/batches/:id/logs', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.getBatchLogs);
router.get('/sms/scheduled', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.getScheduled);
router.delete('/sms/scheduled/:id', protect, authorize('admin', 'correspondent'), smsCtrl.cancelScheduled);
router.get('/sms/logs', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.getLogs);
router.get('/sms/stats', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.getStats);
router.post('/sms/logs/:id/retry', protect, authorize('admin', 'correspondent'), smsCtrl.retryMessage);
router.post('/sms/otp/send', smsCtrl.sendOTPCtrl);
router.post('/sms/otp/verify', smsCtrl.verifyOTPCtrl);
router.post('/sms/webhook', smsCtrl.twilioWebhook);

// ============== HOMEWORK ==============
router.get('/homework', protect, checkSubscription, async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const { classId, date, status } = req.query;
    const query = { school: req.user.school };
    if (classId) query.class = classId;
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      const next = new Date(date); next.setDate(next.getDate() + 1);
      query.assignedDate = { $gte: d, $lt: next };
    }
    const homework = await Homework.find(query)
      .populate('class', 'name section')
      .populate('subject', 'name color')
      .populate('students', 'name admissionNumber')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, homework });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/homework', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'teacher'), async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const hw = await Homework.create({ ...req.body, school: req.user.school, createdBy: req.user._id });
    await hw.populate([{ path: 'class', select: 'name section' }, { path: 'subject', select: 'name color' }, { path: 'students', select: 'name admissionNumber' }, { path: 'createdBy', select: 'name' }]);
    res.status(201).json({ success: true, homework: hw });

    // Notify parents after response (fire-and-forget)
    const dueLabel = hw.dueDate ? new Date(hw.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : null;
    const subjectName = hw.subject?.name || '';
    const classLabel = hw.class ? `${hw.class.name}${hw.class.section ? ` ${hw.class.section}` : ''}` : '';
    const msg = `${hw.title}${subjectName ? ` (${subjectName})` : ''}${classLabel ? ` — ${classLabel}` : ''}${dueLabel ? `. Due: ${dueLabel}` : ''}.`;
    if (hw.assignedTo === 'selected' && hw.students?.length) {
      const ids = hw.students.map(s => s._id || s);
      notifyParentUsers(req.user.school, ids, 'notifyOnHomeworkAssigned', 'New Homework Assigned', msg, 'info');
      notifyStudentUsers(req.user.school, ids, 'notifyOnHomeworkAssigned', 'New Homework Assigned', msg, 'info');
    } else if (hw.class) {
      const classStudents = await Student.find({ currentClass: hw.class._id || hw.class, school: req.user.school, status: 'active' }).select('_id');
      const ids = classStudents.map(s => s._id);
      notifyParentUsers(req.user.school, ids, 'notifyOnHomeworkAssigned', 'New Homework Assigned', msg, 'info');
      notifyStudentUsers(req.user.school, ids, 'notifyOnHomeworkAssigned', 'New Homework Assigned', msg, 'info');
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/homework/:id/submissions', protect, checkSubscription, async (req, res) => {
  try {
    const HomeworkSubmission = require('../models/HomeworkSubmission');
    const submissions = await HomeworkSubmission.find({ homework: req.params.id, school: req.user.school })
      .populate('student', 'name admissionNumber rollNumber photo');
    res.json({ success: true, submissions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/homework/:id/submissions/:studentId', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'teacher'), async (req, res) => {
  try {
    const HomeworkSubmission = require('../models/HomeworkSubmission');
    const Homework = require('../models/Homework');
    const { status, note } = req.body;
    const sub = await HomeworkSubmission.findOneAndUpdate(
      { homework: req.params.id, student: req.params.studentId, school: req.user.school },
      { $set: { status, note: note || '', submittedAt: status === 'completed' ? new Date() : undefined, school: req.user.school, homework: req.params.id, student: req.params.studentId } },
      { upsert: true, new: true }
    ).populate('student', 'name admissionNumber');

    // Auto-complete or auto-revert homework based on all student statuses
    const hw = await Homework.findOne({ _id: req.params.id, school: req.user.school });
    if (hw && hw.status !== 'cancelled') {
      let totalStudents;
      if (hw.assignedTo === 'all') {
        totalStudents = await Student.countDocuments({ class: hw.class, school: hw.school });
      } else {
        totalStudents = hw.students.length;
      }
      if (totalStudents > 0) {
        const completedCount = await HomeworkSubmission.countDocuments({ homework: req.params.id, school: req.user.school, status: 'completed' });
        if (completedCount >= totalStudents && hw.status !== 'completed') {
          await Homework.findByIdAndUpdate(req.params.id, { status: 'completed' });
        } else if (completedCount < totalStudents && hw.status === 'completed') {
          await Homework.findByIdAndUpdate(req.params.id, { status: 'active' });
        }
      }
    }

    res.json({ success: true, submission: sub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/homework/:id/submissions/:studentId/attachment', protect, checkSubscription, upload.single('file'), async (req, res) => {
  try {
    const HomeworkSubmission = require('../models/HomeworkSubmission');
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';
    const fileUrl = `/uploads/${req.file.filename}`;
    const sub = await HomeworkSubmission.findOneAndUpdate(
      { homework: req.params.id, student: req.params.studentId, school: req.user.school },
      {
        $set: { school: req.user.school, homework: req.params.id, student: req.params.studentId },
        $push: { attachments: { url: fileUrl, name: req.file.originalname, fileType, uploadedAt: new Date() } },
      },
      { upsert: true, new: true }
    ).populate('student', 'name admissionNumber');
    res.json({ success: true, submission: sub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/homework/:id/submissions/:studentId/attachment/:attachmentId', protect, checkSubscription, async (req, res) => {
  try {
    const HomeworkSubmission = require('../models/HomeworkSubmission');
    const sub = await HomeworkSubmission.findOneAndUpdate(
      { homework: req.params.id, student: req.params.studentId, school: req.user.school },
      { $pull: { attachments: { _id: req.params.attachmentId } } },
      { new: true }
    ).populate('student', 'name admissionNumber');
    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });
    res.json({ success: true, submission: sub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/homework/:id/submit', protect, async (req, res) => {
  try {
    const HomeworkSubmission = require('../models/HomeworkSubmission');
    const Homework = require('../models/Homework');
    const { studentId, status, note } = req.body;
    const hw = await Homework.findOne({ _id: req.params.id, school: req.user.school });
    if (!hw) return res.status(404).json({ success: false, message: 'Not found' });
    const sub = await HomeworkSubmission.findOneAndUpdate(
      { homework: req.params.id, student: studentId, school: req.user.school },
      { $set: { status, note: note || '', submittedAt: status === 'completed' ? new Date() : undefined, school: req.user.school, homework: req.params.id, student: studentId } },
      { upsert: true, new: true }
    ).populate('student', 'name admissionNumber');
    res.json({ success: true, submission: sub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all homework + submission status for a specific student
router.get('/homework/student-summary', protect, checkSubscription, async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const HomeworkSubmission = require('../models/HomeworkSubmission');
    const Student = require('../models/Student');
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId required' });

    const student = await Student.findOne({ _id: studentId, school: req.user.school });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const homework = await Homework.find({
      school: req.user.school,
      $or: [
        { class: student.currentClass, assignedTo: 'all' },
        { students: studentId }
      ]
    })
      .populate('class', 'name section')
      .populate('subject', 'name color')
      .populate('createdBy', 'name')
      .sort({ dueDate: -1 });

    const submissions = await HomeworkSubmission.find({
      school: req.user.school,
      student: studentId,
      homework: { $in: homework.map(h => h._id) }
    });

    const subMap = {};
    submissions.forEach(s => { subMap[s.homework.toString()] = s; });

    const result = homework.map(hw => ({
      ...hw.toObject(),
      submission: subMap[hw._id.toString()] || null
    }));

    res.json({ success: true, homework: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/homework/:id', protect, checkSubscription, async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const hw = await Homework.findOne({ _id: req.params.id, school: req.user.school })
      .populate('class', 'name section')
      .populate('subject', 'name color')
      .populate('students', 'name admissionNumber rollNumber')
      .populate('createdBy', 'name');
    if (!hw) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, homework: hw });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/homework/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'teacher'), async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const hw = await Homework.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school }, req.body, { new: true }
    ).populate('class', 'name section').populate('subject', 'name color').populate('students', 'name admissionNumber').populate('createdBy', 'name');
    if (!hw) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, homework: hw });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/homework/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    await Homework.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/homework/:id/notify', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'teacher'), async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const hw = await Homework.findOne({ _id: req.params.id, school: req.user.school })
      .populate('class', 'name section').populate('subject', 'name')
      .populate('students', 'name guardians');
    if (!hw) return res.status(404).json({ success: false, message: 'Not found' });
    const school = await School.findById(req.user.school);
    const { sendSMS } = require('../utils/sms');
    let studentsToNotify;
    if (hw.assignedTo === 'selected' && hw.students.length > 0) {
      studentsToNotify = hw.students;
    } else {
      studentsToNotify = await Student.find({
        school: req.user.school, currentClass: hw.class._id, status: { $ne: 'dropped' }
      }).select('name guardians');
    }
    const dueStr = hw.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    let sent = 0;
    for (const student of studentsToNotify) {
      for (const guardian of (student.guardians || [])) {
        if (guardian.phone) {
          const msg = school.language === 'ta'
            ? `${hw.class.name} ${hw.class.section} வகுப்பிற்கு வீட்டுப்பாடம்: ${hw.title}. கடைசி தேதி: ${dueStr}.`
            : `Homework for ${hw.class.name} ${hw.class.section}: ${hw.title}. Due: ${dueStr}.`;
          try { await sendSMS(req.user.school, guardian.phone, 'homework', [hw.title], school.language || 'en'); sent++; } catch { }
        }
      }
    }
    await Homework.findByIdAndUpdate(hw._id, { notifiedAt: new Date() });
    res.json({ success: true, sent, message: `Notification sent to ${sent} guardian(s)` });
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

// ─── Teacher profile (class/subject assignments + permissions) ─────────────────
const teacherCtrl = require('../controllers/teacherController');
router.get('/teacher/my-profile', protect, authorize('teacher', 'principal'), teacherCtrl.getMyProfile);

// ─── Leave Requests ────────────────────────────────────────────────────────────

// Teacher: submit leave
router.post('/leaves', protect, authorize('teacher', 'principal', 'admin', 'correspondent'), async (req, res) => {
  try {
    const emp = await Employee.findOne({ user: req.user._id, school: req.user.school });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    const { leaveType, fromDate, toDate, days, reason } = req.body;
    const leave = await Leave.create({
      school: req.user.school, employee: emp._id, user: req.user._id,
      leaveType, fromDate, toDate, days: Number(days), reason
    });
    res.status(201).json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Teacher: my leave history
router.get('/leaves/my-leaves', protect, async (req, res) => {
  try {
    const leaves = await Leave.find({ user: req.user._id, school: req.user.school })
      .sort({ createdAt: -1 });
    res.json({ success: true, leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: all leaves
router.get('/leaves', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { status } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    const leaves = await Leave.find(query)
      .populate('employee', 'name employeeId')
      .sort({ createdAt: -1 });
    res.json({ success: true, leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: approve/reject leave
router.put('/leaves/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const leave = await Leave.findOne({ _id: req.params.id, school: req.user.school })
      .populate('employee');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

    leave.status = status;
    if (adminNote) leave.adminNote = adminNote;
    if (status === 'approved') {
      leave.approvedBy = req.user._id;
      leave.approvedAt = new Date();

      // Auto-mark attendance as 'leave' for each date in range
      const start = new Date(leave.fromDate);
      const end = new Date(leave.toDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        await Attendance.findOneAndUpdate(
          { school: req.user.school, employee: leave.employee._id, date: new Date(d) },
          { status: 'leave', markedBy: req.user._id },
          { upsert: true, new: true }
        );
      }
    }
    await leave.save();
    res.json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
