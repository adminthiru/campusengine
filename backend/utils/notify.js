const User    = require('../models/User');
const Student = require('../models/Student');
const School  = require('../models/School');

async function pushNotifications(users, title, message, type) {
  await Promise.all(users.map(user => {
    user.notifications.unshift({ title, message, type, createdAt: new Date() });
    if (user.notifications.length > 100) user.notifications = user.notifications.slice(0, 100);
    return user.save();
  }));
}

/**
 * Notify parent users for a list of students.
 * Checks school.parentPermissions[permKey] before sending.
 */
async function notifyParentUsers(schoolId, studentIds, permKey, title, message, type = 'info') {
  try {
    const school = await School.findById(schoolId).select('parentPermissions');
    if (!school || school.parentPermissions?.[permKey] === false) return;

    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    const students = await Student.find({ _id: { $in: ids }, school: schoolId }).select('primaryGuardian');
    const parentObjectIds = [...new Set(students.map(s => s.primaryGuardian?.toString()).filter(Boolean))];
    if (!parentObjectIds.length) return;

    const users = await User.find({ parentId: { $in: parentObjectIds }, school: schoolId, role: 'parent' });
    await pushNotifications(users, title, message, type);
  } catch (err) {
    console.error('[notify-parent]', err.message);
  }
}

/**
 * Notify student users directly (studentId field on User).
 * Checks school.studentPermissions[permKey] before sending.
 */
async function notifyStudentUsers(schoolId, studentIds, permKey, title, message, type = 'info') {
  try {
    const school = await School.findById(schoolId).select('studentPermissions');
    if (!school || school.studentPermissions?.[permKey] === false) return;

    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    const users = await User.find({ studentId: { $in: ids }, school: schoolId, role: 'student' });
    await pushNotifications(users, title, message, type);
  } catch (err) {
    console.error('[notify-student]', err.message);
  }
}

module.exports = { notifyParentUsers, notifyStudentUsers };
