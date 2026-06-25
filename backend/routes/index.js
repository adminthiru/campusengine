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
const staffCheckinCtrl = require('../controllers/staffCheckinController');

// Models for simple CRUD
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Parent = require('../models/Parent');
const SmsLog = require('../models/SmsLog');
const { Expense, Transport } = require('../models/Expense');
const School = require('../models/School');
const { limitFor } = require('../utils/planLimits');
const escapeRegex = require('../utils/escapeRegex');
const User = require('../models/User');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const Visit = require('../models/Visit');
const OutPass = require('../models/OutPass');
const InventoryItem = require('../models/Inventory');
const PurchaseRequest = require('../models/PurchaseRequest');
const { v4: uuidv4 } = require('uuid');
const { notifyParentUsers, notifyStudentUsers } = require('../utils/notify');

// Multer setup — generate a safe random filename (never trust client filename:
// `../../x` would be a path-traversal write) and restrict to safe file types.
const UPLOAD_ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.xlsx', '.xls', '.csv', '.doc', '.docx', '.ppt', '.pptx', '.txt'];
// Blocked implicitly (not in the list): .html .htm .svg .js .php .exe .sh etc. — these
// can execute scripts when served from /uploads (stored XSS).
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    if (UPLOAD_ALLOWED_EXT.includes(ext)) return cb(null, true);
    cb(new Error('File type not allowed'));
  },
});

// ============== AUTH ==============
// Public self-signup removed — tenants are provisioned by the super admin
// Public self-service signup — creates a school tenant + its admin account and
// starts the free trial. The new tenant appears in the super-admin Tenants list.
router.post('/auth/register', authCtrl.registerSchool);
router.post('/auth/login', authCtrl.login);
router.post('/auth/init-super-admin', authCtrl.initSuperAdmin);
router.get('/auth/me', protect, authCtrl.getMe);
router.put('/auth/change-password', protect, authCtrl.changePassword);
router.put('/auth/profile', protect, authCtrl.updateProfile);
router.put('/auth/notifications/:notifId/read', protect, authCtrl.markNotification);

// ============== APP LOGINS (portal accounts for students/parents/teachers) ==============
const appLoginsCtrl = require('../controllers/appLoginsController');
const APP_LOGIN_ROLES = ['admin', 'correspondent'];
router.get('/app-logins', protect, authorize(...APP_LOGIN_ROLES), appLoginsCtrl.listAppLogins);
router.post('/app-logins', protect, authorize(...APP_LOGIN_ROLES), appLoginsCtrl.createAppLogin);
router.post('/app-logins/cleanup-legacy', protect, authorize(...APP_LOGIN_ROLES), appLoginsCtrl.cleanupLegacyLogins);
router.post('/app-logins/:id/reset-password', protect, authorize(...APP_LOGIN_ROLES), appLoginsCtrl.resetAppLoginPassword);
router.put('/app-logins/:id', protect, authorize(...APP_LOGIN_ROLES), appLoginsCtrl.updateAppLogin);
router.delete('/app-logins/:id', protect, authorize(...APP_LOGIN_ROLES), appLoginsCtrl.deleteAppLogin);

// ============== SCHOOL ==============
router.get('/school', protect, schoolCtrl.getSchool);
router.post('/school/setup', protect, authorize('admin', 'correspondent'), schoolCtrl.setupSchool);
router.put('/school', protect, authorize('admin', 'correspondent', 'super_admin'), schoolCtrl.updateSchool);
router.get('/school/dashboard', protect, checkSubscription, schoolCtrl.getDashboardStats);
router.post('/school/upload-logo', protect, upload.single('logo'), schoolCtrl.uploadLogo);

