const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const School = require('../models/School');
const { Expense } = require('../models/Expense');
const { generatePaySlip } = require('../utils/pdf');
const { sendSMS } = require('../utils/sms');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Upsert (create or update) an advance expense keyed on slipNumber stored in billNumber.
// If advanceAmount is 0, removes the expense so the record stays in sync.
const syncAdvanceExpense = async ({ school, employeeId, employeeName, advanceAmount, month, year, userId, slipNumber }) => {
  if (!slipNumber) return;
  const amount = Number(advanceAmount) || 0;
  if (amount <= 0) {
    await Expense.deleteOne({ school, category: 'salary', billNumber: slipNumber });
    return;
  }
  await Expense.findOneAndUpdate(
    { school, category: 'salary', billNumber: slipNumber },
    {
      $set: {
        school,
        title: `Advance — ${employeeName || 'Employee'}`,
        category: 'salary',
        amount,
        date: new Date(),
        paymentMethod: 'cash',
        description: `Salary advance for ${MONTHS[month - 1]} ${year} · ${employeeName} (${employeeId})`,
        createdBy: userId,
        billNumber: slipNumber,
      }
    },
    { upsert: true, new: true }
  );
};

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

    // Sync advance expense — upserts if loan > 0, removes if 0
    const loanAmount = Number(req.body.deductions?.loan) || 0;
    try {
      await syncAdvanceExpense({
        school: req.user.school,
        employeeId: salary.employee?.employeeId,
        employeeName: salary.employee?.name,
        advanceAmount: loanAmount,
        month: salary.month,
        year: salary.year,
        userId: req.user._id,
        slipNumber: salary.slipNumber,
      });
    } catch (expErr) {
      console.error('Advance expense sync failed:', expErr.message);
    }

    res.json({ success: true, salary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create a single salary record manually
const createSalaryRecord = async (req, res) => {
  try {
    const { employeeId, month, year, earnings = {}, deductions = {}, workingDays, presentDays } = req.body;
    const schoolId = req.user.school;

    const emp = await Employee.findOne({ _id: employeeId, school: schoolId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const existing = await Salary.findOne({ school: schoolId, employee: employeeId, month, year });
    if (existing) return res.status(400).json({ success: false, message: `Salary record already exists for ${emp.name} for this month` });

    const basic = Number(earnings.basic) || 0;
    const hra = Number(earnings.hra) || 0;
    const da = Number(earnings.da) || 0;
    const otherAllowances = Number(earnings.otherAllowances) || 0;
    const overtime = Number(earnings.overtime) || 0;
    const bonus = Number(earnings.bonus) || 0;
    const grossSalary = basic + hra + da + otherAllowances + overtime + bonus;

    const wDays = Number(workingDays) || new Date(year, month, 0).getDate();
    const pDays = Math.min(Number(presentDays) || wDays, wDays);
    const lopDays = Math.max(0, wDays - pDays);
    const lop = lopDays > 0 && basic > 0 ? Math.round((basic / wDays) * lopDays) : 0;

    const pf = Number(deductions.pf) ?? Math.round(basic * 0.12);
    const esi = Number(deductions.esi) ?? (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0);
    const loan = Number(deductions.loan) || 0;
    const tax = Number(deductions.tax) || 0;
    const other = Number(deductions.other) || 0;
    const totalDeductions = pf + esi + tax + loan + lop + other;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    const slipNumber = `SAL${emp.employeeId}${year}${String(month).padStart(2, '0')}`;

    const salary = await Salary.create({
      school: schoolId, employee: employeeId, month, year,
      workingDays: wDays, presentDays: pDays, leaveDays: lopDays,
      earnings: { basic, hra, da, otherAllowances, overtime, bonus },
      deductions: { pf, esi, tax, loan, lossOfPay: lop, other },
      grossSalary, totalDeductions, netSalary, slipNumber
    });

    await salary.populate('employee', 'name employeeId role department');

    if (loan > 0) {
      try {
        await syncAdvanceExpense({
          school: schoolId,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          advanceAmount: loan,
          month, year,
          userId: req.user._id,
          slipNumber,
        });
      } catch (expErr) {
        console.error('Advance expense sync failed:', expErr.message);
      }
    }

    res.status(201).json({ success: true, salary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Attendance summary for a single employee for salary LOP calculation
const getAttendanceSummary = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    const schoolId = req.user.school;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month, year are required' });
    }

    const workingDays = new Date(year, month, 0).getDate();
    const records = await Attendance.find({
      school: schoolId, type: 'employee',
      date: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) },
      'records.employee': employeeId
    });

    const stats = { present: 0, absent: 0, half_day: 0, leave: 0, late: 0 };
    records.forEach(a => {
      const rec = a.records.find(r => r.employee?.toString() === employeeId);
      if (!rec) return;
      const s = rec.status?.toLowerCase();
      if (s === 'present' || s === 'p') stats.present++;
      else if (s === 'absent' || s === 'a') stats.absent++;
      else if (s === 'half_day' || s === 'h' || s === 'halfday') stats.half_day++;
      else if (s === 'leave' || s === 'cl' || s === 'l') stats.leave++;
      else if (s === 'late') stats.late++;
    });

    // CL = no deduction; half_day = 0.5 day LOP; absent = 1 day LOP
    const lopDays = stats.absent + (stats.half_day * 0.5);
    const effectivePresentDays = workingDays - lopDays;

    res.json({ success: true, workingDays, stats, lopDays, effectivePresentDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Revert paid salary back to pending
const revertSalary = async (req, res) => {
  try {
    const salary = await Salary.findOne({ _id: req.params.id, school: req.user.school });
    if (!salary) return res.status(404).json({ success: false, message: 'Not found' });
    if (salary.status !== 'paid') return res.status(400).json({ success: false, message: 'Salary is not paid' });

    salary.status = 'pending';
    salary.payment = undefined;
    salary.paidBy = undefined;
    await salary.save();

    await salary.populate('employee', 'name employeeId role department');
    res.json({ success: true, salary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete salary record
const deleteSalaryRecord = async (req, res) => {
  try {
    const salary = await Salary.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!salary) return res.status(404).json({ success: false, message: 'Salary record not found' });
    res.json({ success: true, message: 'Salary record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateSalary, createSalaryRecord, getSalaries, paySalary, revertSalary, getPayslipPDF, updateSalary, deleteSalaryRecord, getAttendanceSummary };
