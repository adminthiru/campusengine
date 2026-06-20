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
    enum: ['super_admin', 'admin', 'principal', 'teacher', 'accountant', 'student', 'parent', 'maintenance', 'correspondent', 'staff'],
    required: true
  },
  // ── Custom RBAC (staff logins) ──────────────────────────────────────────────
  // 'full'   → admin/correspondent (resolved at runtime; bypasses checks)
  // 'custom' → delegated staff login gated by `permissions`
  // 'legacy' → built-in roles (principal/teacher/accountant/...) — unchanged
  accessType: { type: String, enum: ['full', 'custom', 'legacy'], default: 'legacy' },
  accessRole: { type: mongoose.Schema.Types.ObjectId, ref: 'AccessRole' },
  // Effective permissions snapshot: { <moduleKey>: { view, add, edit, delete } }
  permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  // True once a login is individually fine-tuned, so role re-syncs skip it
  permissionsCustomized: { type: Boolean, default: false },
  category: { type: String },   // display label, mirrors the access-role name
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
  // Staff sub-admin logins (web admin: Librarian/Principal/…) carry a unique
  // staffCode. App logins / regular accounts leave it null. This lets the SAME
  // email exist as both an app login (staffCode null) and a staff login (with a
  // code) — they're told apart at sign-in by the staff code.
  staffCode: { type: String, default: null },
}, { timestamps: true });

// Uniqueness keyed on (email, school, staffCode): existing/app accounts have a
// null staffCode, so email stays unique among them; a staff login adds a
// non-null code, so it can reuse an email that already has an app login.
userSchema.index({ email: 1, school: 1, staffCode: 1 }, { unique: true });
// Partial (NOT sparse): a sparse compound index still indexes docs where only
// admissionNumber is null (school is present), so multiple non-student users
// (admin/teacher/parent) collide on { admissionNumber: null, school }. A partial
// index only enforces uniqueness when admissionNumber is an actual string.
// New index name avoids a conflict with the legacy index (dropped in db.js).
userSchema.index(
  { admissionNumber: 1, school: 1 },
  { unique: true, partialFilterExpression: { admissionNumber: { $type: 'string' } }, name: 'admissionNumber_school_partial' }
);

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
