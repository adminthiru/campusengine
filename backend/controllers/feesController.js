const FeeCollection = require('../models/FeeCollection');
const Student = require('../models/Student');
const Class = require('../models/Class');
const School = require('../models/School');
const Razorpay = require('razorpay');
const { generateFeeReceipt, generateFeesReport } = require('../utils/pdf');
const { sendSMS } = require('../utils/sms');
const { notifyParentUsers, notifyStudentUsers } = require('../utils/notify');
const escapeRegex = require('../utils/escapeRegex');

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const { academicYearForDate } = require('../utils/academicYear');

const getAcademicYear = async (schoolId) => {
  const school = await School.findById(schoolId);
  const sm = school?.academicYear?.startMonth || 6;
  const em = school?.academicYear?.endMonth || 3;
  return academicYearForDate(new Date(), sm, em);
};

// Build per-term objects from input array
const buildTerms = (termsInput) =>
  (termsInput || []).map(t => {
    const bd = (t.feeBreakdown || []).map(f => ({ ...f, amount: Number(f.amount) || 0 }));
    const totalAmount = bd.reduce((s, f) => s + f.amount, 0);
    const discountAmt = Number(t.discount?.amount) || 0;
    const netAmount = Math.max(0, totalAmount - discountAmt);
    return {
      name: t.name,
      feeBreakdown: bd,
      totalAmount,
      discount: { amount: discountAmt, reason: t.discount?.reason || '' },
      netAmount,
      paidAmount: 0,
      pendingAmount: netAmount,
      status: 'pending'
    };
  });

// Recalculate aggregate totals from terms array
const recalcAggregates = (fee) => {
  fee.totalAmount = fee.terms.reduce((s, t) => s + t.totalAmount, 0);
  fee.netAmount = fee.terms.reduce((s, t) => s + t.netAmount, 0);
  fee.paidAmount = fee.terms.reduce((s, t) => s + t.paidAmount, 0);
  fee.pendingAmount = fee.terms.reduce((s, t) => s + t.pendingAmount, 0) + (fee.lateFee || 0);
  fee.status = fee.pendingAmount <= 0 ? 'paid' : fee.paidAmount > 0 ? 'partial' : 'pending';
};

