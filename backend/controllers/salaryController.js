const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const School = require('../models/School');
const { Expense } = require('../models/Expense');
const { getHolidaysForMonth, getWorkingDaysForMonth } = require('../utils/holidays');
const { generatePaySlip } = require('../utils/pdf');
const { sendSMS } = require('../utils/sms');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Persist a salary structure onto the Employee master so every future month
// inherits it (salary is set once per employee; per-month records derive from it).
const persistEmployeeSalary = async (schoolId, employeeId, earnings = {}, deductions = {}) => {
  const set = {};
  if (earnings.basic           !== undefined) set['salary.basic']           = Number(earnings.basic) || 0;
  if (earnings.hra             !== undefined) set['salary.hra']             = Number(earnings.hra) || 0;
  if (earnings.da              !== undefined) set['salary.da']              = Number(earnings.da) || 0;
  if (earnings.otherAllowances !== undefined) set['salary.otherAllowances'] = Number(earnings.otherAllowances) || 0;
  if (deductions.pf            !== undefined) set['salary.pfDeduction']     = Number(deductions.pf) || 0;
  if (deductions.esi           !== undefined) set['salary.esiDeduction']    = Number(deductions.esi) || 0;
  if (deductions.other         !== undefined) set['salary.otherDeductions'] = Number(deductions.other) || 0;
  if (Object.keys(set).length) {
    await Employee.updateOne({ _id: employeeId, school: schoolId }, { $set: set });
  }
};

