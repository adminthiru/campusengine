const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const FeeCollection = require('../models/FeeCollection');
const { Expense } = require('../models/Expense');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');

// Setup school profile
const setupSchool = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const updateData = { ...req.body, profileCompleted: true };
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
    const school = await School.findByIdAndUpdate(req.user.school, req.body, { returnDocument: 'after' });
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
          pendingFeesCount: pendingFees[0]?.count || 0
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