// Create fee record for a single student
const createFeeRecord = async (req, res) => {
  try {
    let { studentId, academicYear, terms: termsInput } = req.body;
    const schoolId = req.user.school;

    if (!academicYear) academicYear = await getAcademicYear(schoolId);
    if (!termsInput?.length) return res.status(400).json({ success: false, message: 'At least one term is required' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const existing = await FeeCollection.findOne({ school: schoolId, student: studentId, academicYear });
    if (existing) return res.status(400).json({ success: false, message: 'Fee record already exists for this academic year' });

    const terms = buildTerms(termsInput);
    const fee = await FeeCollection.create({ school: schoolId, student: studentId, academicYear, terms });
    recalcAggregates(fee);
    await fee.save();

    res.status(201).json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk create fee records for an entire class
const createBulkFeeRecords = async (req, res) => {
  try {
    let { classId, academicYear, terms: termsInput } = req.body;
    const schoolId = req.user.school;

    if (!academicYear) academicYear = await getAcademicYear(schoolId);
    if (!termsInput?.length) return res.status(400).json({ success: false, message: 'At least one term is required' });

    const students = await Student.find({ school: schoolId, currentClass: classId, status: 'active' });
    if (!students.length) return res.status(404).json({ success: false, message: 'No active students in this class' });

    const terms = buildTerms(termsInput);
    let created = 0, skipped = 0;

    for (const student of students) {
      const existing = await FeeCollection.findOne({ school: schoolId, student: student._id, academicYear });
      if (existing) { skipped++; continue; }
      const fee = new FeeCollection({ school: schoolId, student: student._id, academicYear, terms });
      recalcAggregates(fee);
      await fee.save();
      created++;
    }

    res.status(201).json({ success: true, created, skipped, message: `Created ${created} record${created !== 1 ? 's' : ''}${skipped ? `, ${skipped} already existed` : ''}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Collect payment — termName can be a specific term name or null/undefined for full payment
const collectPayment = async (req, res) => {
  try {
    const { feeId, termName, amount, method, remarks, discount } = req.body;
    const schoolId = req.user.school;
    const amt = Math.max(0, Number(amount) || 0);

    const fee = await FeeCollection.findOne({ _id: feeId, school: schoolId });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    // Optional discount applied before collecting. For a specific term it goes
    // to that term; for "pay all" it's distributed across pending terms in order.
    const applyDiscountToTerm = (term, add, reason) => {
      term.discount = { amount: (Number(term.discount?.amount) || 0) + add, reason: reason || term.discount?.reason || '' };
      term.netAmount = Math.max(0, (term.totalAmount || 0) - term.discount.amount);
      term.pendingAmount = Math.max(0, term.netAmount - (term.paidAmount || 0));
      term.status = term.pendingAmount <= 0 ? 'paid' : term.paidAmount > 0 ? 'partial' : 'pending';
    };
    const discountList = Array.isArray(req.body.discounts)
      ? req.body.discounts
      : (discount && Number(discount.amount) > 0 && termName ? [{ termName, amount: discount.amount, reason: discount.reason }] : []);
    for (const d of discountList) {
      if (!d || !d.termName || !(Number(d.amount) > 0)) continue;
      const term = fee.terms.find(t => t.name === d.termName);
      if (term) applyDiscountToTerm(term, Number(d.amount) || 0, d.reason);
    }

    let receiptNumber = null;
    if (amt > 0) {
      receiptNumber = `RCP${Date.now()}`;
      fee.payments.push({ termName: termName || null, amount: amt, method, date: new Date(), receiptNumber, collectedBy: req.user._id, remarks });
      if (termName) {
        const term = fee.terms.find(t => t.name === termName);
        if (term) {
          term.paidAmount += amt;
          term.pendingAmount = Math.max(0, term.netAmount - term.paidAmount);
          term.status = term.pendingAmount <= 0 ? 'paid' : term.paidAmount > 0 ? 'partial' : 'pending';
        }
      } else {
        // Distribute across pending terms in order
        let remaining = amt;
        for (const term of fee.terms) {
          if (remaining <= 0) break;
          const applying = Math.min(remaining, term.pendingAmount);
          if (applying > 0) {
            term.paidAmount += applying;
            term.pendingAmount = Math.max(0, term.pendingAmount - applying);
            term.status = term.pendingAmount <= 0 ? 'paid' : 'partial';
            remaining -= applying;
          }
        }
      }
    }

    recalcAggregates(fee);
    await fee.save();

    const student = await Student.findById(fee.student).populate('guardians');
    if (student && amt > 0) {
      const school = await School.findById(schoolId);
      for (const guardian of student.guardians) {
        if (guardian.phone) {
          await sendSMS(schoolId, guardian.phone, 'fee_paid',
            [student.name, amt, receiptNumber], guardian.language || school.language,
            { student: student._id, parent: guardian._id }
          );
        }
      }
      const termLabel = termName ? ` (${termName})` : '';
      const feePayMsg = `₹${amt.toLocaleString('en-IN')} received for ${student.name}${termLabel}. Receipt: ${receiptNumber}.`;
      notifyParentUsers(schoolId, [fee.student], 'notifyOnFeePayment', 'Fee Payment Received', feePayMsg, 'success');
      notifyStudentUsers(schoolId, [fee.student], 'notifyOnFeePayment', 'Fee Payment Received', feePayMsg, 'success');
    }

    res.json({ success: true, fee, receiptNumber });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create Razorpay order for online payment
const createRazorpayOrder = async (req, res) => {
  try {
    const { feeId, amount } = req.body;
    const fee = await FeeCollection.findOne({ _id: feeId, school: req.user.school });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `fee_${feeId}_${Date.now()}`
    });

    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Verify Razorpay payment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { feeId, razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, termName } = req.body;
    const crypto = require('crypto');
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');

    if (expectedSig !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const fee = await FeeCollection.findOne({ _id: feeId, school: req.user.school });
    const receiptNumber = `ONL${Date.now()}`;
    fee.payments.push({ termName: termName || null, amount, method: 'online', date: new Date(), razorpayOrderId, razorpayPaymentId, receiptNumber, collectedBy: req.user._id });

    if (termName) {
      const term = fee.terms.find(t => t.name === termName);
      if (term) {
        term.paidAmount += amount;
        term.pendingAmount = Math.max(0, term.netAmount - term.paidAmount);
        term.status = term.pendingAmount <= 0 ? 'paid' : 'partial';
      }
    } else {
      let remaining = amount;
      for (const term of fee.terms) {
        if (remaining <= 0) break;
        const applying = Math.min(remaining, term.pendingAmount);
        if (applying > 0) {
          term.paidAmount += applying;
          term.pendingAmount = Math.max(0, term.pendingAmount - applying);
          term.status = term.pendingAmount <= 0 ? 'paid' : 'partial';
          remaining -= applying;
        }
      }
    }

    recalcAggregates(fee);
    await fee.save();

    res.json({ success: true, fee, receiptNumber });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get fee records
const getFees = async (req, res) => {
  try {
    const { studentId, classId, status, academicYear, page = 1, limit = 20, search } = req.query;
    const query = { school: req.user.school };
    if (studentId) query.student = studentId;
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;

    if (classId) {
      const students = await Student.find({ school: req.user.school, currentClass: classId }).select('_id');
      query.student = { $in: students.map(s => s._id) };
    }

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      const matchedStudents = await Student.find({
        school: req.user.school,
        $or: [{ name: regex }, { admissionNumber: regex }]
      }).select('_id');
      const searchIds = matchedStudents.map(s => String(s._id));
      if (query.student?.$in) {
        query.student.$in = query.student.$in.filter(id => searchIds.includes(String(id)));
      } else {
        query.student = { $in: matchedStudents.map(s => s._id) };
      }
    }

    const total = await FeeCollection.countDocuments(query);
    const fees = await FeeCollection.find(query)
      .populate({ path: 'student', select: 'name admissionNumber rollNumber phone currentClass', populate: { path: 'currentClass', select: 'name section' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Hide records whose student was deleted (orphaned fee records).
    const visible = fees.filter(f => f.student);
    res.json({ success: true, fees: visible, total: total - (fees.length - visible.length) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Generate receipt PDF
const getReceiptPDF = async (req, res) => {
  try {
    const fee = await FeeCollection.findOne({ _id: req.params.id, school: req.user.school })
      .populate({ path: 'student', populate: { path: 'currentClass', select: 'name section' } });
    if (!fee) return res.status(404).json({ success: false, message: 'Not found' });

    const school = await School.findById(req.user.school);
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });

    const lastPayment = fee.payments?.length ? fee.payments[fee.payments.length - 1] : null;

    // Build combined breakdown from terms (new) or legacy feeBreakdown
    const breakdown = fee.terms?.length
      ? fee.terms.flatMap(t => (t.feeBreakdown || []).map(f => ({
          type: `${t.name}${f.type && f.type !== t.name ? ' - ' + f.type : ''}`,
          amount: Number(f.amount) || 0,
        })))
      : (fee.feeBreakdown || []).map(f => ({ type: f.type || '', amount: Number(f.amount) || 0 }));

    const data = {
      receiptNumber: lastPayment?.receiptNumber || `RCP${fee._id}`,
      date: lastPayment?.date || new Date(),
      studentName: fee.student?.name || 'N/A',
      admissionNumber: fee.student?.admissionNumber || '',
      className: fee.student?.currentClass?.name || '',
      section: fee.student?.currentClass?.section || '',
      academicYear: fee.academicYear || '',
      breakdown,
      discount: Number(fee.discount?.amount) || 0,
      discountReason: fee.discount?.reason || '',
      lateFee: Number(fee.lateFee) || 0,
      netAmount: Number(fee.netAmount) || 0,
      paidAmount: Number(fee.paidAmount) || 0,
      pendingAmount: Number(fee.pendingAmount) || 0,
      paymentMethod: lastPayment?.method || 'cash',
    };
    const pdf = await generateFeeReceipt(data, school.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt_${data.receiptNumber}.pdf`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Send fee reminder SMS
const sendFeeReminder = async (req, res) => {
  try {
    const { feeIds } = req.body;
    const fees = await FeeCollection.find({ _id: { $in: feeIds }, school: req.user.school })
      .populate({ path: 'student', populate: 'guardians' });
    const school = await School.findById(req.user.school);
    let sent = 0;
    for (const fee of fees) {
      if (fee.pendingAmount > 0 && fee.student?.guardians) {
        for (const g of fee.student.guardians) {
          if (g.phone) {
            await sendSMS(req.user.school, g.phone, 'fee_reminder',
              [fee.student.name, fee.pendingAmount, 'soon'],
              g.language || school.language, { student: fee.student._id, parent: g._id }
            );
            sent++;
          }
        }
        const feeReminderMsg = `₹${Number(fee.pendingAmount).toLocaleString('en-IN')} is pending. Please clear your dues at the earliest.`;
        notifyParentUsers(req.user.school, [fee.student._id], 'notifyOnFeeReminder', `Fee Reminder for ${fee.student.name}`, feeReminderMsg, 'warning');
        notifyStudentUsers(req.user.school, [fee.student._id], 'notifyOnFeeReminder', 'Fee Reminder', feeReminderMsg, 'warning');
      }
    }
    res.json({ success: true, message: `Reminders sent to ${sent} parents` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update fee record — edit breakdown and/or discount for a specific term
const updateFeeRecord = async (req, res) => {
  try {
    const { termName, discount, feeBreakdown } = req.body;
    const fee = await FeeCollection.findOne({ _id: req.params.id, school: req.user.school });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    let term = termName ? fee.terms.find(t => t.name === termName) : fee.terms[0];

    // If term not found by name, create a new one
    if (!term && termName) {
      const bd = (feeBreakdown || []).map(f => ({ type: f.type, amount: Number(f.amount) || 0 }));
      const totalAmount = bd.reduce((s, f) => s + f.amount, 0);
      const discAmt = Number(discount?.amount) || 0;
      const netAmount = Math.max(0, totalAmount - discAmt);
      fee.terms.push({
        name: termName,
        feeBreakdown: bd,
        totalAmount,
        discount: { amount: discAmt, reason: discount?.reason || '' },
        netAmount,
        paidAmount: 0,
        pendingAmount: netAmount,
        status: netAmount <= 0 ? 'paid' : 'pending'
      });
      recalcAggregates(fee);
      await fee.save();
      return res.json({ success: true, fee });
    }
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });

    // Update fee breakdown items if provided
    if (feeBreakdown !== undefined) {
      const bd = (feeBreakdown || []).map(f => ({ type: f.type, amount: Number(f.amount) || 0 }));
      term.feeBreakdown = bd;
      term.totalAmount = bd.reduce((s, f) => s + f.amount, 0);
    }

    // Update discount if provided
    if (discount !== undefined) {
      term.discount = { amount: Number(discount.amount) || 0, reason: discount.reason || '' };
    }

    // Recalculate term amounts
    const discAmt = Number(term.discount?.amount) || 0;
    term.netAmount = Math.max(0, term.totalAmount - discAmt);
    term.pendingAmount = Math.max(0, term.netAmount - term.paidAmount);
    term.status = term.pendingAmount <= 0 ? 'paid' : term.paidAmount > 0 ? 'partial' : 'pending';

    recalcAggregates(fee);
    await fee.save();
    res.json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reverse a payment (undo a mistaken collection)
const reversePayment = async (req, res) => {
  try {
    const fee = await FeeCollection.findOne({ _id: req.params.id, school: req.user.school });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    const paymentIdx = fee.payments.findIndex(p => p._id.toString() === req.params.paymentId);
    if (paymentIdx === -1) return res.status(404).json({ success: false, message: 'Payment not found' });

    const payment = fee.payments[paymentIdx];

    if (payment.termName) {
      const term = fee.terms.find(t => t.name === payment.termName);
      if (term) {
        term.paidAmount = Math.max(0, term.paidAmount - payment.amount);
        term.pendingAmount = Math.max(0, term.netAmount - term.paidAmount);
        term.status = term.paidAmount <= 0 ? 'pending' : term.pendingAmount <= 0 ? 'paid' : 'partial';
      }
    } else {
      // No specific term — reverse from the last paid terms
      let remaining = payment.amount;
      for (let i = fee.terms.length - 1; i >= 0 && remaining > 0; i--) {
        const term = fee.terms[i];
        const reversing = Math.min(remaining, term.paidAmount);
        if (reversing > 0) {
          term.paidAmount -= reversing;
          term.pendingAmount = Math.max(0, term.netAmount - term.paidAmount);
          term.status = term.paidAmount <= 0 ? 'pending' : 'partial';
          remaining -= reversing;
        }
      }
    }

    fee.payments.splice(paymentIdx, 1);
    recalcAggregates(fee);
    await fee.save();

    res.json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update fee structure for all students in a class
const updateClassFeeStructure = async (req, res) => {
  try {
    const { classId, academicYear, terms: termsInput } = req.body;
    const schoolId = req.user.school;

    if (!classId || !academicYear || !termsInput?.length) {
      return res.status(400).json({ success: false, message: 'classId, academicYear, and terms are required' });
    }

    const students = await Student.find({ school: schoolId, currentClass: classId, status: 'active' }).select('_id');
    const studentIds = students.map(s => s._id);

    const fees = await FeeCollection.find({ school: schoolId, student: { $in: studentIds }, academicYear });
    if (!fees.length) {
      return res.status(404).json({ success: false, message: 'No fee records found for this class and academic year. Create records first.' });
    }

    for (const fee of fees) {
      for (const termUpdate of termsInput) {
        const termObj = fee.terms.find(t => t.name === termUpdate.name);
        if (termObj) {
          const bd = (termUpdate.feeBreakdown || []).map(f => ({ type: f.type, amount: Number(f.amount) || 0 }));
          termObj.feeBreakdown = bd;
          termObj.totalAmount = bd.reduce((s, f) => s + f.amount, 0);
          const discAmt = Number(termObj.discount?.amount) || 0;
          termObj.netAmount = Math.max(0, termObj.totalAmount - discAmt);
          termObj.pendingAmount = Math.max(0, termObj.netAmount - termObj.paidAmount);
          termObj.status = termObj.pendingAmount <= 0 ? 'paid' : termObj.paidAmount > 0 ? 'partial' : 'pending';
        } else {
          // New category — add it as a new term
          const bd = (termUpdate.feeBreakdown || []).map(f => ({ type: f.type, amount: Number(f.amount) || 0 }));
          const totalAmount = bd.reduce((s, f) => s + f.amount, 0);
          fee.terms.push({
            name: termUpdate.name,
            feeBreakdown: bd,
            totalAmount,
            discount: { amount: 0, reason: '' },
            netAmount: totalAmount,
            paidAmount: 0,
            pendingAmount: totalAmount,
            status: 'pending'
          });
        }
      }
      recalcAggregates(fee);
      await fee.save();
    }

    res.json({ success: true, updated: fees.length, message: `Updated fee structure for ${fees.length} student${fees.length !== 1 ? 's' : ''}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Remove a single term from a fee record (only allowed when paidAmount === 0)
const deleteFeeTerm = async (req, res) => {
  try {
    const { termName } = req.body;
    if (!termName) return res.status(400).json({ success: false, message: 'termName is required' });
    const fee = await FeeCollection.findOne({ _id: req.params.id, school: req.user.school });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    const term = fee.terms.find(t => t.name === termName);
    if (!term) return res.status(404).json({ success: false, message: `Term "${termName}" not found` });
    if (term.paidAmount > 0) {
      return res.status(400).json({ success: false, message: `Cannot remove "${termName}" — ₹${term.paidAmount.toLocaleString('en-IN')} already collected` });
    }
    fee.terms = fee.terms.filter(t => t.name !== termName);
    recalcAggregates(fee);
    await fee.save();
    res.json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete fee record
const deleteFeeRecord = async (req, res) => {
  try {
    const fee = await FeeCollection.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    res.json({ success: true, message: 'Fee record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fees report PDF
const getFeesReport = async (req, res) => {
  try {
    const { classId, status, academicYear } = req.query;
    const query = { school: req.user.school };
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;

    let className = '';
    if (classId) {
      const Class = require('../models/Class');
      const cls = await Class.findById(classId);
      className = cls ? `${cls.name}${cls.section ? ' ' + cls.section : ''}` : '';
      const students = await Student.find({ school: req.user.school, currentClass: classId }).select('_id');
      query.student = { $in: students.map(s => s._id) };
    }

    const fees = await FeeCollection.find(query)
      .populate({ path: 'student', select: 'name admissionNumber phone currentClass', populate: { path: 'currentClass', select: 'name section' } })
      .sort({ createdAt: 1 });

    const school = await School.findById(req.user.school);
    const pdf = await generateFeesReport(fees.map(f => f.toObject()), school.toObject(), { className, status, academicYear });

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fees_report_${dateStr}.pdf`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Sync: create fee records for class students who don't have one yet,
// cloning their class's existing fee structure (template). ──────────────────
async function computeUnsynced(schoolId, academicYear) {
  const [fees, students] = await Promise.all([
    FeeCollection.find({ school: schoolId, academicYear }).select('student terms').lean(),
    Student.find({ school: schoolId, status: 'active' }).select('_id name currentClass').lean(),
  ]);
  const feeStudentIds = new Set(fees.map(f => String(f.student)));
  const classOf = {};
  students.forEach(s => { classOf[String(s._id)] = s.currentClass ? String(s.currentClass) : null; });
  const templateByClass = {};
  for (const f of fees) {
    const cls = classOf[String(f.student)];
    if (cls && !templateByClass[cls] && f.terms?.length) templateByClass[cls] = f.terms;
  }
  const unsynced = students.filter(s => {
    const cls = s.currentClass ? String(s.currentClass) : null;
    return cls && templateByClass[cls] && !feeStudentIds.has(String(s._id));
  });
  return { unsynced, templateByClass };
}

const cloneTerms = (tmpl) => (tmpl || []).map(t => {
  const fb = (t.feeBreakdown || []).map(x => ({ type: x.type, amount: Number(x.amount) || 0 }));
  const totalAmount = fb.reduce((a, b) => a + b.amount, 0);
  const discAmt = Number(t.discount?.amount) || 0;
  const netAmount = Math.max(0, totalAmount - discAmt);
  return { name: t.name, feeBreakdown: fb, totalAmount, discount: { amount: discAmt, reason: t.discount?.reason || '' }, netAmount, paidAmount: 0, pendingAmount: netAmount, status: 'pending' };
});

// Apply a class fee structure: create records for students who don't have one
// and update the terms of those who do — a single add/edit operation.
const applyClassFeeStructure = async (req, res) => {
  try {
    const schoolId = req.user.school;
    let { classId, academicYear, terms: termsInput } = req.body;
    if (!classId) return res.status(400).json({ success: false, message: 'Class is required' });
    if (!termsInput?.length) return res.status(400).json({ success: false, message: 'At least one fee category is required' });
    if (!academicYear) academicYear = await getAcademicYear(schoolId);

    const students = await Student.find({ school: schoolId, currentClass: classId, status: 'active' }).select('_id');
    if (!students.length) return res.status(404).json({ success: false, message: 'No active students in this class' });

    let created = 0, updated = 0;
    for (const s of students) {
      let fee = await FeeCollection.findOne({ school: schoolId, student: s._id, academicYear });
      if (!fee) {
        fee = new FeeCollection({ school: schoolId, student: s._id, academicYear, terms: buildTerms(termsInput) });
        recalcAggregates(fee);
        await fee.save();
        created++;
      } else {
        for (const tu of termsInput) {
          const bd = (tu.feeBreakdown || []).map(f => ({ type: f.type, amount: Number(f.amount) || 0 }));
          const totalAmount = bd.reduce((a, b) => a + b.amount, 0);
          const termObj = fee.terms.find(t => t.name === tu.name);
          if (termObj) {
            termObj.feeBreakdown = bd;
            termObj.totalAmount = totalAmount;
            const discAmt = Number(termObj.discount?.amount) || 0;
            termObj.netAmount = Math.max(0, totalAmount - discAmt);
            termObj.pendingAmount = Math.max(0, termObj.netAmount - termObj.paidAmount);
            termObj.status = termObj.pendingAmount <= 0 ? 'paid' : termObj.paidAmount > 0 ? 'partial' : 'pending';
          } else {
            fee.terms.push({ name: tu.name, feeBreakdown: bd, totalAmount, discount: { amount: 0, reason: '' }, netAmount: totalAmount, paidAmount: 0, pendingAmount: totalAmount, status: 'pending' });
          }
        }
        recalcAggregates(fee);
        await fee.save();
        updated++;
      }
    }
    res.json({ success: true, created, updated, message: `${created} added, ${updated} updated` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getUnsyncedCount = async (req, res) => {
  try {
    const schoolId = req.user.school;
    let { academicYear } = req.query;
    if (!academicYear) academicYear = await getAcademicYear(schoolId);
    const { unsynced } = await computeUnsynced(schoolId, academicYear);
    res.json({ success: true, count: unsynced.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const syncClassStudents = async (req, res) => {
  try {
    const schoolId = req.user.school;
    let academicYear = req.body.academicYear || req.query.academicYear;
    if (!academicYear) academicYear = await getAcademicYear(schoolId);
    const { unsynced, templateByClass } = await computeUnsynced(schoolId, academicYear);
    let created = 0;
    for (const s of unsynced) {
      const terms = cloneTerms(templateByClass[String(s.currentClass)]);
      if (!terms.length) continue;
      const fee = new FeeCollection({ school: schoolId, student: s._id, academicYear, terms });
      recalcAggregates(fee);
      await fee.save();
      created++;
    }
    res.json({ success: true, created, message: `Synced ${created} student${created !== 1 ? 's' : ''}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { createFeeRecord, createBulkFeeRecords, updateFeeRecord, updateClassFeeStructure, collectPayment, reversePayment, createRazorpayOrder, verifyRazorpayPayment, getFees, getFeesReport, getReceiptPDF, sendFeeReminder, deleteFeeRecord, deleteFeeTerm, getUnsyncedCount, syncClassStudents, applyClassFeeStructure };
