const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const School = require('../models/School');
const { generatePaySlip } = require('../utils/pdf');
const { sendSMS } = require('../utils/sms');

// Generate salary for month
const generateSalary = async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;
    const schoolId = req.user.school;

    const employees = employeeIds
      ? await Employee.find({ _id: { $in: employeeIds }, school: schoolId, status: 'active' })
      : await Employee.find({ school: schoolId, status: 'active' });

    const generated = [];
    for (const emp of employees) {
      const existing = await Salary.findOne({ school: schoolId, employee: emp._id, month, year });
      if (existing) continue;

      // Calculate working days
      const daysInMonth = new Date(year, month, 0).getDate();
      const attendanceRecords = await Attendance.find({
        school: schoolId, type: 'employee',
        date: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) },
        'records.employee': emp._id
      });
      let presentDays = 0;
      attendanceRecords.forEach(a => {
        const rec = a.records.find(r => r.employee?.toString() === emp._id.toString());
        if (rec && rec.status === 'present') presentDays++;
      });

      const lopDays = Math.max(0, daysInMonth - presentDays);
      const lopPerDay = emp.salary.basic / daysInMonth;
      const lop = lopDays > 0 ? Math.round(lopPerDay * lopDays) : 0;

      const basic = emp.salary.basic;
      const hra = emp.salary.hra;
      const da = emp.salary.da;
      const other = emp.salary.otherAllowances;
      const grossSalary = basic + hra + da + other;
      const pf = emp.salary.pfDeduction || Math.round(basic * 0.12);
      const esi = emp.salary.esiDeduction || (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0);
      const totalDeductions = pf + esi + lop + (emp.salary.otherDeductions || 0);
      const netSalary = grossSalary - totalDeductions;

      const slipNumber = `SAL${emp.employeeId}${year}${String(month).padStart(2, '0')}`;

      const salary = await Salary.create({
        school: schoolId, employee: emp._id, month, year,
        workingDays: daysInMonth, presentDays, leaveDays: lopDays,
        earnings: { basic, hra, da, otherAllowances: other, overtime: 0, bonus: 0 },
        deductions: { pf, esi, tax: 0, loan: 0, lossOfPay: lop, other: 0 },
        grossSalary, totalDeductions, netSalary, slipNumber
      });
      generated.push(salary);
    }

    res.json({ success: true, message: `Generated ${generated.length} salary records`, generated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get salaries
const getSalaries = async (req, res) => {
  try {
    const { month, year, employeeId, status } = req.query;
    const query = { school: req.user.school };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (employeeId) query.employee = employeeId;
    if (status) query.status = status;

    const salaries = await Salary.find(query)
      .populate('employee', 'name employeeId role department photo')
      .populate('paidBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, salaries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Pay salary
const paySalary = async (req, res) => {
  try {
    const { method, transactionId, remarks } = req.body;
    const salary = await Salary.findOne({ _id: req.params.id, school: req.user.school })
      .populate('employee');
    if (!salary) return res.status(404).json({ success: false, message: 'Not found' });
    if (salary.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    salary.payment = { method, date: new Date(), transactionId, remarks };
    salary.status = 'paid';
    salary.paidBy = req.user._id;
    await salary.save();

    // Send SMS
    const school = await School.findById(req.user.school);
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (salary.employee.phone) {
      await sendSMS(req.user.school, salary.employee.phone, 'salary_paid',
        [salary.employee.name, salary.netSalary, months[salary.month - 1]],
        school.language, { employee: salary.employee._id }
      );
    }

    res.json({ success: true, salary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Payslip PDF
const getPayslipPDF = async (req, res) => {
  try {
    const salary = await Salary.findOne({ _id: req.params.id, school: req.user.school })
      .populate('employee');
    if (!salary) return res.status(404).json({ success: false, message: 'Not found' });
    const school = await School.findById(req.user.school);
    const pdf = await generatePaySlip(salary.toObject(), salary.employee.toObject(), school.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=PaySlip_${salary.slipNumber}.pdf`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update salary (bonus, adjustments)
const updateSalary = async (req, res) => {
  try {
    const salary = await Salary.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      req.body, { new: true }
    ).populate('employee', 'name employeeId');
    if (!salary) return res.status(404).json({ success: false, message: 'Not found' });
    // Recalculate
    salary.grossSalary = Object.values(salary.earnings).reduce((s, v) => s + v, 0);
    salary.totalDeductions = Object.values(salary.deductions).reduce((s, v) => s + v, 0);
    salary.netSalary = salary.grossSalary - salary.totalDeductions;
    await salary.save();
    res.json({ success: true, salary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateSalary, getSalaries, paySalary, getPayslipPDF, updateSalary };
