const User = require('../models/User');
const School = require('../models/School');
const Employee = require('../models/Employee');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const { generateToken } = require('../middleware/auth');
const { sendEmail, invitationEmail } = require('../utils/email');
const { v4: uuidv4 } = require('uuid');

// Register new school (admin self-register)
const registerSchool = async (req, res) => {
  try {
    const { schoolName, adminName, email, password, phone } = req.body;

    // Check if email already used
    const existingUser = await User.findOne({ email, school: null });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Generate school code
    const code = schoolName.substring(0, 3).toUpperCase() + Date.now().toString().slice(-5);

    const school = await School.create({ name: schoolName, code, phone, email });

    const user = await User.create({
      school: school._id,
      name: adminName,
      email,
      phone,
      password,
      role: 'admin'
    });

    const token = generateToken(user._id);

    // Update User index - email+school combo
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        school: { id: school._id, name: school.name, code: school.code, profileCompleted: school.profileCompleted },
        subscription: school.subscription
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password, schoolCode } = req.body;
    const isIdentifier = email && !email.includes('@');

    let user;
    if (req.body.isSuperAdmin) {
      user = await User.findOne({ email, role: 'super_admin' });
    } else if (isIdentifier) {
      // Admission number (student) or mobile number (parent)
      let sf = {};
      if (schoolCode) {
        const school = await School.findOne({ code: schoolCode.toUpperCase() });
        if (!school) return res.status(400).json({ success: false, message: 'Invalid school code' });
        sf = { school: school._id };
      }
      user = await User.findOne({ admissionNumber: email, ...sf })
          || await User.findOne({ phone: email, role: 'parent', ...sf });
    } else if (schoolCode) {
      const school = await School.findOne({ code: schoolCode.toUpperCase() });
      if (!school) return res.status(400).json({ success: false, message: 'Invalid school code' });
      user = await User.findOne({ email, school: school._id });
    } else {
      // Try to find by email (for admin who may not know code)
      user = await User.findOne({ email }).sort({ createdAt: -1 });
    }

    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account disabled' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    user.lastLogin = new Date();
    await user.save();

    const school = user.school ? await School.findById(user.school) : null;
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        firstLogin: user.firstLogin,
        avatar: user.avatar,
        // Custom RBAC — needed by the frontend to gate sidebar/routes immediately
        accessType: user.accessType,
        permissions: user.permissions,
        accessRole: user.accessRole,
        category: user.category,
        school: school ? {
          id: school._id,
          name: school.name,
          code: school.code,
          profileCompleted: school.profileCompleted,
          logo: school.logo
        } : null,
        subscription: school?.subscription || null,
        employeeId: user.employeeId,
        studentId: user.studentId,
        parentId: user.parentId
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const school = user.school ? await School.findById(user.school) : null;
    res.json({
      success: true,
      user: {
        ...user.toObject(),
        school: school ? {
          id: school._id,
          name: school.name,
          code: school.code,
          profileCompleted: school.profileCompleted,
          logo: school.logo,
          language: school.language
        } : null,
        subscription: school?.subscription || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword;
    user.firstLogin = false;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, language, avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone, language, avatar }, { returnDocument: 'after' }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Initialize super admin (run once)
const initSuperAdmin = async (req, res) => {
  try {
    const existing = await User.findOne({ role: 'super_admin' });
    if (existing) return res.status(400).json({ success: false, message: 'Super admin already exists' });
    const user = await User.create({
      name: 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD,
      role: 'super_admin'
    });
    res.json({ success: true, message: 'Super admin created' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Mark notification as read
const markNotification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const notif = user.notifications.id(req.params.notifId);
    if (notif) { notif.read = true; await user.save(); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { registerSchool, login, getMe, changePassword, updateProfile, initSuperAdmin, markNotification };