// Upsert (create or update) an advance expense keyed on slipNumber stored in billNumber.
// If advanceAmount is 0, removes the expense so the record stays in sync.
const syncAdvanceExpense = async ({ school, employeeId, employeeName, advanceAmount, month, year, userId, slipNumber, paymentMethod }) => {
  if (!slipNumber) return;
  const amount = Number(advanceAmount) || 0;
  if (amount <= 0) {
    await Expense.deleteOne({ school, category: 'salary', billNumber: slipNumber });
    return;
  }
  const set = {
    school,
    title: `Advance — ${employeeName || 'Employee'}`,
    category: 'salary',
    amount,
    date: new Date(),
    description: `Salary advance for ${MONTHS[month - 1]} ${year} · ${employeeName} (${employeeId})`,
    createdBy: userId,
    billNumber: slipNumber,
  };
  // Only set the payment method when supplied so we don't overwrite a
  // previously-chosen category on unrelated amount edits. Default to cash on
  // first creation.
  if (paymentMethod) set.paymentMethod = paymentMethod;
  await Expense.findOneAndUpdate(
    { school, category: 'salary', billNumber: slipNumber },
    { $set: set, $setOnInsert: paymentMethod ? {} : { paymentMethod: 'cash' } },
    { upsert: true, returnDocument: 'after' }
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

    // Load school salary config + working-days policy once (shared by all employees).
    const school = await School.findById(schoolId).select('salaryConfig workingDays');
    const cfg = school?.salaryConfig || {};
    const lopMethod           = cfg.lopMethod            || 'calendar_days';
    const workingDaysPerMonth = cfg.workingDaysPerMonth  || 26;
    const halfDayEnabled      = cfg.halfDayEnabled       !== false;
    const halfDayFactor       = cfg.halfDayDeductionFactor ?? 0.5;
    const empSatSchedule      = cfg.empSaturdaySchedule  || 'school_default';

    const { workingDays: actualWorkingDays } =
      await getWorkingDaysForMonth(schoolId, year, month, school?.workingDays || {}, empSatSchedule);
    const holidays = await getHolidaysForMonth(schoolId, year, month);
    const baseDivisor = lopMethod === 'fixed_30' ? 30 : lopMethod === 'working_days' ? workingDaysPerMonth : actualWorkingDays;
    const divisor = Math.max(1, baseDivisor);

    const generated = [];
    let updated = 0;
    for (const emp of employees) {
      const existing = await Salary.findOne({ school: schoolId, employee: emp._id, month, year });
      // Leave paid records and ones that already carry a salary untouched.
      if (existing && (existing.status === 'paid' || (existing.grossSalary || 0) > 0)) continue;

      // Resolve the salary structure: the employee master, else the most recent
      // prior record that has a salary (and backfill the master from it so future
      // months inherit it directly).
      let s = {
        basic: emp.salary?.basic || 0, hra: emp.salary?.hra || 0, da: emp.salary?.da || 0,
        otherAllowances: emp.salary?.otherAllowances || 0,
        pf: emp.salary?.pfDeduction || 0, esi: emp.salary?.esiDeduction || 0, other: emp.salary?.otherDeductions || 0,
      };
      if (!(s.basic > 0)) {
        const prior = await Salary.findOne({ school: schoolId, employee: emp._id, grossSalary: { $gt: 0 } }).sort({ year: -1, month: -1 });
        if (prior) {
          s = {
            basic: prior.earnings?.basic || 0, hra: prior.earnings?.hra || 0, da: prior.earnings?.da || 0,
            otherAllowances: prior.earnings?.otherAllowances || 0,
            pf: prior.deductions?.pf || 0, esi: prior.deductions?.esi || 0, other: prior.deductions?.other || 0,
          };
          await persistEmployeeSalary(schoolId, emp._id, s, { pf: s.pf, esi: s.esi, other: s.other });
        }
      }

      // Count attendance for the month (unmarked days are neither present nor LOP).
      const attendanceRecords = await Attendance.find({
        school: schoolId, type: 'employee',
        date: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) },
        'records.employee': emp._id
      });
      let presentDays = 0, lopDays = 0;
      attendanceRecords.forEach(a => {
        const dateStr = new Date(a.date).toISOString().slice(0, 10);
        if (holidays.has(dateStr)) return;
        const rec = a.records.find(r => r.employee?.toString() === emp._id.toString());
        if (!rec) return;
        if (rec.status === 'present') presentDays += 1;
        else if (rec.status === 'half_day' && halfDayEnabled) { presentDays += halfDayFactor; lopDays += (1 - halfDayFactor); }
        else if (rec.status === 'absent') lopDays += 1;
      });

      const { basic, hra, da, otherAllowances: other } = s;
      const grossSalary = basic + hra + da + other;
      const lop = lopDays > 0 ? Math.round((basic / divisor) * lopDays) : 0;
      const pf = s.pf || Math.round(basic * 0.12);
      const esi = s.esi || (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0);
      const totalDeductions = pf + esi + lop + (s.other || 0);
      const netSalary = grossSalary - totalDeductions;
      const slipNumber = existing?.slipNumber || `SAL${emp.employeeId}${year}${String(month).padStart(2, '0')}`;

      const payload = {
        workingDays: actualWorkingDays, presentDays, leaveDays: lopDays,
        earnings: { basic, hra, da, otherAllowances: other, overtime: existing?.earnings?.overtime || 0, bonus: existing?.earnings?.bonus || 0 },
        deductions: { pf, esi, tax: existing?.deductions?.tax || 0, loan: existing?.deductions?.loan || 0, lossOfPay: lop, other: s.other || 0 },
        grossSalary, totalDeductions, netSalary,
      };

      if (existing) {
        // Refresh a blank placeholder record from the resolved structure.
        Object.assign(existing, payload);
        await existing.save();
        if (grossSalary > 0) updated++;
      } else {
        const salary = await Salary.create({ school: schoolId, employee: emp._id, month, year, slipNumber, ...payload });
        generated.push(salary);
      }
    }

    res.json({ success: true, message: `Generated ${generated.length} salary records`, generated, updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get salaries
const getSalaries = async (req, res) => {
  try {
    const { month, year, employeeId, status, fromYear, fromMonth, toYear, toMonth } = req.query;
    const query = { school: req.user.school };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (employeeId) query.employee = employeeId;
    if (status) query.status = status;
    // Academic-year range: filter on a numeric (year*100 + month) key so the
    // Jun–Mar span across two calendar years is captured precisely.
    if (fromYear && fromMonth && toYear && toMonth) {
      const fromKey = Number(fromYear) * 100 + Number(fromMonth);
      const toKey   = Number(toYear) * 100 + Number(toMonth);
      query.$expr = {
        $and: [
          { $gte: [{ $add: [{ $multiply: ['$year', 100] }, '$month'] }, fromKey] },
          { $lte: [{ $add: [{ $multiply: ['$year', 100] }, '$month'] }, toKey] },
        ]
      };
    }

    const salaries = await Salary.find(query)
      .populate('employee', 'name employeeId role designation department photo salary')
      .populate('paidBy', 'name')
      .sort({ createdAt: -1 });

    // Hide orphaned records whose employee was deleted (populate -> null).
    // Convert to plain objects so we can attach a non-schema `needsRecalc` flag.
    const visible = salaries.filter(s => s.employee).map(s => s.toObject());

    // For pending records, show the real working days (same basis as the
    // Attendance module) and present days counted from attendance — so the list
    // is accurate regardless of how/when a record was created. Paid records keep
    // their stored snapshot.
    const pending = visible.filter(s => s.status !== 'paid');
    if (pending.length) {
      const schoolDoc = await School.findById(req.user.school).select('workingDays salaryConfig');
      const cfg = schoolDoc?.salaryConfig || {};
      const satSchedule = cfg.empSaturdaySchedule || 'school_default';
      const halfDayEnabled = cfg.halfDayEnabled !== false;
      const halfDayFactor = cfg.halfDayDeductionFactor ?? 0.5;

      const monthKeys = [...new Set(pending.map(s => `${s.year}_${s.month}`))];
      const wdByMonth = {}, holByMonth = {}, attByMonth = {};
      for (const key of monthKeys) {
        const [y, m] = key.split('_').map(Number);
        const { workingDays } = await getWorkingDaysForMonth(req.user.school, y, m, schoolDoc?.workingDays || {}, satSchedule);
        wdByMonth[key]  = workingDays;
        holByMonth[key] = await getHolidaysForMonth(req.user.school, y, m);
        attByMonth[key] = await Attendance.find({
          school: req.user.school, type: 'employee',
          date: { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) },
        });
      }
      for (const s of pending) {
        const key = `${s.year}_${s.month}`;
        const actualWorking = wdByMonth[key];
        const holidays = holByMonth[key];
        let present = 0;
        for (const a of (attByMonth[key] || [])) {
          const dateStr = new Date(a.date).toISOString().slice(0, 10);
          if (holidays.has(dateStr)) continue; // holiday — not counted
          const rec = a.records.find(r => r.employee?.toString() === s.employee._id.toString());
          if (!rec) continue;
          if (rec.status === 'present') present += 1;
          else if (rec.status === 'half_day' && halfDayEnabled) present += halfDayFactor;
        }
        // Flag a record as stale when its stored working/present days disagree
        // with the live attendance figures, or when the employee now has a salary
        // master but this record is still blank (set after the record was created).
        const m = s.employee?.salary || {};
        const masterGross = (m.basic || 0) + (m.hra || 0) + (m.da || 0) + (m.otherAllowances || 0);
        const blankButMastered = (s.grossSalary || 0) === 0 && masterGross > 0;
        s.needsRecalc = s.workingDays !== actualWorking || s.presentDays !== present || blankButMastered;
        s.workingDays = actualWorking;
        s.presentDays = present;
      }
    }

    res.json({ success: true, salaries: visible });
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

// Set the payment category for an employee's salary advance (asked after the
// admin saves an advance). Updates the linked advance expense so the amount is
// deducted from that method's running balance.
const setAdvanceMethod = async (req, res) => {
  try {
    const { method } = req.body;
    if (!method) return res.status(400).json({ success: false, message: 'Payment method is required' });
    const salary = await Salary.findOne({ _id: req.params.id, school: req.user.school });
    if (!salary) return res.status(404).json({ success: false, message: 'Not found' });
    if (!salary.slipNumber) return res.status(400).json({ success: false, message: 'No slip number on this salary' });
    const result = await Expense.updateOne(
      { school: req.user.school, category: 'salary', billNumber: salary.slipNumber },
      { $set: { paymentMethod: method } }
    );
    if (!result.matchedCount) return res.status(404).json({ success: false, message: 'No advance found for this salary' });
    res.json({ success: true });
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
      req.body, { returnDocument: 'after' }
    ).populate('employee', 'name employeeId');
    if (!salary) return res.status(404).json({ success: false, message: 'Not found' });

    // Recalculate
    salary.grossSalary = Object.values(salary.earnings).reduce((s, v) => s + v, 0);
    salary.totalDeductions = Object.values(salary.deductions).reduce((s, v) => s + v, 0);
    salary.netSalary = salary.grossSalary - salary.totalDeductions;
    await salary.save();

    // Persist the structure to the employee master so future months inherit it.
    await persistEmployeeSalary(req.user.school, salary.employee?._id, salary.earnings, salary.deductions);

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

    // Default to actual working days (matches Attendance) when not supplied.
    let defaultWorkingDays;
    {
      const schoolDoc = await School.findById(schoolId).select('workingDays salaryConfig');
      const satSchedule = schoolDoc?.salaryConfig?.empSaturdaySchedule || 'school_default';
      const r = await getWorkingDaysForMonth(schoolId, Number(year), Number(month), schoolDoc?.workingDays || {}, satSchedule);
      defaultWorkingDays = r.workingDays;
    }
    const wDays = Number(workingDays) || defaultWorkingDays || new Date(year, month, 0).getDate();
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

    // Persist to the employee master so future months inherit this salary.
    await persistEmployeeSalary(schoolId, employeeId, { basic, hra, da, otherAllowances }, { pf, esi, other });

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

    // Actual working days for the month (same basis as the Attendance module),
    // not raw calendar days.
    const schoolDoc = await School.findById(schoolId).select('workingDays salaryConfig');
    const satSchedule = schoolDoc?.salaryConfig?.empSaturdaySchedule || 'school_default';
    const { workingDays } = await getWorkingDaysForMonth(schoolId, Number(year), Number(month), schoolDoc?.workingDays || {}, satSchedule);

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

const recalculateSalary = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const existing = await Salary.findOne({ _id: req.params.id, school: schoolId });
    if (!existing) return res.status(404).json({ success: false, message: 'Salary record not found' });
    if (existing.status === 'paid') return res.status(400).json({ success: false, message: 'Cannot recalculate a paid salary' });

    const { month, year, employee: empId } = existing;
    const emp = await Employee.findById(empId);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Load salary config + working-days policy (so actual working days match
    // Attendance and getSalaries, keeping needsRecalc stable after a recalc).
    const school = await School.findById(schoolId).select('salaryConfig workingDays');
    const cfg = school?.salaryConfig || {};
    const lopMethod           = cfg.lopMethod            || 'calendar_days';
    const workingDaysPerMonth = cfg.workingDaysPerMonth  || 26;
    const halfDayEnabled      = cfg.halfDayEnabled       !== false;
    const halfDayFactor       = cfg.halfDayDeductionFactor ?? 0.5;

    const daysInMonth = new Date(year, month, 0).getDate();

    // Calculate actual working days using employee Saturday schedule
    const empSatSchedule2 = cfg.empSaturdaySchedule || 'school_default';
    const { workingDays: actualWorkingDays } =
      await getWorkingDaysForMonth(schoolId, year, month, school?.workingDays || {}, empSatSchedule2);
    const holidays  = await getHolidaysForMonth(schoolId, year, month);
    const baseDivisor = lopMethod === 'fixed_30' ? 30 : lopMethod === 'working_days' ? workingDaysPerMonth : actualWorkingDays;
    const divisor = Math.max(1, baseDivisor);

    const attendanceRecords = await Attendance.find({
      school: schoolId, type: 'employee',
      date: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) },
      'records.employee': empId
    });

    // Skip holiday dates; count only explicitly marked present/absent/half_day
    let presentDays = 0, lopDays = 0;
    attendanceRecords.forEach(a => {
      const dateStr = new Date(a.date).toISOString().slice(0, 10);
      if (holidays.has(dateStr)) return;
      const rec = a.records.find(r => r.employee?.toString() === empId.toString());
      if (!rec) return;
      if (rec.status === 'present') {
        presentDays += 1;
      } else if (rec.status === 'half_day' && halfDayEnabled) {
        presentDays += halfDayFactor;
        lopDays    += (1 - halfDayFactor);
      } else if (rec.status === 'absent') {
        lopDays += 1;
      }
    });

    // Fall back to existing salary earnings if employee model has no salary configured
    const basic = emp.salary?.basic || existing.earnings?.basic || 0;
    const hra   = emp.salary?.hra   || existing.earnings?.hra   || 0;
    const da    = emp.salary?.da    || existing.earnings?.da    || 0;
    const other = emp.salary?.otherAllowances || existing.earnings?.otherAllowances || 0;

    const lopPerDay = basic / divisor;
    const lop = lopDays > 0 ? Math.round(lopPerDay * lopDays) : 0;
    const grossSalary = basic + hra + da + other;
    const pf  = emp.salary?.pfDeduction  || existing.deductions?.pf  || Math.round(basic * 0.12);
    const esi = emp.salary?.esiDeduction || existing.deductions?.esi || (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0);
    const totalDeductions = pf + esi + lop + (emp.salary?.otherDeductions || existing.deductions?.other || 0);
    const netSalary = grossSalary - totalDeductions;

    const updated = await Salary.findByIdAndUpdate(req.params.id, {
      // Display actual working days (matches Attendance); divisor is LOP-only.
      workingDays: actualWorkingDays, presentDays, leaveDays: lopDays,
      earnings: { basic, hra, da, otherAllowances: other, overtime: existing.earnings?.overtime || 0, bonus: existing.earnings?.bonus || 0 },
      deductions: { pf, esi, tax: existing.deductions?.tax || 0, loan: existing.deductions?.loan || 0, lossOfPay: lop, other: existing.deductions?.other || 0 },
      grossSalary, totalDeductions, netSalary
    }, { returnDocument: 'after' }).populate('employee', 'name employeeId role');

    res.json({ success: true, salary: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateSalary, createSalaryRecord, getSalaries, paySalary, revertSalary, getPayslipPDF, updateSalary, deleteSalaryRecord, getAttendanceSummary, recalculateSalary, setAdvanceMethod };
