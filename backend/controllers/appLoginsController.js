const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Employee = require('../models/Employee');
const { genTempPassword } = require('../utils/tempPassword');

// App logins = portal accounts for the school's own people (students, parents,
// teachers/staff). Created selectively by the admin; each gets a temp password
// (shown once) + firstLogin=true, and lands in its built-in role portal.

const EMPLOYEE_ROLE_MAP = (r) => (
  ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'admin'].includes(r) ? r : 'teacher'
);

// Roles considered "teacher/staff" portal logins.
const STAFF_ROLES = ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'admin'];
// Owner roles must NOT be manageable here (so an admin can't delete their own
// login and lock the school out). They never appear in the App Logins lists.
const OWNER_ROLES = ['admin', 'correspondent'];
const STAFF_LIST_ROLES = ['teacher', 'principal', 'accountant', 'maintenance'];

const identifierFor = (u) => {
  if (u.role === 'student') return u.admissionNumber || u.email;
  if (u.role === 'parent')  return u.phone || u.email;
  return u.email;
};

const classLabel = (c) => (c ? `${c.name}${c.section ? ' - ' + c.section : ''}` : '');

// ── List ────────────────────────────────────────────────────────────────────
const listAppLogins = async (req, res) => {
  try {
    const { type } = req.query;
    const base = { school: req.user.school };

    if (type === 'student') {
      const users = await User.find({ ...base, role: 'student' })
        .select('name email admissionNumber isActive firstLogin lastLogin createdAt studentId')
        .populate({ path: 'studentId', select: 'currentClass', populate: { path: 'currentClass', select: 'name section' } })
        .sort({ createdAt: -1 });
      // Remove orphans — student doc was deleted but User wasn't cleaned up
      const orphanIds = users.filter(u => !u.studentId).map(u => u._id);
      if (orphanIds.length) User.deleteMany({ _id: { $in: orphanIds } }).catch(() => {});
      const logins = users.filter(u => u.studentId).map(u => ({
        _id: u._id, name: u.name, identifier: identifierFor(u),
        isActive: u.isActive, firstLogin: u.firstLogin, lastLogin: u.lastLogin,
        classId: u.studentId?.currentClass?._id ? String(u.studentId.currentClass._id) : null,
        className: classLabel(u.studentId?.currentClass),
      }));
      return res.json({ success: true, logins });
    }

    if (type === 'parent') {
      const users = await User.find({ ...base, role: 'parent' })
        .select('name email phone isActive firstLogin lastLogin createdAt parentId')
        .populate({ path: 'parentId', select: 'students', populate: { path: 'students', select: 'currentClass', populate: { path: 'currentClass', select: 'name section' } } })
        .sort({ createdAt: -1 });
      // Remove orphans — parent doc deleted or all children deleted
      const orphanIds = users
        .filter(u => !u.parentId || (u.parentId.students || []).length === 0)
        .map(u => u._id);
      if (orphanIds.length) {
        User.deleteMany({ _id: { $in: orphanIds } }).catch(() => {});
        Parent.updateMany({ user: { $in: orphanIds } }, { $unset: { user: 1 } }).catch(() => {});
      }
      const logins = users
        .filter(u => u.parentId && (u.parentId.students || []).length > 0)
        .map(u => {
          const classes = (u.parentId?.students || []).map(s => s.currentClass).filter(Boolean);
          const uniq = [...new Map(classes.map(c => [String(c._id), c])).values()];
          return {
            _id: u._id, name: u.name, identifier: identifierFor(u),
            isActive: u.isActive, firstLogin: u.firstLogin, lastLogin: u.lastLogin,
            classIds: uniq.map(c => String(c._id)),
            className: uniq.map(classLabel).join(', '),
          };
        });
      return res.json({ success: true, logins });
    }

    if (type === 'teacher') {
      const users = await User.find({ ...base, role: { $in: STAFF_LIST_ROLES }, accessType: { $ne: 'custom' } })
        .select('name email role isActive firstLogin lastLogin createdAt employeeId')
        .sort({ createdAt: -1 });
      // Remove orphans — employee deleted but User wasn't cleaned up
      const linkedEmpIds = users.map(u => u.employeeId).filter(Boolean);
      const existingEmps = await Employee.find({ _id: { $in: linkedEmpIds } }).select('_id');
      const existingEmpSet = new Set(existingEmps.map(e => String(e._id)));
      const orphanIds = users
        .filter(u => u.employeeId && !existingEmpSet.has(String(u.employeeId)))
        .map(u => u._id);
      if (orphanIds.length) User.deleteMany({ _id: { $in: orphanIds } }).catch(() => {});
      const logins = users
        .filter(u => !u.employeeId || existingEmpSet.has(String(u.employeeId)))
        .map(u => ({
          _id: u._id, name: u.name, identifier: identifierFor(u), role: u.role,
          isActive: u.isActive, firstLogin: u.firstLogin, lastLogin: u.lastLogin,
        }));
      return res.json({ success: true, logins });
    }

    return res.status(400).json({ success: false, message: 'Invalid type' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Create ──────────────────────────────────────────────────────────────────
const createAppLogin = async (req, res) => {
  try {
    const { type, personId } = req.body;
    if (!type || !personId) return res.status(400).json({ success: false, message: 'Type and person are required' });
    const school = req.user.school;
    const tempPassword = genTempPassword();

    let userDoc, profileModel, profile, identifier;

    if (type === 'student') {
      profile = await Student.findOne({ _id: personId, school });
      if (!profile) return res.status(404).json({ success: false, message: 'Student not found' });
      if (profile.user) return res.status(400).json({ success: false, message: 'This student already has a login' });
      identifier = profile.admissionNumber;
      userDoc = {
        school, name: profile.name, role: 'student',
        email: profile.email || `${profile.admissionNumber.toLowerCase()}@skl.internal`,
        phone: profile.phone, admissionNumber: profile.admissionNumber,
        studentId: profile._id, password: tempPassword, firstLogin: true, isActive: true,
      };
      profileModel = Student;
    } else if (type === 'parent') {
      profile = await Parent.findOne({ _id: personId, school });
      if (!profile) return res.status(404).json({ success: false, message: 'Parent not found' });
      if (profile.user) return res.status(400).json({ success: false, message: 'This parent already has a login' });
      if (!profile.phone) return res.status(400).json({ success: false, message: 'Parent has no mobile number on file' });
      identifier = profile.phone;
      userDoc = {
        school, name: profile.name, role: 'parent',
        email: profile.email || `${profile.phone}@skl.internal`,
        phone: profile.phone, parentId: profile._id,
        password: tempPassword, firstLogin: true, isActive: true,
      };
      profileModel = Parent;
    } else if (type === 'teacher') {
      profile = await Employee.findOne({ _id: personId, school });
      if (!profile) return res.status(404).json({ success: false, message: 'Employee not found' });
      if (profile.user) return res.status(400).json({ success: false, message: 'This employee already has a login' });
      if (!profile.email) return res.status(400).json({ success: false, message: 'Employee has no email on file' });
      identifier = profile.email;
      userDoc = {
        school, name: profile.name, role: EMPLOYEE_ROLE_MAP(profile.role),
        email: profile.email, phone: profile.phone, employeeId: profile._id,
        password: tempPassword, firstLogin: true, isActive: true,
      };
      profileModel = Employee;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    // Guard duplicate email within the school.
    const dupe = await User.findOne({ school, email: userDoc.email });
    if (dupe) return res.status(400).json({ success: false, message: 'A login with this identity already exists' });

    const user = await User.create(userDoc);
    await profileModel.updateOne({ _id: profile._id }, { $set: { user: user._id } });

    res.json({ success: true, login: { _id: user._id, name: user.name }, identifier, tempPassword });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Reset password ────────────────────────────────────────────────────────────
const resetAppLoginPassword = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school });
    if (!user) return res.status(404).json({ success: false, message: 'Login not found' });
    const tempPassword = genTempPassword();
    user.password = tempPassword;
    user.firstLogin = true;
    await user.save();
    res.json({ success: true, identifier: identifierFor(user), tempPassword, login: { name: user.name } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Guard: owner accounts (admin/correspondent) and your own login can't be
// deactivated or removed through App Logins — that would risk locking the school out.
const isProtectedTarget = (req, user) =>
  OWNER_ROLES.includes(user.role) || String(user._id) === String(req.user._id);

// ── Activate / deactivate ─────────────────────────────────────────────────────
const updateAppLogin = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school });
    if (!user) return res.status(404).json({ success: false, message: 'Login not found' });
    if (req.body.isActive === false && isProtectedTarget(req, user))
      return res.status(403).json({ success: false, message: 'Owner / your own login cannot be deactivated here.' });
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    await user.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Delete (revoke) ───────────────────────────────────────────────────────────
const deleteAppLogin = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school });
    if (!user) return res.status(404).json({ success: false, message: 'Login not found' });
    if (isProtectedTarget(req, user))
      return res.status(403).json({ success: false, message: 'Owner / your own login cannot be removed here.' });
    if (user.studentId) await Student.updateOne({ _id: user.studentId }, { $unset: { user: 1 } });
    if (user.parentId)  await Parent.updateOne({ _id: user.parentId }, { $unset: { user: 1 } });
    if (user.employeeId) await Employee.updateOne({ _id: user.employeeId }, { $unset: { user: 1 } });
    await User.deleteOne({ _id: user._id });
    res.json({ success: true, message: 'Login removed' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Cleanup legacy dummy student/parent logins ────────────────────────────────
const cleanupLegacyLogins = async (req, res) => {
  try {
    const school = req.user.school;
    const users = await User.find({ school, role: { $in: ['student', 'parent'] } }).select('_id studentId parentId');
    const studentIds = users.filter(u => u.studentId).map(u => u.studentId);
    const parentIds  = users.filter(u => u.parentId).map(u => u.parentId);
    await Student.updateMany({ _id: { $in: studentIds } }, { $unset: { user: 1 } });
    await Parent.updateMany({ _id: { $in: parentIds } }, { $unset: { user: 1 } });
    const result = await User.deleteMany({ school, role: { $in: ['student', 'parent'] } });
    res.json({ success: true, removed: result.deletedCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  listAppLogins, createAppLogin, resetAppLoginPassword, updateAppLogin, deleteAppLogin, cleanupLegacyLogins,
};
