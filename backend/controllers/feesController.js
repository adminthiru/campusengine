const FeeCollection = require('../models/FeeCollection');
const Student = require('../models/Student');
const Class = require('../models/Class');
const School = require('../models/School');
const Razorpay = require('razorpay');
const { generateFeeReceipt } = require('../utils/pdf');
const { sendSMS } = require('../utils/sms');
const { v4: uuidv4 } = require('uuid');

const getRazorpay = (school) => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

// Create fee record for student
const createFeeRecord = async (req, res) => {
  try {
    const { studentId, academicYear, feeBreakdown, discount, installmentPlan, term } = req.body;
    const schoolId = req.user.school;

    const student = await Student.findById(studentId).populate('currentClass');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const totalAmount = feeBreakdown.reduce((s, f) => s + f.amount, 0);
    const discountAmt = discount?.amount || 0;
    const netAmount = totalAmount - discountAmt;

    const existing = await FeeCollection.findOne({ school: schoolId, student: studentId, academicYear, term });
    if (existing) return res.status(400).json({ success: false, message: 'Fee record already exists for this period' });

    const fee = await FeeCollection.create({
      school: schoolId, student: studentId, academicYear,
      feeBreakdown, totalAmount, discount, netAmount,
      pendingAmount: netAmount, installmentPlan, term
    });

    res.status(201).json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Collect payment (cash/bank transfer)
const collectPayment = async (req, res) => {
  try {
    const { feeId, amount, method, remarks, installmentIndex } = req.body;
    const schoolId = req.user.school;

    const fee = await FeeCollection.findOne({ _id: feeId, school: schoolId });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    const receiptNumber = `RCP${Date.now()}`;
    fee.payments.push({
      amount, method, date: new Date(),
      receiptNumber, collectedBy: req.user._id, remarks
    });
    fee.paidAmount += amount;
    fee.pendingAmount = fee.netAmount + (fee.lateFee || 0) - fee.paidAmount;
    fee.status = fee.pendingAmount <= 0 ? 'paid' : fee.paidAmount > 0 ? 'partial' : 'pending';

    // Update installment if specified
    if (installmentIndex !== undefined && fee.installmentPlan[installmentIndex]) {
      fee.installmentPlan[installmentIndex].paidDate = new Date();
      fee.installmentPlan[installmentIndex].status = 'paid';
    }

    await fee.save();

    // Send SMS confirmation
    const student = await Student.findById(fee.student).populate('guardians');
    if (student) {
      const school = await School.findById(schoolId);
      for (const guardian of student.guardians) {
        if (guardian.phone) {
          await sendSMS(schoolId, guardian.phone, 'fee_paid',
            [student.name, amount, receiptNumber], guardian.language || school.language,
            { student: student._id, parent: guardian._id }
          );
        }
      }
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
      amount: amount * 100, // in paise
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
    const { feeId, razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
    const crypto = require('crypto');
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');

    if (expectedSig !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const fee = await FeeCollection.findOne({ _id: feeId, school: req.user.school });
    const receiptNumber = `ONL${Date.now()}`;
    fee.payments.push({
      amount, method: 'online', date: new Date(),
      razorpayOrderId, razorpayPaymentId,
      receiptNumber, collectedBy: req.user._id
    });
    fee.paidAmount += amount;
    fee.pendingAmount = fee.netAmount - fee.paidAmount;
    fee.status = fee.pendingAmount <= 0 ? 'paid' : 'partial';
    await fee.save();

    res.json({ success: true, fee, receiptNumber });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get fee records
const getFees = async (req, res) => {
  try {
    const { studentId, classId, status, academicYear, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (studentId) query.student = studentId;
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;

    if (classId) {
      const students = await Student.find({ school: req.user.school, currentClass: classId }).select('_id');
      query.student = { $in: students.map(s => s._id) };
    }

    const total = await FeeCollection.countDocuments(query);
    const fees = await FeeCollection.find(query)
      .populate('student', 'name admissionNumber rollNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, fees, total });
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
    const lastPayment = fee.payments[fee.payments.length - 1];
    const data = {
      receiptNumber: lastPayment?.receiptNumber || `RCP${fee._id}`,
      date: lastPayment?.date || new Date(),
      studentName: fee.student.name,
      admissionNumber: fee.student.admissionNumber,
      className: fee.student.currentClass?.name,
      section: fee.student.currentClass?.section,
      academicYear: fee.academicYear,
      breakdown: fee.feeBreakdown,
      discount: fee.discount?.amount || 0,
      discountReason: fee.discount?.reason,
      lateFee: fee.lateFee || 0,
      netAmount: fee.netAmount,
      paidAmount: fee.paidAmount,
      pendingAmount: fee.pendingAmount,
      paymentMethod: lastPayment?.method || 'cash'
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
            const dueDate = fee.installmentPlan?.find(i => i.status === 'pending')?.dueDate;
            await sendSMS(req.user.school, g.phone, 'fee_reminder',
              [fee.student.name, fee.pendingAmount, dueDate ? new Date(dueDate).toLocaleDateString('en-IN') : 'soon'],
              g.language || school.language, { student: fee.student._id, parent: g._id }
            );
            sent++;
          }
        }
      }
    }
    res.json({ success: true, message: `Reminders sent to ${sent} parents` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createFeeRecord, collectPayment, createRazorpayOrder, verifyRazorpayPayment, getFees, getReceiptPDF, sendFeeReminder };
