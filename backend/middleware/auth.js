const jwt = require('jsonwebtoken');
const User = require('../models/User');
const School = require('../models/School');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
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
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
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
