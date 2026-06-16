const mongoose = require('mongoose');

// A reusable access-role template that a school admin defines (e.g. "Librarian",
// "Front Office"). Holds a module → CRUD permission matrix. Staff logins are
// created under a role and inherit its permissions (snapshotted onto the user).
const accessRoleSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },          // "Librarian"
  description: { type: String },
  // { <moduleKey>: { view, add, edit, delete } }
  permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

accessRoleSchema.index({ school: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('AccessRole', accessRoleSchema);