// PDF template preview — generates a sample PDF with current school branding
router.get('/school/pdf-preview', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { generatePaySlip } = require('../utils/pdf');
    const school = await School.findById(req.user.school);
    const sampleSalary = {
      month: new Date().getMonth() + 1, year: new Date().getFullYear(),
      slipNumber: 'SAMPLE-001', workingDays: 30, presentDays: 28, leaveDays: 2,
      earnings: { basic: 25000, hra: 5000, da: 2000, otherAllowances: 1000, overtime: 0, bonus: 0 },
      deductions: { pf: 3000, esi: 250, tax: 0, loan: 0, lossOfPay: 1667, other: 0 },
      grossSalary: 33000, totalDeductions: 4917, netSalary: 28083,
    };
    const sampleEmployee = { name: 'Sample Employee', employeeId: 'EMP001', designation: 'Teacher', role: 'teacher' };
    const pdfBuffer = await generatePaySlip(sampleSalary, sampleEmployee, school);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="preview.pdf"' });
    res.send(pdfBuffer);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Grade config
router.put('/school/grade-config', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { gradeConfig: req.body }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Leave config
router.put('/school/leave-config', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { leaveTypes: req.body.leaveTypes }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Selectable academic years for the header: the years that actually contain
// data plus the current academic year (computed from today under the school's
// boundary). No empty "range" years — a school only sees years it has used.
router.get('/academic-years', protect, async (req, res) => {
  try {
    const school = await School.findById(req.user.school).select('academicYear');
    const startMonth = school?.academicYear?.startMonth || 6;
    const endMonth = school?.academicYear?.endMonth || 3;
    const { academicYearForDate } = require('../utils/academicYear');
    const current = academicYearForDate(new Date(), startMonth, endMonth);

    const { Exam } = require('../models/Exam');
    const FeeCollection = require('../models/FeeCollection');
    const Timetable = require('../models/Timetable');
    const dataYears = new Set();
    const lists = await Promise.all([
      FeeCollection.distinct('academicYear', { school: req.user.school }),
      Exam.distinct('academicYear', { school: req.user.school }),
      Timetable.distinct('academicYear', { school: req.user.school }),
    ]);
    lists.forEach(arr => arr.forEach(y => { if (y) dataYears.add(y); }));

    const set = new Set(dataYears);
    if (current) set.add(current); // always allow the live year, even if empty
    const years = [...set].filter(Boolean).sort().reverse();
    const latestWithData = [...dataYears].filter(Boolean).sort().reverse()[0] || null;

    res.json({ success: true, years, current, latestWithData, startMonth, endMonth });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/academic-year', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { startMonth, endMonth, current } = req.body;
    const update = {};
    if (startMonth != null) update['academicYear.startMonth'] = Number(startMonth);
    if (endMonth != null) update['academicYear.endMonth'] = Number(endMonth);
    if (current != null) update['academicYear.current'] = current;
    const school = await School.findByIdAndUpdate(req.user.school, update, { returnDocument: 'after' });

    // Re-derive existing records' academicYear from their dates under the new
    // boundary so changing the start/end months never strands historical data.
    let retag = null;
    if (startMonth != null || endMonth != null) {
      const sm = school.academicYear?.startMonth || 6;
      const em = school.academicYear?.endMonth || 3;
      const { retagAcademicYears } = require('../utils/academicYear');
      retag = await retagAcademicYears(req.user.school, sm, em);
    }
    res.json({ success: true, school, retag });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/fee-terms', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { feeTerms: req.body.feeTerms }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/staff-attendance-timing', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { onTimeBy, lateFrom, halfDayFrom, schoolEndTime, enabled } = req.body;
    const school = await School.findByIdAndUpdate(
      req.user.school,
      { staffAttendanceTiming: { onTimeBy, lateFrom, halfDayFrom, schoolEndTime, enabled: enabled !== false, configured: true } },
      { returnDocument: 'after' }
    );
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Subscription (school-admin billing) + active plans
const subCtrl = require('../controllers/subscriptionController');
const superAdminCtrl = require('../controllers/superAdminController');
router.get('/plans', protect, superAdminCtrl.getActivePlans);
router.get('/subscription/my', protect, subCtrl.getMySubscription);
router.get('/subscription/payment-methods', protect, subCtrl.getPaymentMethods);
router.post('/subscription/select-plan', protect, authorize('admin', 'correspondent'), subCtrl.selectPlan);
router.post('/subscription/create-order', protect, subCtrl.createOrder);
router.post('/subscription/verify', protect, subCtrl.verifyPayment);
router.get('/subscription/payments/:id/invoice', protect, subCtrl.getInvoicePdf);

// ============== EMPLOYEES ==============
router.get('/employees', protect, checkSubscription, empCtrl.getEmployees);
router.get('/employees/next-code', protect, checkSubscription, empCtrl.suggestEmployeeId);
router.post('/employees', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), empCtrl.createEmployee);
router.get('/employees/:id', protect, checkSubscription, empCtrl.getEmployee);
router.put('/employees/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), empCtrl.updateEmployee);
router.delete('/employees/:id', protect, checkSubscription, authorize('admin', 'correspondent'), empCtrl.deleteEmployee);
router.post('/employees/:id/job-offer-pdf', protect, empCtrl.getJobOfferPDF);
router.post('/employees/:id/tasks', protect, authorize('admin', 'correspondent', 'principal'), empCtrl.assignTask);
router.put('/employees/:id/tasks/:taskId', protect, empCtrl.updateTask);
router.post('/employees/:id/upload-photo', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    // Scope to the caller's school so one tenant can't set another tenant's photo.
    const emp = await Employee.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { photo: url });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
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
    const staffCap = limitFor(school, 'staff');   // 0 = unlimited
    const validRoles = ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'other'];
    for (let i = 0; i < employees.length; i++) {
      try {
        if (staffCap && baseCount >= staffCap) throw new Error(`Plan limit reached (${staffCap} employees). Upgrade to add more.`);
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
        // Login accounts are created selectively in Settings → App Logins.
        baseCount++;
        results.created++;
      } catch (err) { results.failed++; results.errors.push(`Row ${i + 2}: ${err.message}`); }
    }
    res.json({ success: true, ...results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== STUDENTS ==============
router.get('/students', protect, checkSubscription, stuCtrl.getStudents);
router.get('/students/next-codes', protect, checkSubscription, stuCtrl.suggestCodes);
router.post('/students', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), stuCtrl.createStudent);
router.get('/students/:id', protect, checkSubscription, stuCtrl.getStudent);
router.put('/students/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), stuCtrl.updateStudent);
router.delete('/students/:id', protect, checkSubscription, authorize('admin', 'correspondent'), stuCtrl.deleteStudent);
router.post('/students/promote', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), stuCtrl.promoteStudents);
router.post('/students/:id/admission-letter-pdf', protect, stuCtrl.getAdmissionLetterPDF);
router.post('/students/id-card-data', protect, stuCtrl.getIDCardData);
router.post('/students/:id/upload-photo', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    // Scope to the caller's school so one tenant can't set another tenant's photo.
    const stu = await Student.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { photo: url });
    if (!stu) return res.status(404).json({ success: false, message: 'Student not found' });
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
    const studentCap = limitFor(school, 'students');   // 0 = unlimited
    for (let i = 0; i < students.length; i++) {
      try {
        if (studentCap && baseCount >= studentCap) throw new Error(`Plan limit reached (${studentCap} students). Upgrade to add more.`);
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
    if (search) { const s = escapeRegex(search); query.$or = [{ name: new RegExp(s, 'i') }, { phone: new RegExp(s, 'i') }]; }
    const parents = await Parent.find(query).sort({ name: 1 });

    // Query students directly (don't rely on parent.students[] which can be stale)
    const students = await Student.find({
      primaryGuardian: { $in: primaryIds }, school: req.user.school
    }).populate('currentClass', 'name section').select('name admissionNumber photo currentClass primaryGuardian');

    // Group students by their primaryGuardian ID
    const byParent = {};
    students.forEach(s => {
      const pid = s.primaryGuardian.toString();
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push({ _id: s._id, name: s.name, admissionNumber: s.admissionNumber, photo: s.photo, currentClass: s.currentClass });
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
    const school = await School.findByIdAndUpdate(req.user.school, { parentPermissions: req.body }, { returnDocument: 'after' });
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
      { returnDocument: 'after' }
    ).populate('student', 'name admissionNumber').populate('parent', 'name phone');
    if (!leave) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== STUDENT PORTAL ==============

// Student permissions update
router.put('/school/student-permissions', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, { studentPermissions: req.body }, { returnDocument: 'after' });
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
    if (rest.name != null) rest.name = String(rest.name).trim();
    if (rest.section != null) rest.section = String(rest.section).trim();
    const cls = await Class.create({ ...rest, subjects: subjects || [], subjectTeachers: subjectTeachers || [], school: req.user.school, academicYear });
    if (subjects?.length) {
      await Subject.updateMany({ _id: { $in: subjects } }, { $addToSet: { classes: cls._id } });
    }
    res.status(201).json({ success: true, class: cls });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: `A class "${String(req.body.name || '').trim()}${req.body.section ? ' ' + String(req.body.section).trim() : ''}" already exists for ${req.body.academicYear || 'this academic year'}.` });
    res.status(500).json({ success: false, message: err.message });
  }
});
router.put('/classes/:id', protect, checkSubscription, async (req, res) => {
  try {
    const { name, section, capacity, room, classTeacher, academicYear, fees, subjects, subjectTeachers } = req.body;
    const $set = { name: name != null ? String(name).trim() : name, section: section != null ? String(section).trim() : section, capacity, room, academicYear };
    if (fees) $set.fees = fees;
    if (subjects !== undefined) $set.subjects = subjects;
    if (subjectTeachers !== undefined) $set.subjectTeachers = subjectTeachers;
    const $unset = {};
    if (classTeacher) $set.classTeacher = classTeacher; else $unset.classTeacher = '';
    const update = Object.keys($unset).length ? { $set, $unset } : { $set };
    const cls = await Class.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, update, { returnDocument: 'after' });
    // Sync Subject.classes — remove this class from all subjects then re-add selected ones
    if (subjects !== undefined) {
      await Subject.updateMany({ school: req.user.school }, { $pull: { classes: cls._id } });
      if (subjects.length) {
        await Subject.updateMany({ _id: { $in: subjects } }, { $addToSet: { classes: cls._id } });
      }
    }
    res.json({ success: true, class: cls });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: `A class "${String(req.body.name || '').trim()}${req.body.section ? ' ' + String(req.body.section).trim() : ''}" already exists for ${req.body.academicYear || 'this academic year'}.` });
    res.status(500).json({ success: false, message: err.message });
  }
});
router.delete('/classes/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    await Class.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
// Per-class daily period structure (periods + breaks template for the timetable)
router.put('/classes/:id/period-structure', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { periodStructure } = req.body;
    const clean = Array.isArray(periodStructure) ? periodStructure.map(s => ({
      kind: s.kind === 'break' ? 'break' : 'period',
      name: s.name || '',
      startTime: s.startTime || '',
      endTime: s.endTime || '',
    })) : [];
    const cls = await Class.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { periodStructure: clean }, { returnDocument: 'after' }
    );
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, class: cls });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== SUBJECTS ==============
router.get('/subjects', protect, checkSubscription, async (req, res) => {
  try {
    const { classId } = req.query;
    const query = { school: req.user.school };
    if (classId) query.classes = classId;
    const subjects = await Subject.find(query).populate('teacher', 'name').populate('teachers', 'name designation').populate('classes', 'name section');
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
    const subject = await Subject.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, req.body, { returnDocument: 'after' });
    res.json({ success: true, subject });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/subjects/:id', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    await Subject.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== STAFF CHECK-IN / CHECK-OUT (geo-tagged) ==============
// Self-service punches for teachers & staff (mobile app)
router.post('/staff-attendance/check-in',  protect, checkSubscription, staffCheckinCtrl.checkIn);
router.post('/staff-attendance/check-out', protect, checkSubscription, staffCheckinCtrl.checkOut);
router.get('/staff-attendance/today',      protect, staffCheckinCtrl.getToday);
// Admin: track staff login time + location
router.get('/staff-attendance', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), staffCheckinCtrl.listCheckins);

// ============== ATTENDANCE ==============
router.post('/attendance/student', protect, checkSubscription, attCtrl.markStudentAttendance);
router.post('/attendance/employee', protect, checkSubscription, authorize('admin', 'correspondent', 'principal', 'accountant'), attCtrl.markEmployeeAttendance);
router.get('/attendance', protect, checkSubscription, attCtrl.getAttendance);
router.get('/attendance/summary', protect, checkSubscription, attCtrl.getStudentAttendanceSummary);

// Working days calculator — returns actual working days for a month
router.get('/attendance/working-days', protect, async (req, res) => {
  try {
    const { year, month, classId } = req.query;
    if (!year || !month) return res.status(400).json({ success: false, message: 'year and month required' });
    const schoolId = req.user.school;
    const schoolDoc = await School.findById(schoolId).select('workingDays');
    let satSchedule = 'school_default';
    if (classId) {
      const classDoc = await require('../models/Class').findById(classId).select('saturdaySchedule');
      satSchedule = classDoc?.saturdaySchedule || 'school_default';
    }
    const { getWorkingDaysForMonth } = require('../utils/holidays');
    const result = await getWorkingDaysForMonth(schoolId, Number(year), Number(month), schoolDoc?.workingDays || {}, satSchedule);
    res.json({ success: true, ...result, year: Number(year), month: Number(month) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

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

// Employee leave balance — returns both monthly and year-to-date CL/SL usage per employee
router.get('/attendance/leave-balance', protect, checkSubscription, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = Number(month), y = Number(year);

    const monthFrom = new Date(y, m - 1, 1);
    const monthTo   = new Date(y, m, 1);
    const yearFrom  = new Date(y, 0, 1);
    const yearTo    = new Date(y + 1, 0, 1);

    // Fetch month records and year records in parallel
    const [monthRecords, yearRecords] = await Promise.all([
      Attendance.find({ school: req.user.school, type: 'employee', date: { $gte: monthFrom, $lt: monthTo } }),
      Attendance.find({ school: req.user.school, type: 'employee', date: { $gte: yearFrom,  $lt: yearTo  } }),
    ]);

    const tally = (records) => {
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
      return used;
    };

    res.json({ success: true, used: tally(monthRecords), usedYtd: tally(yearRecords) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== FEES ==============
router.get('/fees', protect, checkSubscription, feesCtrl.getFees);
router.get('/fees/payment-summary', protect, checkSubscription, feesCtrl.getPaymentSummary);
router.get('/fees/report', protect, checkSubscription, feesCtrl.getFeesReport);
router.get('/fees/unsynced-count', protect, checkSubscription, feesCtrl.getUnsyncedCount);
router.post('/fees/sync', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.syncClassStudents);
router.post('/fees/apply-structure', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.applyClassFeeStructure);
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
router.post('/fees/:id/clear-discount', protect, checkSubscription, authorize('admin', 'correspondent', 'accountant'), feesCtrl.clearTermDiscount);
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
router.get('/timetable/teacher-busy', protect, checkSubscription, ttCtrl.getTeacherBusy);
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
      { upsert: true, returnDocument: 'after' }
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
      { _id: req.params.id, school: req.user.school }, req.body, { returnDocument: 'after' }
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
    const { category, startDate, endDate } = req.query;
    const query = { school: req.user.school };
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.date.$lte = e; }
    }
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
    const exp = await Expense.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, req.body, { returnDocument: 'after' });
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
    // Backfill missing routeNumbers for vehicles added before auto-generation
    const missing = await Transport.find({ school: req.user.school, routeNumber: { $in: [null, ''] } });
    const allCount = await Transport.countDocuments({ school: req.user.school });
    for (let i = 0; i < missing.length; i++) {
      missing[i].routeNumber = String(allCount - missing.length + i + 1).padStart(2, '0');
      await missing[i].save();
    }
    const routes = await Transport.find({ school: req.user.school }).sort({ routeNumber: 1 });
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
    let { routeNumber } = req.body;
    if (!routeNumber?.trim()) {
      // Auto-generate sequential assign number: 01, 02, 03...
      const count = await Transport.countDocuments({ school: req.user.school });
      routeNumber = String(count + 1).padStart(2, '0');
    }
    const route = await Transport.create({ ...req.body, routeNumber, school: req.user.school });
    res.status(201).json({ success: true, route });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/transport/:id', protect, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    const route = await Transport.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school }, req.body, { returnDocument: 'after' }
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
router.post('/sms/recipients/preview', protect, authorize('admin', 'correspondent', 'principal'), smsCtrl.previewRecipients);
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

// ============== ACCESS CONTROL (custom staff logins) ==============
const accessCtrl = require('../controllers/accessController');
const ACCESS_ADMIN = ['admin', 'correspondent'];
router.get('/access/modules', protect, authorize(...ACCESS_ADMIN), accessCtrl.getModules);
router.get('/access-roles', protect, authorize(...ACCESS_ADMIN), accessCtrl.listAccessRoles);
router.post('/access-roles', protect, authorize(...ACCESS_ADMIN), accessCtrl.createAccessRole);
router.put('/access-roles/:id', protect, authorize(...ACCESS_ADMIN), accessCtrl.updateAccessRole);
router.delete('/access-roles/:id', protect, authorize(...ACCESS_ADMIN), accessCtrl.deleteAccessRole);
router.get('/staff-logins', protect, authorize(...ACCESS_ADMIN), accessCtrl.listStaffLogins);
router.post('/staff-logins', protect, authorize(...ACCESS_ADMIN), accessCtrl.createStaffLogin);
router.put('/staff-logins/:id', protect, authorize(...ACCESS_ADMIN), accessCtrl.updateStaffLogin);
router.post('/staff-logins/:id/reset-password', protect, authorize(...ACCESS_ADMIN), accessCtrl.resetStaffPassword);
router.delete('/staff-logins/:id', protect, authorize(...ACCESS_ADMIN), accessCtrl.deleteStaffLogin);

// ============== HOMEWORK ==============
router.get('/homework', protect, checkSubscription, async (req, res) => {
  try {
    const Homework = require('../models/Homework');
    const { classId, date, status } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;

    // Teachers only see homework for the classes they actually teach (class
    // teacher or per-class subject teacher). Admin/correspondent/principal see all.
    if (req.user.role === 'teacher') {
      const Employee = require('../models/Employee');
      const Class = require('../models/Class');
      const emp = await Employee.findOne({ user: req.user._id, school: req.user.school }).select('_id');
      const taught = emp
        ? await Class.find({ school: req.user.school, $or: [{ classTeacher: emp._id }, { 'subjectTeachers.teacher': emp._id }] }).select('_id')
        : [];
      const taughtIds = taught.map(c => String(c._id));
      if (classId) {
        if (!taughtIds.includes(String(classId))) return res.json({ success: true, homework: [] });
        query.class = classId;
      } else {
        query.class = { $in: taughtIds };
      }
    } else if (classId) {
      query.class = classId;
    }
    if (date) {
      // Filter by assignedDate OR dueDate matching the given date
      const d    = new Date(date);
      const next = new Date(date); next.setDate(next.getDate() + 1);
      query.$or = [
        { assignedDate: { $gte: d, $lt: next } },
        { dueDate:      { $gte: d, $lt: next } },
      ];
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
      { upsert: true, returnDocument: 'after' }
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
      { upsert: true, returnDocument: 'after' }
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
      { returnDocument: 'after' }
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
      { upsert: true, returnDocument: 'after' }
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
      { _id: req.params.id, school: req.user.school }, req.body, { returnDocument: 'after' }
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
const SA = [protect, authorize('super_admin')];
// Tenants
router.get('/super-admin/schools', ...SA, superAdminCtrl.listSchools);
router.post('/super-admin/schools', ...SA, superAdminCtrl.createTenant);
router.get('/super-admin/schools/:id', ...SA, superAdminCtrl.getSchool);
router.put('/super-admin/schools/:id', ...SA, superAdminCtrl.updateSchool);
router.post('/super-admin/schools/:id/suspend', ...SA, superAdminCtrl.suspendSchool);
router.post('/super-admin/schools/:id/reactivate', ...SA, superAdminCtrl.reactivateSchool);
router.post('/super-admin/schools/:id/reset-admin-password', ...SA, superAdminCtrl.resetAdminPassword);
router.put('/super-admin/schools/:id/subscription', ...SA, superAdminCtrl.updateSubscription);
router.post('/super-admin/schools/:id/record-payment', ...SA, superAdminCtrl.recordPayment);
// Stats / revenue
router.get('/super-admin/stats', ...SA, superAdminCtrl.getStats);
router.get('/super-admin/payments', ...SA, superAdminCtrl.listPayments);
// Payment / collection settings (owner's receiving accounts)
router.get('/super-admin/payment-settings', ...SA, superAdminCtrl.getPaymentSettings);
router.put('/super-admin/payment-settings', ...SA, superAdminCtrl.updatePaymentSettings);
// Plans
router.get('/super-admin/plans', ...SA, superAdminCtrl.listPlans);
router.post('/super-admin/plans', ...SA, superAdminCtrl.createPlan);
router.put('/super-admin/plans/:id', ...SA, superAdminCtrl.updatePlan);
router.delete('/super-admin/plans/:id', ...SA, superAdminCtrl.deletePlan);

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
    // Tenant isolation: a school admin may only toggle users in their own school.
    if (req.user.role !== 'super_admin' && String(user.school) !== String(req.user.school)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    // Don't let an admin disable their own account.
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot change your own status' });
    }
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

// Teacher: my leave balance (respects carry-forward setting per leave type)
router.get('/leaves/my-balance', protect, async (req, res) => {
  try {
    const school = await School.findById(req.user.school).select('leaveTypes');
    const leaveTypes = school?.leaveTypes ?? [];

    const getType = code => leaveTypes.find(l => l.code === code.toLowerCase());
    const clType = getType('cl');
    const slType = getType('sl');

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    const yearStart  = new Date(year, 0, 1);
    const yearEnd    = new Date(year + 1, 0, 1);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);

    // Get this teacher's employee record
    const emp = await Employee.findOne({ user: req.user._id, school: req.user.school }).select('_id');

    // Count used days from attendance records only — single source of truth.
    // Captures both admin manual marks ('cl'/'sl') and app-approved leaves
    // (approval writes 'cl'/'sl' directly into attendance, so no double-count needed).
    const countFromAttendance = async (statusCode, from, to) => {
      if (!emp) return 0;
      const docs = await Attendance.find({
        school: req.user.school, type: 'employee',
        date: { $gte: from, $lt: to }
      }).select('records');
      let total = 0;
      for (const att of docs) {
        for (const rec of att.records) {
          if (rec.employee?.toString() === emp._id.toString() && rec.status === statusCode) {
            total++;
          }
        }
      }
      return total;
    };

    // Pending: teacher applied but not yet approved — not yet in attendance
    const pendingFromLeave = async (leaveTypeCode, from, to) => {
      const result = await Leave.aggregate([
        { $match: { user: req.user._id, school: req.user.school,
                    leaveType: leaveTypeCode, status: 'pending',
                    fromDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$days' } } }
      ]);
      return result[0]?.total || 0;
    };

    const calcBalance = async (typeDoc, leaveTypeCode, attCode) => {
      const dpm          = typeDoc?.daysPerMonth ?? 0;
      const carryForward = typeDoc?.carryForward ?? false;

      const [from, to] = carryForward
        ? [yearStart, yearEnd]
        : [monthStart, monthEnd];

      const entitled = carryForward ? dpm * month : dpm;
      const used     = await countFromAttendance(attCode, from, to);
      const pending  = await pendingFromLeave(leaveTypeCode, from, to);

      return {
        allocated: entitled, used, pending,
        available: Math.max(0, entitled - used - pending),
        carryForward: carryForward ?? false,
      };
    };

    const [cl, sl] = await Promise.all([
      calcBalance(clType, 'CL', 'cl'),
      calcBalance(slType, 'SL', 'sl'),
    ]);

    res.json({ success: true, balance: { cl, sl } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Teacher: update own pending leave
router.put('/leaves/my-leaves/:id', protect, async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, user: req.user._id, school: req.user.school });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending leaves can be edited' });
    const { leaveType, fromDate, toDate, days, reason } = req.body;
    if (leaveType) leave.leaveType = leaveType;
    if (fromDate)  leave.fromDate  = fromDate;
    if (toDate)    leave.toDate    = toDate;
    if (days)      leave.days      = Number(days);
    if (reason)    leave.reason    = reason;
    await leave.save();
    res.json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Teacher: delete own pending leave
router.delete('/leaves/my-leaves/:id', protect, async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, user: req.user._id, school: req.user.school });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending leaves can be deleted' });
    await leave.deleteOne();
    res.json({ success: true });
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

      // Map leave type to attendance status
      // CL → 'cl', SL → 'sl', LOP → 'absent'
      const attStatus = leave.leaveType === 'CL' ? 'cl'
                      : leave.leaveType === 'SL' ? 'sl'
                      : 'absent'; // LOP

      const empId = leave.employee._id;
      // Normalize to UTC midnight using LOCAL date (server runs in IST, same as admin UI)
      const toUTCMidnight = dt => {
        const local = new Date(dt);
        const y = local.getFullYear();
        const m = String(local.getMonth() + 1).padStart(2, '0');
        const d = String(local.getDate()).padStart(2, '0');
        return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
      };
      const start = toUTCMidnight(leave.fromDate);
      const end   = toUTCMidnight(leave.toDate);

      // Mark each day in the leave range in the type:'employee' attendance records
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayDate  = new Date(d);
        const existing = await Attendance.findOne({
          school: req.user.school, type: 'employee', date: dayDate,
        });

        if (existing) {
          const idx = existing.records.findIndex(r => r.employee?.toString() === empId.toString());
          if (idx !== -1) {
            existing.records[idx].status  = attStatus;
            existing.records[idx].remarks = `Leave: ${leave.leaveType}`;
          } else {
            existing.records.push({ employee: empId, status: attStatus, remarks: `Leave: ${leave.leaveType}` });
          }
          existing.markedBy = req.user._id;
          await existing.save();
        } else {
          // No attendance document for this day — create one for just this employee
          await Attendance.create({
            school: req.user.school, type: 'employee', date: dayDate,
            markedBy: req.user._id,
            records: [{ employee: empId, status: attStatus, remarks: `Leave: ${leave.leaveType}` }],
          });
        }
      }
    }

    await leave.save();
    res.json({ success: true, leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== LIBRARY ==============

const calcFine = (dueDate, finePerDay = 2) => {
  if (!dueDate) return 0;
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  if (now <= due) return 0;
  return Math.max(0, Math.ceil((now - due) / 86400000) * finePerDay);
};

// Save expense categories
router.put('/school/expense-categories', protect, authorize('admin', 'correspondent', 'accountant'), async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ success: false, message: 'categories must be an array' });
    const school = await School.findByIdAndUpdate(req.user.school, { expenseCategories: categories }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/inventory-categories', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ success: false, message: 'categories must be an array' });
    const school = await School.findByIdAndUpdate(req.user.school, { inventoryCategories: categories }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/library-categories', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ success: false, message: 'categories must be an array' });
    const school = await School.findByIdAndUpdate(req.user.school, { libraryCategories: categories }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/school/inventory-locations', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { locations } = req.body;
    if (!Array.isArray(locations)) return res.status(400).json({ success: false, message: 'locations must be an array' });
    const school = await School.findByIdAndUpdate(req.user.school, { inventoryLocations: locations }, { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Save library config (fine rate)
router.put('/school/library-config', protect, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { finePerDay } = req.body;
    const school = await School.findByIdAndUpdate(
      req.user.school,
      { 'libraryConfig.finePerDay': Number(finePerDay) || 2 },
      { returnDocument: 'after' }
    );
    res.json({ success: true, school });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /library/books
router.get('/library/books', protect, checkSubscription, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const query = { school: req.user.school };
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
      ];
    }
    const books = await Book.find(query).sort({ title: 1 });
    res.json({ success: true, books });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /library/books
router.post('/library/books', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { title, author, isbn, category, publisher, year, price, totalCopies, location, description, status } = req.body;
    const copies = Number(totalCopies) || 1;
    const book = await Book.create({
      school: req.user.school, title, author, isbn, category, publisher,
      year: year ? Number(year) : undefined,
      price: (price !== undefined && price !== '' && price !== null) ? Number(price) : undefined,
      totalCopies: copies, availableCopies: copies,
      location, description, status: status || 'available',
    });
    res.status(201).json({ success: true, book });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /library/books/:id
router.put('/library/books/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const existing = await Book.findOne({ _id: req.params.id, school: req.user.school });
    if (!existing) return res.status(404).json({ success: false, message: 'Book not found' });

    const { totalCopies, ...rest } = req.body;
    if (totalCopies !== undefined) {
      const newTotal = Number(totalCopies);
      const diff = newTotal - existing.totalCopies;
      existing.totalCopies = newTotal;
      existing.availableCopies = Math.max(0, existing.availableCopies + diff);
    }
    Object.assign(existing, rest);
    await existing.save();
    res.json({ success: true, book: existing });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /library/books/:id
router.delete('/library/books/:id', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, school: req.user.school });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
    if (book.availableCopies !== book.totalCopies) {
      return res.status(400).json({ success: false, message: 'Cannot delete book — some copies are currently issued.' });
    }
    await book.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /library/issues
router.get('/library/issues', protect, checkSubscription, async (req, res) => {
  try {
    const { status, borrowerType, search } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (borrowerType) query.borrowerType = borrowerType;
    let issues = await BookIssue.find(query)
      .populate('book', 'title author isbn category')
      .populate({ path: 'student', select: 'name admissionNumber photo rollNumber currentClass', populate: { path: 'currentClass', select: 'name section' } })
      .populate('employee', 'name employeeId photo designation role')
      .populate('issuedBy', 'name')
      .populate('returnedTo', 'name')
      .sort({ createdAt: -1 });
    if (search) {
      const q = search.toLowerCase();
      issues = issues.filter(i =>
        i.book?.title?.toLowerCase().includes(q) ||
        i.book?.author?.toLowerCase().includes(q) ||
        i.book?.isbn?.toLowerCase().includes(q) ||
        i.student?.name?.toLowerCase().includes(q) ||
        i.student?.admissionNumber?.toLowerCase().includes(q) ||
        i.employee?.name?.toLowerCase().includes(q) ||
        i.employee?.employeeId?.toLowerCase().includes(q)
      );
    }
    res.json({ success: true, issues });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /library/issues
router.post('/library/issues', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { bookId, borrowerType, studentId, employeeId, dueDate } = req.body;
    if (!bookId || !borrowerType || !dueDate) {
      return res.status(400).json({ success: false, message: 'bookId, borrowerType, and dueDate are required' });
    }
    const book = await Book.findOne({ _id: bookId, school: req.user.school });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
    if (book.availableCopies < 1) {
      return res.status(400).json({ success: false, message: 'No copies available for issuing.' });
    }
    const issueData = {
      school: req.user.school, book: bookId, borrowerType, dueDate,
      issuedBy: req.user._id,
    };
    if (borrowerType === 'student') {
      if (!studentId) return res.status(400).json({ success: false, message: 'studentId required for student borrower' });
      issueData.student = studentId;
    } else {
      if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId required for employee borrower' });
      issueData.employee = employeeId;
    }
    const issue = await BookIssue.create(issueData);
    book.availableCopies -= 1;
    await book.save();
    await issue.populate([
      { path: 'book', select: 'title author isbn category' },
      { path: 'student', select: 'name admissionNumber' },
      { path: 'employee', select: 'name employeeId' },
      { path: 'issuedBy', select: 'name' },
    ]);
    res.status(201).json({ success: true, issue });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /library/issues/:id/return
router.put('/library/issues/:id/return', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const issue = await BookIssue.findOne({ _id: req.params.id, school: req.user.school });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue record not found' });
    if (issue.status !== 'issued' && issue.status !== 'overdue') {
      return res.status(400).json({ success: false, message: 'Book is not currently issued' });
    }
    const schoolCfg  = await School.findById(req.user.school).select('libraryConfig');
    const finePerDay = schoolCfg?.libraryConfig?.finePerDay ?? 2;
    const now = new Date();
    issue.returnDate  = now;
    issue.status      = 'returned';
    issue.returnedTo  = req.user._id;
    // Use admin-provided fine if given, otherwise auto-calculate with school rate
    issue.fine        = req.body.fine != null ? Number(req.body.fine) : calcFine(issue.dueDate, finePerDay);
    if (req.body.finePaid != null) issue.finePaid = !!req.body.finePaid;
    await issue.save();

    const book = await Book.findById(issue.book);
    if (book) { book.availableCopies += 1; await book.save(); }

    await issue.populate([
      { path: 'book', select: 'title author isbn' },
      { path: 'student', select: 'name admissionNumber' },
      { path: 'employee', select: 'name employeeId' },
    ]);
    res.json({ success: true, issue });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /library/issues/:id/status — mark as lost or damaged
router.put('/library/issues/:id/status', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { status, fine, notes } = req.body;
    if (!['lost', 'damaged'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be lost or damaged' });
    }
    const issue = await BookIssue.findOne({ _id: req.params.id, school: req.user.school });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue record not found' });

    issue.status = status;
    if (fine !== undefined) issue.fine = Number(fine);
    if (notes) issue.notes = notes;

    // For lost: do not restore availableCopies. For damaged: admin decides (don't restore automatically)
    if (status === 'damaged') {
      // Admin may choose to restore copies manually via edit book; don't auto-restore
    }
    await issue.save();
    res.json({ success: true, issue });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /library/issues/:id/renewal/:rid — approve or reject a renewal request
router.put('/library/issues/:id/renewal/:rid', protect, checkSubscription, authorize('admin', 'correspondent', 'principal'), async (req, res) => {
  try {
    const { action, newDueDate, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject' });
    }
    const issue = await BookIssue.findOne({ _id: req.params.id, school: req.user.school });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue record not found' });

    const renewal = issue.renewalRequests.id(req.params.rid);
    if (!renewal) return res.status(404).json({ success: false, message: 'Renewal request not found' });

    if (action === 'approve') {
      if (!newDueDate) return res.status(400).json({ success: false, message: 'newDueDate required for approval' });
      renewal.status = 'approved';
      renewal.newDueDate = new Date(newDueDate);
      if (note) renewal.note = note;
      issue.dueDate = new Date(newDueDate);
    } else {
      renewal.status = 'rejected';
      if (note) renewal.note = note;
    }
    await issue.save();
    res.json({ success: true, issue });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /library/overdue
router.get('/library/overdue', protect, checkSubscription, async (req, res) => {
  try {
    const now = new Date();
    const issues = await BookIssue.find({
      school: req.user.school, status: 'issued', dueDate: { $lt: now },
    })
      .populate('book', 'title author isbn category')
      .populate('student', 'name admissionNumber photo')
      .populate('employee', 'name employeeId photo')
      .sort({ dueDate: 1 });

    const schoolCfg  = await School.findById(req.user.school).select('libraryConfig');
    const finePerDay = schoolCfg?.libraryConfig?.finePerDay ?? 2;
    const withFines = issues.map(issue => {
      const obj = issue.toObject();
      obj.calculatedFine = calcFine(issue.dueDate, finePerDay);
      return obj;
    });
    res.json({ success: true, issues: withFines, finePerDay });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /library/reports
router.get('/library/reports', protect, checkSubscription, async (req, res) => {
  try {
    const school = req.user.school;
    const populateBorrower = [
      { path: 'student', select: 'name admissionNumber' },
      { path: 'employee', select: 'name employeeId designation' },
      { path: 'book', select: 'title author' },
    ];
    const [books, issuedCount, finesPaid, currentlyOverdue, overdueReturned, damaged, lost] = await Promise.all([
      Book.find({ school }),
      BookIssue.countDocuments({ school, status: 'issued' }),
      BookIssue.find({ school, fine: { $gt: 0 }, finePaid: true }).populate(populateBorrower).sort({ updatedAt: -1 }),
      BookIssue.find({ school, status: 'issued', dueDate: { $lt: new Date() } }).populate(populateBorrower).sort({ dueDate: 1 }),
      BookIssue.find({ school, status: 'returned', $expr: { $gt: ['$returnDate', '$dueDate'] } }).populate(populateBorrower).sort({ returnDate: -1 }),
      BookIssue.find({ school, status: 'damaged' }).populate(populateBorrower).sort({ updatedAt: -1 }),
      BookIssue.find({ school, status: 'lost' }).populate(populateBorrower).sort({ updatedAt: -1 }),
    ]);
    const allFineIssues = await BookIssue.find({ school, fine: { $gt: 0 } }, 'fine finePaid');
    const totalBooks = books.length;
    const totalCopies = books.reduce((s, b) => s + b.totalCopies, 0);
    const availableCopies = books.reduce((s, b) => s + b.availableCopies, 0);
    const totalFines = allFineIssues.reduce((s, i) => s + i.fine, 0);
    const collectedFines = allFineIssues.filter(i => i.finePaid).reduce((s, i) => s + i.fine, 0);
    res.json({
      success: true,
      report: {
        totalBooks, totalCopies, availableCopies, issuedCount,
        overdueCount: currentlyOverdue.length,
        returnedLateCount: overdueReturned.length,
        damagedCount: damaged.length,
        lostCount: lost.length,
        totalFines, collectedFines,
        finesPaid, currentlyOverdue, overdueReturned, damaged, lost,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /library/my-issues — for teacher/employee mobile app
router.get('/library/my-issues', protect, async (req, res) => {
  try {
    const emp = await Employee.findOne({ user: req.user._id, school: req.user.school });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found' });
    const issues = await BookIssue.find({ school: req.user.school, employee: emp._id, borrowerType: 'employee' })
      .populate('book', 'title author isbn category')
      .sort({ createdAt: -1 });
    const withFines = issues.map(issue => {
      const obj = issue.toObject();
      if (issue.status === 'issued') {
        obj.calculatedFine = calcFine(issue.dueDate);
      }
      return obj;
    });
    res.json({ success: true, issues: withFines });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /library/my-issues/:id/renewal — teacher requests renewal
router.post('/library/my-issues/:id/renewal', protect, async (req, res) => {
  try {
    const emp = await Employee.findOne({ user: req.user._id, school: req.user.school });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const issue = await BookIssue.findOne({ _id: req.params.id, school: req.user.school, employee: emp._id });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue record not found' });
    if (issue.status !== 'issued') {
      return res.status(400).json({ success: false, message: 'Only issued books can be renewed' });
    }
    const hasPending = issue.renewalRequests.some(r => r.status === 'pending');
    if (hasPending) {
      return res.status(400).json({ success: false, message: 'A renewal request is already pending' });
    }
    const { newDueDate } = req.body;
    if (!newDueDate) return res.status(400).json({ success: false, message: 'newDueDate is required' });

    issue.renewalRequests.push({ newDueDate: new Date(newDueDate) });
    await issue.save();
    res.status(201).json({ success: true, issue });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== VISITS (front-desk enquiry log) ==============
const VISIT_ROLES = ['admin', 'correspondent', 'principal'];

// A visit with a pending follow-up isn't fully done — present it as in_progress.
const coerceVisitFollowUp = (v) => {
  if (v && v.followUpRequired && v.status === 'completed') v.status = 'in_progress';
  return v;
};

// Custom purpose categories — stored as a string array on the school (same
// pattern as expense categories), batch-saved from the manage modal.
router.put('/school/visit-purposes', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const categories = Array.isArray(req.body.categories)
      ? [...new Set(req.body.categories.map(c => String(c).trim()).filter(Boolean))]
      : [];
    const school = await School.findByIdAndUpdate(req.user.school, { visitPurposes: categories }, { returnDocument: 'after' });
    res.json({ success: true, visitPurposes: school.visitPurposes });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Summary stats for the dashboard cards
router.get('/visits/stats', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const schoolId = req.user.school;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, active, followUpsDue, monthTotal] = await Promise.all([
      Visit.countDocuments({ school: schoolId, checkInTime: { $gte: startOfToday, $lte: endOfToday } }),
      Visit.countDocuments({ school: schoolId, status: { $in: ['waiting', 'in_progress'] } }),
      Visit.countDocuments({ school: schoolId, followUpRequired: true, status: { $ne: 'cancelled' }, followUpDate: { $lte: endOfToday } }),
      Visit.countDocuments({ school: schoolId, checkInTime: { $gte: startOfMonth } }),
    ]);
    res.json({ success: true, stats: { today, active, followUpsDue, monthTotal } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// List with filters
router.get('/visits', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const { status, purpose, startDate, endDate, search, followUp, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (purpose) query.purpose = purpose;
    if (followUp === 'true') { query.followUpRequired = true; query.status = { $ne: 'cancelled' }; }
    if (startDate || endDate) {
      query.checkInTime = {};
      if (startDate) query.checkInTime.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.checkInTime.$lte = e; }
    }
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ visitorName: rx }, { phone: rx }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [visits, total] = await Promise.all([
      Visit.find(query)
        .populate('attendedBy', 'name designation')
        .populate('relatedStudent', 'name admissionNumber')
        .sort({ checkInTime: -1 }).skip(skip).limit(Number(limit)),
      Visit.countDocuments(query),
    ]);
    visits.forEach(coerceVisitFollowUp);
    res.json({ success: true, visits, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Single visit + prior visit history for the same phone number
router.get('/visits/:id', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const visit = await Visit.findOne({ _id: req.params.id, school: req.user.school })
      .populate('attendedBy', 'name designation')
      .populate('relatedStudent', 'name admissionNumber')
      .populate('createdBy', 'name')
      .populate('activities.by', 'name');
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    coerceVisitFollowUp(visit);
    const history = await Visit.find({ school: req.user.school, phone: visit.phone, _id: { $ne: visit._id } })
      .select('visitorName purpose status checkInTime outcome').sort({ checkInTime: -1 }).limit(10);
    res.json({ success: true, visit, history });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/visits', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const data = { ...req.body, school: req.user.school, createdBy: req.user._id };
    // Can't be "completed" while a follow-up is still pending.
    if (data.followUpRequired && data.status === 'completed') data.status = 'in_progress';
    // Seed the activity log with the check-in (and the follow-up if one was set).
    data.activities = [{ type: 'check_in', note: data.purposeDetail || '', by: req.user._id, at: data.checkInTime || new Date() }];
    if (data.followUpRequired && data.followUpDate) {
      data.activities.push({ type: 'follow_up_set', followUpDate: data.followUpDate, by: req.user._id });
    }
    const visit = await Visit.create(data);
    res.status(201).json({ success: true, visit });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/visits/:id', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const { school, createdBy, _id, activities, ...update } = req.body; // never reassign tenant/owner/log
    const visit = await Visit.findOne({ _id: req.params.id, school: req.user.school });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

    const wasPending = visit.followUpRequired;
    const oldDate = visit.followUpDate ? new Date(visit.followUpDate).getTime() : null;
    Object.assign(visit, update);

    // Log a follow-up being newly scheduled or rescheduled.
    if (visit.followUpRequired && visit.followUpDate) {
      const newDate = new Date(visit.followUpDate).getTime();
      if (!wasPending || newDate !== oldDate) {
        visit.activities.push({ type: 'follow_up_set', followUpDate: visit.followUpDate, by: req.user._id });
      }
    }
    // A pending follow-up keeps the visit in progress, not completed.
    if (visit.followUpRequired && visit.status === 'completed') visit.status = 'in_progress';
    await visit.save();
    res.json({ success: true, visit });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Check in a returning visitor again — reactivates the SAME visit and logs a new
// check-in to its activity log (no new record / list row is created).
router.post('/visits/:id/checkin-again', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const visit = await Visit.findOne({ _id: req.params.id, school: req.user.school });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    const note = (req.body.reason || '').trim();
    visit.checkInTime = new Date();
    visit.checkOutTime = undefined;
    visit.status = 'in_progress';
    visit.activities.push({ type: 'check_in', note, by: req.user._id });
    await visit.save();
    res.json({ success: true, visit });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Quick check-out — stamps the checkout time and logs the reason. If a follow-up
// is still pending, the visit stays in progress instead of being marked complete.
router.post('/visits/:id/checkout', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const visit = await Visit.findOne({ _id: req.params.id, school: req.user.school });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    const note = (req.body.outcome || '').trim();
    if (note) visit.outcome = note;
    visit.checkOutTime = new Date();
    visit.status = visit.followUpRequired ? 'in_progress' : 'completed';
    visit.activities.push({ type: 'check_out', note, by: req.user._id });
    await visit.save();
    res.json({ success: true, visit });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Complete a pending follow-up — records the outcome, clears the pending flag
// (so it can be scheduled again later), and marks the visit completed.
router.post('/visits/:id/complete-followup', protect, checkSubscription, authorize(...VISIT_ROLES), async (req, res) => {
  try {
    const visit = await Visit.findOne({ _id: req.params.id, school: req.user.school });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (!visit.followUpRequired) return res.status(400).json({ success: false, message: 'This visit has no follow-up to complete' });
    const note = (req.body.outcome || '').trim();
    visit.activities.push({ type: 'follow_up_completed', note, followUpDate: visit.followUpDate, by: req.user._id });
    if (note) visit.outcome = visit.outcome ? `${visit.outcome}\n[Follow-up] ${note}` : `[Follow-up] ${note}`;
    visit.followUpRequired = false;
    visit.followUpDate = undefined;
    visit.status = 'completed';
    await visit.save();
    res.json({ success: true, visit });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


router.delete('/visits/:id', protect, checkSubscription, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    await Visit.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== OUT PASS (student gate pass) ==============
const OUTPASS_ROLES = ['admin', 'correspondent', 'principal'];
const populateOutPass = (q) => q
  .populate({ path: 'student', select: 'name admissionNumber photo currentClass', populate: { path: 'currentClass', select: 'name section' } })
  .populate('parent', 'name relation phone')
  .populate('approvedBy', 'name');

router.get('/outpasses/stats', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const schoolId = req.user.school;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [today, out, returned, monthTotal] = await Promise.all([
      OutPass.countDocuments({ school: schoolId, exitDate: { $gte: startOfToday, $lte: endOfToday } }),
      OutPass.countDocuments({ school: schoolId, status: 'active' }),
      OutPass.countDocuments({ school: schoolId, status: 'returned', exitDate: { $gte: startOfToday, $lte: endOfToday } }),
      OutPass.countDocuments({ school: schoolId, exitDate: { $gte: startOfMonth } }),
    ]);
    res.json({ success: true, stats: { today, out, returned, monthTotal } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/outpasses', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const { status, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.exitDate = {};
      if (startDate) query.exitDate.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.exitDate.$lte = e; }
    }
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ pickupName: rx }, { passNumber: rx }, { pickupPhone: rx }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [outpasses, total] = await Promise.all([
      populateOutPass(OutPass.find(query)).sort({ exitDate: -1 }).skip(skip).limit(Number(limit)),
      OutPass.countDocuments(query),
    ]);
    res.json({ success: true, outpasses, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/outpasses/:id', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const outpass = await populateOutPass(OutPass.findOne({ _id: req.params.id, school: req.user.school }));
    if (!outpass) return res.status(404).json({ success: false, message: 'Out pass not found' });
    res.json({ success: true, outpass });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/outpasses', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const { school, approvedBy, passNumber: _pn, _id, studentIds, student, ...body } = req.body;
    // One pass per student — a parent can collect several children in one go.
    const ids = (Array.isArray(studentIds) && studentIds.length) ? studentIds : (student ? [student] : []);
    if (!ids.length) return res.status(400).json({ success: false, message: 'At least one student is required' });

    let n = await OutPass.countDocuments({ school: req.user.school });
    const createdIds = [];
    for (const sid of ids) {
      n += 1;
      const passNumber = `GP${String(n).padStart(4, '0')}`;
      const doc = await OutPass.create({ ...body, student: sid, passNumber, school: req.user.school, approvedBy: req.user._id });
      createdIds.push(doc._id);
    }
    const outpasses = await populateOutPass(OutPass.find({ _id: { $in: createdIds } }));
    res.status(201).json({ success: true, outpasses, outpass: outpasses[0], count: createdIds.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/outpasses/:id', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const { school, approvedBy, passNumber, _id, ...update } = req.body;
    const outpass = await populateOutPass(
      OutPass.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, update, { returnDocument: 'after' }));
    if (!outpass) return res.status(404).json({ success: false, message: 'Out pass not found' });
    res.json({ success: true, outpass });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/outpasses/:id/return', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const outpass = await populateOutPass(OutPass.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { status: 'returned', returnedAt: new Date() }, { returnDocument: 'after' }));
    if (!outpass) return res.status(404).json({ success: false, message: 'Out pass not found' });
    res.json({ success: true, outpass });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/outpasses/:id', protect, checkSubscription, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    await OutPass.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Printable PDF pass
router.get('/outpasses/:id/pdf', protect, checkSubscription, authorize(...OUTPASS_ROLES), async (req, res) => {
  try {
    const op = await populateOutPass(OutPass.findOne({ _id: req.params.id, school: req.user.school }));
    if (!op) return res.status(404).json({ success: false, message: 'Out pass not found' });
    const school = await School.findById(req.user.school);
    const { generateOutPass } = require('../utils/pdf');
    const cls = op.student?.currentClass;
    const pdf = await generateOutPass({
      passNumber: op.passNumber,
      exitDate: op.exitDate,
      expectedReturn: op.expectedReturn,
      studentName: op.student?.name,
      admissionNumber: op.student?.admissionNumber,
      studentPhoto: op.student?.photo,
      className: cls ? `${cls.name}${cls.section ? ' - ' + cls.section : ''}` : '',
      pickupName: op.pickupName,
      pickupRelation: op.pickupRelation,
      pickupType: op.pickupType,
      pickupPhone: op.pickupPhone,
      pickupIdProof: op.pickupIdProof,
      reason: op.reason,
      reasonDetail: op.reasonDetail,
    }, school.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=OutPass_${op.passNumber}.pdf`);
    res.send(pdf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== INVENTORY (asset management) ==============
const INVENTORY_ROLES = ['admin', 'correspondent', 'principal'];
const populateItem = (q) => q
  .populate('assignedTo', 'name designation')
  .populate('createdBy', 'name')
  .populate('repairs.linkedVisit', 'status checkInTime visitorName');

// Map a (free-text) inventory category onto an Expense category enum value.
const mapInventoryToExpenseCategory = (cat) => {
  const c = (cat || '').toLowerCase();
  if (c.includes('furnitur')) return 'furniture';
  if (c.includes('electronic') || c.includes('computer') || c.includes('projector') || c.includes('network') || c.includes('musical')) return 'electronics';
  return 'other';
};

// Auto-create an Expense record from an inventory purchase / repair cost.
const createInventoryExpense = async (schoolId, userId, { title, category, amount, date, vendor, description }) => {
  const amt = Number(amount);
  if (!amt || amt <= 0) return null;
  const school = await School.findById(schoolId).select('academicYear');
  const sm = school?.academicYear?.startMonth || 6;
  const em = school?.academicYear?.endMonth || 3;
  const { academicYearForDate } = require('../utils/academicYear');
  return Expense.create({
    school: schoolId,
    title,
    category,
    amount: amt,
    date: date || new Date(),
    vendor: vendor || undefined,
    description,
    createdBy: userId,
    academicYear: academicYearForDate(date || new Date(), sm, em),
  });
};

router.get('/inventory/stats', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const schoolId = req.user.school;
    const [total, inUse, inRepair, attention, pendingRequests] = await Promise.all([
      InventoryItem.countDocuments({ school: schoolId }),
      InventoryItem.countDocuments({ school: schoolId, status: 'in_use' }),
      InventoryItem.countDocuments({ school: schoolId, status: 'in_repair' }),
      InventoryItem.countDocuments({ school: schoolId, status: { $in: ['damaged', 'lost'] } }),
      PurchaseRequest.countDocuments({ school: schoolId, status: { $in: ['pending', 'ordered'] } }),
    ]);
    res.json({ success: true, stats: { total, inUse, inRepair, attention, pendingRequests } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Category summary — counts per category for the grouped landing view
router.get('/inventory/category-summary', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const items = await InventoryItem.find({ school: req.user.school }).select('category status');
    const map = {};
    items.forEach(it => {
      const c = it.category || 'Uncategorized';
      if (!map[c]) map[c] = { category: c, total: 0, inUse: 0, inRepair: 0, attention: 0 };
      map[c].total++;
      if (it.status === 'in_use') map[c].inUse++;
      else if (it.status === 'in_repair') map[c].inRepair++;
      else if (it.status === 'damaged' || it.status === 'lost') map[c].attention++;
    });
    const summary = Object.values(map).sort((a, b) => a.category.localeCompare(b.category));
    res.json({ success: true, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Flattened repairs across items (Repairs tab)
router.get('/inventory/repairs', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const { status } = req.query;
    const items = await populateItem(InventoryItem.find({ school: req.user.school, 'repairs.0': { $exists: true } }))
      .sort({ updatedAt: -1 });
    const repairs = [];
    items.forEach(it => {
      (it.repairs || []).forEach(r => {
        if (status && r.status !== status) return;
        repairs.push({
          _id: r._id,
          itemId: it._id,
          itemName: it.name,
          itemCode: it.itemCode,
          itemStatus: it.status,
          issue: r.issue,
          quantity: r.quantity,
          reportedDate: r.reportedDate,
          status: r.status,
          technicianName: r.technicianName,
          technicianPhone: r.technicianPhone,
          technicianDesignation: r.technicianDesignation,
          linkedVisit: r.linkedVisit,
          cost: r.cost,
          resolutionNotes: r.resolutionNotes,
          completedDate: r.completedDate,
        });
      });
    });
    repairs.sort((a, b) => new Date(b.reportedDate) - new Date(a.reportedDate));
    res.json({ success: true, repairs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/inventory', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const { category, location, status, type, search, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (category) query.category = category;
    if (location) query.location = location;
    if (status) query.status = status;
    // Asset vs consumable. Treat legacy items (no type stored) as assets.
    if (type === 'asset') query.type = { $ne: 'consumable' };
    else if (type === 'consumable') query.type = 'consumable';
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: rx }, { itemCode: rx }, { serialNumber: rx }, { assetTag: rx }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      populateItem(InventoryItem.find(query)).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      InventoryItem.countDocuments(query),
    ]);
    res.json({ success: true, items, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/inventory/:id', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const item = await populateItem(InventoryItem.findOne({ _id: req.params.id, school: req.user.school }));
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/inventory', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const n = await InventoryItem.countDocuments({ school: req.user.school }) + 1;
    const itemCode = `INV${String(n).padStart(4, '0')}`;
    const { school, createdBy, itemCode: _ic, _id, repairs, ...body } = req.body;
    const created = await InventoryItem.create({ ...body, itemCode, school: req.user.school, createdBy: req.user._id });

    // Capture the purchase price as an expense (price × quantity)
    if (created.purchasePrice > 0) {
      await createInventoryExpense(req.user.school, req.user._id, {
        title: `Asset Purchase — ${created.name}`,
        category: mapInventoryToExpenseCategory(created.category),
        amount: created.purchasePrice * (created.quantity || 1),
        date: created.purchaseDate || new Date(),
        vendor: created.vendor,
        description: `Inventory purchase · ${created.itemCode}`,
      });
    }

    const item = await populateItem(InventoryItem.findById(created._id));
    res.status(201).json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Bulk create — add many individual units at once (shared fields + per-unit rows)
router.post('/inventory/bulk', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const shared = req.body.shared || {};
    const units = Array.isArray(req.body.units) ? req.body.units.filter(u => u && u.name && u.name.trim()) : [];
    if (units.length === 0) return res.status(400).json({ success: false, message: 'Add at least one unit with a name' });

    const type = shared.type === 'consumable' ? 'consumable' : 'asset';
    let n = await InventoryItem.countDocuments({ school: req.user.school });
    const created = [];
    for (const u of units) {
      n += 1;
      const doc = await InventoryItem.create({
        school: req.user.school,
        createdBy: req.user._id,
        itemCode: `INV${String(n).padStart(4, '0')}`,
        name: u.name.trim(),
        type,
        // Assets are one physical unit per row; only consumables carry a quantity.
        serialNumber: type === 'asset' ? (u.serialNumber || undefined) : undefined,
        assetTag: type === 'asset' ? (u.assetTag || undefined) : undefined,
        purchasePrice: (u.purchasePrice !== undefined && u.purchasePrice !== '' && u.purchasePrice !== null) ? Number(u.purchasePrice) : undefined,
        quantity: type === 'asset' ? 1 : (Number(u.quantity) > 0 ? Number(u.quantity) : 1),
        category: shared.category || undefined,
        location: shared.location || undefined,
        vendor: shared.vendor || undefined,
        purchaseDate: shared.purchaseDate || undefined,
        warrantyExpiry: shared.warrantyExpiry || undefined,
        assignedTo: shared.assignedTo || undefined,
        status: shared.status || 'in_use',
      });
      created.push(doc);
    }

    // One combined expense for the batch (sum of price × quantity)
    const totalPrice = created.reduce((s, d) => s + (d.purchasePrice || 0) * (d.quantity || 1), 0);
    if (totalPrice > 0) {
      const codes = created.length > 1 ? `${created[0].itemCode}–${created[created.length - 1].itemCode}` : created[0].itemCode;
      await createInventoryExpense(req.user.school, req.user._id, {
        title: `Asset Purchase — ${created.length} item${created.length > 1 ? 's' : ''}${shared.category ? ' (' + shared.category + ')' : ''}`,
        category: mapInventoryToExpenseCategory(shared.category),
        amount: totalPrice,
        date: shared.purchaseDate || new Date(),
        vendor: shared.vendor,
        description: `Inventory purchase · ${codes}`,
      });
    }
    res.status(201).json({ success: true, count: created.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/inventory/:id', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const { school, createdBy, itemCode, _id, repairs, ...update } = req.body;
    const item = await populateItem(
      InventoryItem.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, update, { returnDocument: 'after' }));
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/inventory/:id', protect, checkSubscription, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    await InventoryItem.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Send to repair — adds a repair entry and flips the item to in_repair
router.post('/inventory/:id/repairs', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, school: req.user.school });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    item.repairs.push({
      issue: req.body.issue,
      quantity: Number(req.body.quantity) > 0 ? Number(req.body.quantity) : 1,
      reportedDate: req.body.reportedDate || new Date(),
      technicianName: req.body.technicianName,
      technicianPhone: req.body.technicianPhone,
      status: 'pending',
      createdBy: req.user._id,
    });
    item.status = 'in_repair';
    await item.save();
    const populated = await populateItem(InventoryItem.findById(item._id));
    res.status(201).json({ success: true, item: populated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Bulk send to repair — push a repair entry to several units at once
router.post('/inventory/repairs/bulk', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const ids = Array.isArray(req.body.itemIds) ? req.body.itemIds : [];
    if (ids.length === 0) return res.status(400).json({ success: false, message: 'No items selected' });
    const items = await InventoryItem.find({ _id: { $in: ids }, school: req.user.school });
    for (const item of items) {
      item.repairs.push({
        issue: req.body.issue,
        reportedDate: req.body.reportedDate || new Date(),
        technicianName: req.body.technicianName,
        technicianPhone: req.body.technicianPhone,
        technicianDesignation: req.body.technicianDesignation,
        status: 'pending',
        createdBy: req.user._id,
      });
      item.status = 'in_repair';
      await item.save();
    }
    res.status(201).json({ success: true, count: items.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update a repair entry (issue, technician, status, cost, notes)
router.put('/inventory/:id/repairs/:repairId', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, school: req.user.school });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    const repair = item.repairs.id(req.params.repairId);
    if (!repair) return res.status(404).json({ success: false, message: 'Repair not found' });
    ['issue', 'quantity', 'status', 'technicianName', 'technicianPhone', 'cost', 'resolutionNotes'].forEach(k => {
      if (req.body[k] !== undefined) repair[k] = req.body[k];
    });
    await item.save();
    const populated = await populateItem(InventoryItem.findById(item._id));
    res.json({ success: true, item: populated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Log the repairman as a Visit (Visits module) and link it to the repair
router.post('/inventory/:id/repairs/:repairId/visit', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, school: req.user.school });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    const repair = item.repairs.id(req.params.repairId);
    if (!repair) return res.status(404).json({ success: false, message: 'Repair not found' });

    const visitorName = (req.body.visitorName || repair.technicianName || '').trim();
    const phone = (req.body.phone || repair.technicianPhone || '').trim();
    const designation = req.body.designation;
    if (!visitorName) return res.status(400).json({ success: false, message: 'Repairman name is required' });
    if (!phone) return res.status(400).json({ success: false, message: 'Repairman phone number is required' });

    const visit = await Visit.create({
      school: req.user.school,
      visitorName,
      phone,
      purpose: 'repair',
      purposeDetail: `${item.name} (${item.itemCode})${repair.issue ? ' — ' + repair.issue : ''}`,
      remarks: designation ? `Technician: ${designation}` : undefined,
      attendedBy: req.body.attendedBy || undefined,
      status: 'waiting',
      createdBy: req.user._id,
    });
    // Sync the repairman's details back onto the repair record
    repair.technicianName = visitorName;
    repair.technicianPhone = phone;
    if (designation !== undefined) repair.technicianDesignation = designation;
    repair.linkedVisit = visit._id;
    if (repair.status === 'pending') repair.status = 'in_progress';
    await item.save();
    const populated = await populateItem(InventoryItem.findById(item._id));
    res.status(201).json({ success: true, item: populated, visitId: visit._id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Complete a repair — closes it, sets the item's resulting status, and completes the linked visit
router.post('/inventory/:id/repairs/:repairId/complete', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, school: req.user.school });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    const repair = item.repairs.id(req.params.repairId);
    if (!repair) return res.status(404).json({ success: false, message: 'Repair not found' });

    repair.status = 'completed';
    repair.completedDate = new Date();
    if (req.body.resolutionNotes !== undefined) repair.resolutionNotes = req.body.resolutionNotes;
    if (req.body.cost !== undefined) repair.cost = req.body.cost;

    const allowed = ['in_use', 'in_storage', 'damaged', 'disposed', 'lost'];
    item.status = allowed.includes(req.body.itemStatus) ? req.body.itemStatus : 'in_use';
    await item.save();

    // Keep the linked repairman visit in sync
    if (repair.linkedVisit) {
      await Visit.findOneAndUpdate(
        { _id: repair.linkedVisit, school: req.user.school },
        { status: 'completed', checkOutTime: new Date() }
      );
    }

    // Capture the repair cost as an expense
    if (repair.cost > 0) {
      await createInventoryExpense(req.user.school, req.user._id, {
        title: `Repair — ${item.name}`,
        category: 'maintenance',
        amount: repair.cost,
        date: repair.completedDate || new Date(),
        vendor: repair.technicianName,
        description: `Repair of ${item.itemCode}${repair.issue ? ' · ' + repair.issue : ''}`,
      });
    }

    const populated = await populateItem(InventoryItem.findById(item._id));
    res.json({ success: true, item: populated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== PURCHASE REQUESTS (procurement) ==============
router.get('/purchase-requests', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ requestNumber: rx }, { title: rx }, { vendor: rx }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [requests, total] = await Promise.all([
      PurchaseRequest.find(query).populate('requestedBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      PurchaseRequest.countDocuments(query),
    ]);
    res.json({ success: true, requests, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/purchase-requests/:id', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const request = await PurchaseRequest.findOne({ _id: req.params.id, school: req.user.school })
      .populate('requestedBy', 'name').populate('receivedBy', 'name');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/purchase-requests', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items.filter(i => i && i.name && i.name.trim()) : [];
    if (items.length === 0) return res.status(400).json({ success: false, message: 'Add at least one item with a name' });
    const n = await PurchaseRequest.countDocuments({ school: req.user.school }) + 1;
    const sharedCategory = req.body.category || undefined;
    const sharedLocation = req.body.location || undefined;
    const type = req.body.type === 'consumable' ? 'consumable' : 'asset';
    const request = await PurchaseRequest.create({
      school: req.user.school,
      requestNumber: `PR${String(n).padStart(4, '0')}`,
      title: req.body.title,
      type,
      category: sharedCategory,
      location: sharedLocation,
      vendor: req.body.vendor,
      expectedDate: req.body.expectedDate || undefined,
      notes: req.body.notes,
      status: 'pending',
      items: items.map(i => ({
        name: i.name.trim(),
        category: sharedCategory,
        location: sharedLocation,
        // Asset lines are one unit each; only consumables carry a quantity.
        quantity: type === 'asset' ? 1 : (Number(i.quantity) > 0 ? Number(i.quantity) : 1),
        estimatedPrice: (i.estimatedPrice !== undefined && i.estimatedPrice !== '' && i.estimatedPrice !== null) ? Number(i.estimatedPrice) : undefined,
      })),
      requestedBy: req.user._id,
    });
    res.status(201).json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/purchase-requests/:id', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const existing = await PurchaseRequest.findOne({ _id: req.params.id, school: req.user.school });
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    const { school, requestNumber, requestedBy, _id, receivedBy, receivedAt, ...update } = req.body;

    // A received request is already fulfilled — only its details may be edited,
    // not the items/category/location/status (those drove the created inventory).
    if (existing.status === 'received') {
      const metaOnly = {};
      ['title', 'vendor', 'notes', 'expectedDate'].forEach(k => { if (update[k] !== undefined) metaOnly[k] = update[k]; });
      const request = await PurchaseRequest.findByIdAndUpdate(existing._id, metaOnly, { returnDocument: 'after' });
      return res.json({ success: true, request });
    }

    const sharedCategory = update.category || undefined;
    const sharedLocation = update.location || undefined;
    if (Array.isArray(update.items)) {
      update.items = update.items.filter(i => i && i.name && i.name.trim()).map(i => ({
        name: i.name.trim(), category: sharedCategory, location: sharedLocation,
        quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
        estimatedPrice: (i.estimatedPrice !== undefined && i.estimatedPrice !== '' && i.estimatedPrice !== null) ? Number(i.estimatedPrice) : undefined,
      }));
    }
    const request = await PurchaseRequest.findByIdAndUpdate(existing._id, update, { returnDocument: 'after' });
    res.json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/purchase-requests/:id', protect, checkSubscription, authorize('admin', 'correspondent'), async (req, res) => {
  try {
    await PurchaseRequest.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Receive — set actual prices, create inventory units, book one expense
router.post('/purchase-requests/:id/receive', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const pr = await PurchaseRequest.findOne({ _id: req.params.id, school: req.user.school });
    if (!pr) return res.status(404).json({ success: false, message: 'Request not found' });
    if (pr.status === 'received') return res.status(400).json({ success: false, message: 'Request already received' });

    // The actual vendor can be corrected at receive time.
    if (req.body.vendor !== undefined) pr.vendor = (req.body.vendor || '').trim();

    // Map submitted unit prices by line id
    const priceById = {};
    (Array.isArray(req.body.items) ? req.body.items : []).forEach(l => { priceById[String(l._id)] = l.actualPrice; });

    let n = await InventoryItem.countDocuments({ school: req.user.school });
    let grandTotal = 0;
    const cats = new Set();
    const createdIds = [];
    for (const line of pr.items) {
      const raw = priceById[String(line._id)];
      const unitPrice = Number(raw !== undefined && raw !== '' && raw !== null ? raw : (line.estimatedPrice || 0)) || 0;
      line.actualPrice = unitPrice;
      const itemType = pr.type === 'consumable' ? 'consumable' : 'asset';
      const qty = itemType === 'asset' ? 1 : Math.max(1, Number(line.quantity) || 1);
      if (line.category) cats.add(line.category);
      n += 1;
      const doc = await InventoryItem.create({
        school: req.user.school,
        createdBy: req.user._id,
        itemCode: `INV${String(n).padStart(4, '0')}`,
        name: line.name,
        type: itemType,
        category: line.category || undefined,
        location: line.location || undefined,
        vendor: pr.vendor || undefined,
        purchaseDate: new Date(),
        purchasePrice: unitPrice > 0 ? unitPrice : undefined,
        quantity: qty,
        status: 'in_use',
      });
      createdIds.push(doc._id);
      grandTotal += unitPrice * qty;
    }

    // One combined expense for the received request — clear any stale expense for
    // this request first so re-receiving never leaves duplicates.
    await Expense.deleteMany({ school: req.user.school, description: `Purchase request ${pr.requestNumber} received` });
    let expenseDoc = null;
    if (grandTotal > 0) {
      const expCategory = cats.size === 1 ? mapInventoryToExpenseCategory([...cats][0]) : 'other';
      expenseDoc = await createInventoryExpense(req.user.school, req.user._id, {
        title: `Purchase — ${pr.requestNumber}${pr.title ? ' (' + pr.title + ')' : ''}`,
        category: expCategory,
        amount: grandTotal,
        date: new Date(),
        vendor: pr.vendor,
        description: `Purchase request ${pr.requestNumber} received`,
      });
    }

    pr.status = 'received';
    pr.receivedAt = new Date();
    pr.receivedBy = req.user._id;
    pr.createdItems = createdIds;
    pr.expenseRef = expenseDoc ? expenseDoc._id : undefined;
    await pr.save();
    res.json({ success: true, request: pr });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Reverse — undo a received purchase (remove its items & expense) or reopen a cancelled request
router.post('/purchase-requests/:id/reverse', protect, checkSubscription, authorize(...INVENTORY_ROLES), async (req, res) => {
  try {
    const pr = await PurchaseRequest.findOne({ _id: req.params.id, school: req.user.school });
    if (!pr) return res.status(404).json({ success: false, message: 'Request not found' });
    if (pr.status !== 'received' && pr.status !== 'cancelled') {
      return res.status(400).json({ success: false, message: 'Only a received or cancelled request can be reversed' });
    }

    // Only a received request created inventory items / an expense to undo.
    if (pr.status === 'received') {
      if (pr.createdItems && pr.createdItems.length) {
        await InventoryItem.deleteMany({ _id: { $in: pr.createdItems }, school: req.user.school });
      } else {
        // Legacy receive (no tracked link): best-effort remove the matching items
        // created for this request, matched by category + name, capped at the
        // requested quantity and limited to those created on/after the receive time.
        for (const line of (pr.items || [])) {
          const rx = new RegExp('^' + String(line.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( \\d+)?$', 'i');
          const match = { school: req.user.school, name: rx };
          if (line.category) match.category = line.category;
          if (pr.receivedAt) match.createdAt = { $gte: new Date(pr.receivedAt.getTime() - 60000) };
          const candidates = await InventoryItem.find(match).sort({ createdAt: -1 }).limit(Math.max(1, Number(line.quantity) || 1));
          if (candidates.length) {
            await InventoryItem.deleteMany({ _id: { $in: candidates.map(c => c._id) }, school: req.user.school });
          }
        }
      }
      // Remove the expense(s) booked for this request (covers the tracked ref,
      // legacy receives, and any duplicates).
      await Expense.deleteMany({ school: req.user.school, description: `Purchase request ${pr.requestNumber} received` });
    }
    pr.status = 'pending';
    pr.receivedAt = undefined;
    pr.receivedBy = undefined;
    pr.createdItems = [];
    pr.expenseRef = undefined;
    pr.items.forEach(i => { i.actualPrice = undefined; });
    await pr.save();
    res.json({ success: true, request: pr });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ============== HOSTEL ==============
const hostelCtrl = require('../controllers/hostelController');
const HOSTEL_ROLES = ['admin', 'correspondent', 'principal'];

router.get('/hostel/dashboard',      protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.getDashboard);

router.get('/hostel/hostels',        protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.listHostels);
router.post('/hostel/hostels',       protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.createHostel);
router.put('/hostel/hostels/:id',    protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.updateHostel);
router.delete('/hostel/hostels/:id', protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.deleteHostel);

router.get('/hostel/available-rooms',     protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.getAvailableRooms);
router.get('/hostel/rooms',               protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.listRooms);
router.post('/hostel/rooms',              protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.createRoom);
router.put('/hostel/rooms/:id',           protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.updateRoom);
router.delete('/hostel/rooms/:id',        protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.deleteRoom);
router.get('/hostel/rooms/:id/students',  protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.getRoomStudents);

router.get('/hostel/wardens',        protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.listWardens);
router.post('/hostel/wardens',       protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.assignWarden);
router.delete('/hostel/wardens/:id', protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.removeWarden);

router.get('/hostel/allocations',                protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.listAllocations);
router.post('/hostel/allocations',               protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.allocateStudent);
router.post('/hostel/allocations/:id/transfer',  protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.transferStudent);
router.post('/hostel/allocations/:id/vacate',    protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.vacateStudent);
router.get('/hostel/student/:studentId/history', protect, checkSubscription, authorize(...HOSTEL_ROLES), hostelCtrl.getStudentHistory);

module.exports = router;
