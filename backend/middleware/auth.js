const jwt = require('jsonwebtoken');
const User = require('../models/User');
const School = require('../models/School');
const { cleanPath, moduleForPath, actionForRequest, isAlwaysAllowed } = require('../config/modules');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// Roles that always have full school access (bypass the permission matrix).
const FULL_ROLES = ['admin', 'correspondent', 'super_admin'];
const isFullAccess = (user) => FULL_ROLES.includes(user.role) || user.accessType === 'full';
const isCustomAccess = (user) => user.accessType === 'custom' || user.role === 'staff';

// For a delegated (custom) staff login, decide whether the current request is
// allowed by their module × CRUD permission matrix. Returns null if allowed, or
// a { status, code, message } object to reject with.
const enforceModulePermission = (req) => {
  const user = req.user;
  if (isFullAccess(user) || !isCustomAccess(user)) return null;  // full / legacy → not gated here

  const path = cleanPath(req.originalUrl);
  if (isAlwaysAllowed(path, req.method)) return null;            // self-service + shared reads

  const mod = moduleForPath(path);
  // Not a gated module (e.g. /users, /admin, /school writes, /super-admin) → denied for staff
  if (!mod) return { status: 403, code: 'NO_PERMISSION', message: 'You do not have access to this area' };

  const action = actionForRequest(req.method, path);
  const perms = user.permissions || {};
  if (perms[mod.key] && perms[mod.key][action] === true) return null;

  return { status: 403, code: 'NO_PERMISSION', message: `You do not have '${action}' permission for ${mod.label}` };
};

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    // Attach school info
    if (req.user.school) {
      req.school = await School.findById(req.user.school);
    }
    // Custom (delegated) staff logins are gated by their permission matrix here,
    // so every authenticated route is governed without per-route changes.
    const denial = enforceModulePermission(req);
    if (denial) return res.status(denial.status).json({ success: false, message: denial.message, code: denial.code });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    // Delegated staff are already gated by the permission matrix in `protect`;
    // the role-list check doesn't apply to them.
    if (isCustomAccess(req.user)) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Role '${req.user.role}' not authorized` });
    }
    next();
  };
};

const checkSubscription = async (req, res, next) => {
  if (!req.school || req.user.role === 'super_admin') return next();
  const school = req.school;
  const now = new Date();
  if (school.subscription.status === 'trial') {
    if (now > school.subscription.trialEndDate) {
      return res.status(402).json({ success: false, message: 'Trial expired. Please subscribe.', code: 'TRIAL_EXPIRED' });
    }
  } else if (school.subscription.status === 'expired') {
    return res.status(402).json({ success: false, message: 'Subscription expired.', code: 'SUBSCRIPTION_EXPIRED' });
  }
  next();
};

module.exports = { generateToken, protect, authorize, checkSubscription };
