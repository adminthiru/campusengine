const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const FeeCollection = require('../models/FeeCollection');
const { Expense } = require('../models/Expense');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');

// Fields a school admin must NOT be able to set on their own school via the
// profile/setup endpoints — these are controlled by the super admin / billing.
// Without this, a tenant could grant themselves modules/limits, mark their
// subscription active, or un-suspend (isActive) via mass assignment.
const PROTECTED_SCHOOL_FIELDS = ['subscription', 'isActive', 'code', 'suspendedReason', 'suspendedAt', '_id', 'createdAt', 'updatedAt', 'studentsRange'];
const stripProtectedSchoolFields = (body = {}) => {
  const clean = { ...body };
  PROTECTED_SCHOOL_FIELDS.forEach(f => delete clean[f]);
  return clean;
};

// Setup school profile
const setupSchool = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const updateData = { ...stripProtectedSchoolFields(req.body), profileCompleted: true };
    const school = await School.findByIdAndUpdate(schoolId, updateData, { returnDocument: 'after', runValidators: true });
    res.json({ success: true, school });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get school profile
const getSchool = async (req, res) => {
  try {
    const school = await School.findById(req.user.school || req.params.id);
    res.json({ success: true, school });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update school
const updateSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.user.school, stripProtectedSchoolFields(req.body), { returnDocument: 'after' });
    res.json({ success: true, school });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalStudents,
      totalEmployees,
      todayStudentAttendance,
      todayEmployeeAttendance,
      monthlyFees,
      monthlyExpenses,
      monthlySalaries,
      recentStudents,
      pendingFees
    ] = await Promise.all([
      Student.countDocuments({ school: schoolId, status: 'active' }),
      Employee.countDocuments({ school: schoolId, status: 'active' }),
      Attendance.find({ school: schoolId, date: { $gte: today, $lte: todayEnd }, type: 'student' }),
      Attendance.find({ school: schoolId, date: { $gte: today, $lte: todayEnd }, type: 'employee' }),
      FeeCollection.aggregate([
        { $match: { school: schoolId, 'payments.date': { $gte: new Date(today.getFullYear(), today.getMonth(), 1) } } },
        { $unwind: '$payments' },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } }
      ]),
      Expense.aggregate([
        { $match: { school: schoolId, date: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Salary.aggregate([
        { $match: { school: schoolId, status: 'paid', year: today.getFullYear(), month: today.getMonth() + 1 } },
        { $group: { _id: null, total: { $sum: '$netSalary' } } }
      ]),
      Student.find({ school: schoolId }).sort({ createdAt: -1 }).limit(5).populate('currentClass', 'name section'),
      FeeCollection.aggregate([
        { $match: { school: schoolId, status: { $in: ['pending', 'partial', 'overdue'] } } },
        { $group: { _id: null, total: { $sum: '$pendingAmount' }, count: { $sum: 1 } } }
      ])
    ]);

    // Calculate attendance counts
    let presentStudents = 0, absentStudents = 0;
    todayStudentAttendance.forEach(a => {
      a.records.forEach(r => {
        if (r.status === 'present') presentStudents++;
        else absentStudents++;
      });
    });

    let presentEmployees = 0, absentEmployees = 0;
    todayEmployeeAttendance.forEach(a => {
      a.records.forEach(r => {
        if (r.status === 'present') presentEmployees++;
        else absentEmployees++;
      });
    });

    // Monthly revenue (last 6 months)
    const revenueData = await FeeCollection.aggregate([
      { $match: { school: schoolId } },
      { $unwind: '$payments' },
      { $group: {
        _id: { month: { $month: '$payments.date' }, year: { $year: '$payments.date' } },
        revenue: { $sum: '$payments.amount' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 6 }
    ]);

    const expenseData = await Expense.aggregate([
      { $match: { school: schoolId } },
      { $group: {
        _id: { month: { $month: '$date' }, year: { $year: '$date' } },
        amount: { $sum: '$amount' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 6 }
    ]);

    const feesByClass = await FeeCollection.aggregate([
      { $match: { school: schoolId } },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $lookup: { from: 'classes', localField: 'student.currentClass', foreignField: '_id', as: 'class' } },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$class.name', collected: { $sum: '$paidAmount' }, pending: { $sum: '$pendingAmount' } } },
      { $sort: { _id: 1 } }
    ]);

    // ── Operational pulse, upcoming items, and action-center alerts ──────────────
    const OutPass = require('../models/OutPass');
    const Visit = require('../models/Visit');
    const Leave = require('../models/Leave');
    const StudentLeave = require('../models/StudentLeave');
    const BookIssue = require('../models/BookIssue');
    const PurchaseRequest = require('../models/PurchaseRequest');
    const SchoolCalendar = require('../models/SchoolCalendar');
    const { Exam } = require('../models/Exam');
    const Homework = require('../models/Homework');
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

    const [
      outpassToday, visitsToday, pendingStaffLeaves, pendingStudentLeaves,
      todayExpenseAgg, feeTotals, overdueBooks, pendingPurchases,
      upcomingEvents, upcomingExams, homeworkDue, classStrength, overdueFeesAgg,
    ] = await Promise.all([
      OutPass.countDocuments({ school: schoolId, exitDate: { $gte: today, $lte: todayEnd } }),
      Visit.countDocuments({ school: schoolId, checkInTime: { $gte: today, $lte: todayEnd } }),
      Leave.countDocuments({ school: schoolId, status: 'pending' }),
      StudentLeave.countDocuments({ school: schoolId, status: 'pending' }),
      Expense.aggregate([{ $match: { school: schoolId, date: { $gte: today, $lte: todayEnd } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      FeeCollection.aggregate([{ $match: { school: schoolId } }, { $group: { _id: null, collected: { $sum: '$paidAmount' }, expected: { $sum: '$netAmount' } } }]),
      BookIssue.countDocuments({ school: schoolId, status: { $in: ['issued', 'overdue'] }, dueDate: { $lt: today } }),
      PurchaseRequest.countDocuments({ school: schoolId, status: 'pending' }),
      SchoolCalendar.find({ school: schoolId, date: { $gte: today, $lte: in7 } }).select('title date type color').sort({ date: 1 }).limit(8).lean(),
      Exam.find({ school: schoolId, examDate: { $gte: today, $lte: in7 } }).select('name examDate type').sort({ examDate: 1 }).limit(8).lean(),
      Homework.find({ school: schoolId, status: 'active', dueDate: { $gte: today, $lte: in7 } }).select('title dueDate').populate('class', 'name section').sort({ dueDate: 1 }).limit(8).lean(),
      Student.aggregate([
        { $match: { school: schoolId, status: 'active' } },
        { $group: { _id: '$currentClass', count: { $sum: 1 } } },
        { $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'cls' } },
        { $unwind: { path: '$cls', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: { $ifNull: ['$cls.name', 'Unassigned'] }, section: '$cls.section', count: 1 } },
        { $sort: { name: 1 } },
      ]),
      FeeCollection.aggregate([{ $match: { school: schoolId, dueDate: { $lt: today }, pendingAmount: { $gt: 0 } } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$pendingAmount' } } }]),
    ]);
    const pendingLeaves = pendingStaffLeaves + pendingStudentLeaves;

    res.json({
      success: true,
      stats: {
        students: { total: totalStudents, present: presentStudents, absent: absentStudents },
        employees: { total: totalEmployees, present: presentEmployees, absent: absentEmployees },
        finance: {
          monthlyRevenue: monthlyFees[0]?.total || 0,
          monthlyExpenses: (monthlyExpenses[0]?.total || 0) + (monthlySalaries[0]?.total || 0),
          monthlyProfit: (monthlyFees[0]?.total || 0) - (monthlyExpenses[0]?.total || 0) - (monthlySalaries[0]?.total || 0),
          pendingFees: pendingFees[0]?.total || 0,
          pendingFeesCount: pendingFees[0]?.count || 0,
          todayExpenses: todayExpenseAgg[0]?.total || 0,
          collected: feeTotals[0]?.collected || 0,
          expected: feeTotals[0]?.expected || 0,
        },
        pulse: { outpassToday, visitsToday, pendingStaffLeaves, pendingStudentLeaves, pendingLeaves },
        upcoming: { events: upcomingEvents, exams: upcomingExams, homework: homeworkDue },
        classStrength,
        alerts: {
          overdueFees: { count: overdueFeesAgg[0]?.count || 0, amount: overdueFeesAgg[0]?.amount || 0 },
          overdueBooks, pendingPurchases, pendingLeaves,
        },
        recentStudents,
        charts: { revenue: revenueData, expenses: expenseData, feesByClass }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Super admin - get all schools
const getAllSchools = async (req, res) => {
  try {
    const schools = await School.find().sort({ createdAt: -1 });
    res.json({ success: true, schools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Upload logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    await School.findByIdAndUpdate(req.user.school, { logo: url });
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { setupSchool, getSchool, updateSchool, getDashboardStats, getAllSchools, uploadLogo };
