const Employee = require('../models/Employee');
const User = require('../models/User');
const { sendEmail, invitationEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');
const { generateJobOffer } = require('../utils/pdf');
const School = require('../models/School');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_JOB_OFFER = `Dear {{employee_name}},

We are pleased to offer you the position of {{designation}} at {{school_name}}.

Your employment details are as follows:
- Designation: {{designation}}
- Date of Joining: {{joining_date}}
- Gross Salary: Rs. {{gross_salary}} per month

This offer is subject to satisfactory completion of document verification.

Please report to the school office on your joining date with all original documents.

We look forward to your valuable contribution.

Yours sincerely,
{{school_name}}
Date: {{date}}`;

// Create employee
const createEmployee = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const school = await School.findById(schoolId);

    // Generate employee ID
    const count = await Employee.countDocuments({ school: schoolId });
    const employeeId = `EMP${school.code}${String(count + 1).padStart(4, '0')}`;

    const employee = await Employee.create({ ...req.body, school: schoolId, employeeId });

    // Create user account
    const tempPassword = `Temp@${uuidv4().slice(0, 6)}`;
    const userRole = req.body.role === 'teacher' ? 'teacher' :
                     req.body.role === 'principal' ? 'principal' :
                     req.body.role === 'accountant' ? 'accountant' :
                     req.body.role === 'maintenance' ? 'maintenance' :
                     req.body.role === 'correspondent' ? 'correspondent' : 'admin';

    const existingUser = await User.findOne({ email: req.body.email, school: schoolId });
    if (!existingUser) {
      const user = await User.create({
        school: schoolId, name: req.body.name, email: req.body.email,
        phone: req.body.phone, password: tempPassword, role: userRole, employeeId: employee._id
      });
      employee.user = user._id;
      await employee.save();

      // Send invitation
      const portalUrl = `${process.env.CLIENT_URL}?school=${school.code}`;
      if (req.body.email) {
        await sendEmail(invitationEmail(req.body.name, req.body.email, tempPassword, portalUrl, userRole));
      }
      if (req.body.phone) {
        await sendSMS(schoolId, req.body.phone, 'invitation',
          [req.body.name, portalUrl, req.body.email, tempPassword],
          school.language, { employee: employee._id }
        );
      }
    }

    const populated = await Employee.findById(employee._id).populate('subjects', 'name');
    res.status(201).json({ success: true, employee: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all employees
const getEmployees = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = { school: req.user.school };
    if (role) query.role = role;
    if (status) query.status = status;
    if (search) query.$or = [
      { name: new RegExp(search, 'i') },
      { employeeId: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];

    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query)
      .populate('subjects', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, employees, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single employee
const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, school: req.user.school })
      .populate('subjects', 'name code color');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      req.body, { new: true }
    ).populate('subjects', 'name code');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete employee
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { status: 'inactive' }, { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (employee.user) await User.findByIdAndUpdate(employee.user, { isActive: false });
    res.json({ success: true, message: 'Employee deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Generate job offer PDF
const getJobOfferPDF = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, school: req.user.school });
    if (!employee) return res.status(404).json({ success: false, message: 'Not found' });
    const school = await School.findById(req.user.school);
    const template = req.body.template || DEFAULT_JOB_OFFER;
    const pdfBuffer = await generateJobOffer(employee.toObject(), school.toObject(), template);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=JobOffer_${employee.employeeId}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Assign tasks (for maintenance)
const assignTask = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, school: req.user.school });
    if (!employee) return res.status(404).json({ success: false, message: 'Not found' });
    employee.tasks.push(req.body);
    await employee.save();
    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, school: req.user.school });
    if (!employee) return res.status(404).json({ success: false, message: 'Not found' });
    const task = employee.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    Object.assign(task, req.body);
    if (req.body.status === 'completed') task.completedAt = new Date();
    await employee.save();
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createEmployee, getEmployees, getEmployee, updateEmployee, deleteEmployee, getJobOfferPDF, assignTask, updateTask };
