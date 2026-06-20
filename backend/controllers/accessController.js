const User = require('../models/User');
const AccessRole = require('../models/AccessRole');
const { MODULES, ACTIONS } = require('../config/modules');
const { sendEmail, invitationEmail } = require('../utils/email');
const { genTempPassword } = require('../utils/tempPassword');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normalise an incoming permissions object to { module: {view,add,edit,delete} }
// using only known module keys / actions (defends against junk input).
const normalizePermissions = (input = {}) => {
  const out = {};
  for (const m of MODULES) {
    const p = input[m.key] || {};
    out[m.key] = {
      view:   !!p.view,
      add:    !!p.add,
      edit:   !!p.edit,
      delete: !!p.delete,
    };
  }
  return out;
};

const PORTAL_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ── Module registry (for the permission-matrix UI) ─────────────────────────────
const getModules = (req, res) => {
  res.json({ success: true, modules: MODULES.map(m => ({ key: m.key, label: m.label, path: m.path })), actions: ACTIONS });
};

// ── Access Roles (reusable templates) ──────────────────────────────────────────
const listAccessRoles = async (req, res) => {
  try {
    const roles = await AccessRole.find({ school: req.user.school }).sort({ name: 1 });
    // attach a count of logins under each role
    const counts = await User.aggregate([
      { $match: { school: req.user.school, accessType: 'custom' } },
      { $group: { _id: '$accessRole', n: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.n]));
    res.json({ success: true, roles: roles.map(r => ({ ...r.toObject(), loginCount: countMap[String(r._id)] || 0 })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createAccessRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Role name is required' });
    const exists = await AccessRole.findOne({ school: req.user.school, name: name.trim() });
    if (exists) return res.status(400).json({ success: false, message: 'A role with this name already exists' });
    const role = await AccessRole.create({
      school: req.user.school,
      name: name.trim(),
      description: description || '',
      permissions: normalizePermissions(permissions),
      createdBy: req.user._id,
    });
    res.json({ success: true, role });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateAccessRole = async (req, res) => {
  try {
    const role = await AccessRole.findOne({ _id: req.params.id, school: req.user.school });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (req.body.name && req.body.name.trim() && req.body.name.trim() !== role.name) {
      const dupe = await AccessRole.findOne({ school: req.user.school, name: req.body.name.trim(), _id: { $ne: role._id } });
      if (dupe) return res.status(400).json({ success: false, message: 'A role with this name already exists' });
      role.name = req.body.name.trim();
    }
    if (req.body.description !== undefined) role.description = req.body.description;
    if (req.body.isActive !== undefined) role.isActive = req.body.isActive;

    let permsChanged = false;
    if (req.body.permissions) {
      role.permissions = normalizePermissions(req.body.permissions);
      role.markModified('permissions');   // Mixed type — flag the mutation
      permsChanged = true;
    }
    await role.save();

    // Re-sync the matrix to all non-customized logins under this role + keep
    // their category label in sync with the role name.
    if (permsChanged || req.body.name) {
      await User.updateMany(
        { school: req.user.school, accessRole: role._id, permissionsCustomized: { $ne: true } },
        { $set: { permissions: role.permissions, category: role.name } }
      );
    }
    res.json({ success: true, role });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteAccessRole = async (req, res) => {
  try {
    const inUse = await User.countDocuments({ school: req.user.school, accessRole: req.params.id });
    if (inUse > 0) return res.status(400).json({ success: false, message: `Cannot delete — ${inUse} login(s) use this role. Reassign or remove them first.` });
    const role = await AccessRole.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Staff Logins (custom users) ─────────────────────────────────────────────────
const listStaffLogins = async (req, res) => {
  try {
    const users = await User.find({ school: req.user.school, accessType: 'custom' })
      .select('name email phone staffCode category accessRole permissions permissionsCustomized isActive firstLogin lastLogin createdAt')
      .populate('accessRole', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, logins: users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createStaffLogin = async (req, res) => {
  try {
    const { name, email, phone, accessRoleId, employeeId, staffCode } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!accessRoleId) return res.status(400).json({ success: false, message: 'Please select an access role' });
    if (!staffCode || !staffCode.trim()) return res.status(400).json({ success: false, message: 'Staff code is required' });
    const code = staffCode.trim();

    const role = await AccessRole.findOne({ _id: accessRoleId, school: req.user.school });
    if (!role) return res.status(404).json({ success: false, message: 'Access role not found' });

    // Optional link to an existing employee record.
    let linkedEmployee = null;
    if (employeeId) {
      const Employee = require('../models/Employee');
      linkedEmployee = await Employee.findOne({ _id: employeeId, school: req.user.school });
      if (!linkedEmployee) return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const emailNorm = email.trim().toLowerCase();
    // The staff code is the unique identifier for a staff (web-admin) login within
    // the school — it lets the SAME email also exist as a separate app login.
    const codeDupe = await User.findOne({ school: req.user.school, staffCode: code });
    if (codeDupe) return res.status(400).json({ success: false, message: 'That staff code is already in use. Please choose another.' });

    const tempPassword = genTempPassword();
    const user = await User.create({
      school: req.user.school,
      name: name.trim(),
      email: emailNorm,
      phone: phone || '',
      password: tempPassword,                 // hashed by the model pre-save hook
      role: 'staff',
      accessType: 'custom',
      accessRole: role._id,
      permissions: normalizePermissions(role.permissions),
      permissionsCustomized: false,
      category: role.name,
      staffCode: code,
      employeeId: linkedEmployee?._id,
      firstLogin: true,
      isActive: true,
    });

    // Best-effort email (only if SMTP is configured) — on-screen password is primary.
    if (process.env.EMAIL_USER) {
      sendEmail(invitationEmail(user.name, user.email, tempPassword, PORTAL_URL, role.name, req.school?.name))
        .catch(() => {});
    }

    res.json({ success: true, login: { _id: user._id, name: user.name, email: user.email, staffCode: user.staffCode }, tempPassword });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateStaffLogin = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school, accessType: 'custom' });
    if (!user) return res.status(404).json({ success: false, message: 'Login not found' });

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;

    // Switching the access role re-seeds permissions from the new role (unless
    // custom-overridden permissions are sent in the same request).
    if (req.body.accessRoleId && String(req.body.accessRoleId) !== String(user.accessRole)) {
      const role = await AccessRole.findOne({ _id: req.body.accessRoleId, school: req.user.school });
      if (!role) return res.status(404).json({ success: false, message: 'Access role not found' });
      user.accessRole = role._id;
      user.category = role.name;
      user.permissions = normalizePermissions(role.permissions);
      user.permissionsCustomized = false;
      user.markModified('permissions');
    }

    // Fine-tuning this login's matrix decouples it from role re-syncs.
    if (req.body.permissions) {
      user.permissions = normalizePermissions(req.body.permissions);
      user.permissionsCustomized = true;
      user.markModified('permissions');
    }

    await user.save();
    res.json({ success: true, login: { _id: user._id } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const resetStaffPassword = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school, accessType: 'custom' });
    if (!user) return res.status(404).json({ success: false, message: 'Login not found' });
    const tempPassword = genTempPassword();
    user.password = tempPassword;             // hashed by pre-save hook
    user.firstLogin = true;
    await user.save();
    res.json({ success: true, tempPassword });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteStaffLogin = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, school: req.user.school, accessType: 'custom' });
    if (!user) return res.status(404).json({ success: false, message: 'Login not found' });
    res.json({ success: true, message: 'Login removed' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getModules,
  listAccessRoles, createAccessRole, updateAccessRole, deleteAccessRole,
  listStaffLogins, createStaffLogin, updateStaffLogin, resetStaffPassword, deleteStaffLogin,
};
