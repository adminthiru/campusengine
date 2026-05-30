const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'principal', 'teacher', 'accountant', 'student', 'parent', 'maintenance', 'correspondent'],
    required: true
  },
  language: { type: String, enum: ['en', 'ta'], default: 'en' },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  firstLogin: { type: Boolean, default: true },
  lastLogin: { type: Date },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  notifications: [{
    title: String,
    message: String,
    type: { type: String, enum: ['info', 'warning', 'success', 'error'] },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  // Reference to role-specific profile
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
  admissionNumber: { type: String },
}, { timestamps: true });

userSchema.index({ email: 1, school: 1 }, { unique: true });
userSchema.index({ admissionNumber: 1, school: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
