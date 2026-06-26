const User = require('../models/User');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');
const Employee = require('../models/Employee');
const { getMessaging } = require('../config/firebase');

// ── Low level: persist an in-app notification on each user ───────────────────────
async function persistInApp(users, { title, body, type }) {
  await Promise.all(users.map(u => {
    u.notifications.unshift({ title, message: body, type, createdAt: new Date() });
    if (u.notifications.length > 100) u.notifications = u.notifications.slice(0, 100);
    return u.save();
  }));
}

// ── Low level: send an FCM push to every device token of the given users ─────────
// Reusable by any feature. Prunes tokens FCM reports as dead.
async function pushToUsers(users, { title, body, data = {} }) {
  const messaging = getMessaging();
  if (!messaging) return { sent: 0, skipped: 'push-disabled' };

  const owners = [];
  users.forEach(u => (u.fcmTokens || []).forEach(token => owners.push({ token, userId: u._id })));
  if (!owners.length) return { sent: 0 };

  // FCM data values must be strings.
  const strData = {};
  Object.entries(data).forEach(([k, v]) => { strData[k] = String(v); });

  try {
    const resp = await messaging.sendEachForMulticast({
      tokens: owners.map(o => o.token),
      notification: { title, body },
      data: strData,
      webpush: { notification: { title, body }, fcmOptions: {} },
    });

    // Remove tokens that are no longer valid so we stop pushing to dead devices.
    const dead = {};
    resp.responses.forEach((r, i) => {
      const code = r.success ? '' : (r.error?.code || '');
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
        const { userId, token } = owners[i];
        (dead[userId] = dead[userId] || []).push(token);
      }
    });
    await Promise.all(Object.entries(dead).map(([userId, tokens]) =>
      User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: tokens } } })));

    return { sent: resp.successCount, failed: resp.failureCount };
  } catch (err) {
    console.error('[push] send failed:', err.message);
    return { sent: 0, error: err.message };
  }
}

// ── Mid level: persist in-app + push to a deduped set of user docs ───────────────
async function notifyUsers(users, { title, body, type = 'info', data = {} }) {
  if (!users.length) return { users: 0, sent: 0 };
  await persistInApp(users, { title, body, type });
  const pushRes = await pushToUsers(users, { title, body, data });
  return { users: users.length, ...pushRes };
}

// ── High level: notify everyone tied to a set of classes (in-app + push) ─────────
// Reusable for Exams now, and Homework/Fees/etc later. audiences picks which
// groups receive it; pass empty/undefined classIds to target the whole school.
async function notifyClasses({ schoolId, classIds, audiences = ['student', 'parent', 'teacher'], title, body, type = 'info', data = {}, parentPermKey, studentPermKey }) {
  try {
    // No classes given → treat as "all classes" in the school.
    let ids = (Array.isArray(classIds) ? classIds : (classIds ? [classIds] : [])).filter(Boolean);
    if (!ids.length) ids = await Class.find({ school: schoolId }).distinct('_id');
    if (!ids.length) return { users: 0, sent: 0 };

    const school = await School.findById(schoolId).select('parentPermissions studentPermissions');
    const userMap = new Map(); // dedupe by _id
    const add = (arr) => arr.forEach(u => userMap.set(String(u._id), u));

    if (audiences.includes('student') || audiences.includes('parent')) {
      const students = await Student.find({ school: schoolId, currentClass: { $in: ids }, status: { $ne: 'dropped' } })
        .select('_id primaryGuardian');
      if (audiences.includes('student') && !(studentPermKey && school?.studentPermissions?.[studentPermKey] === false)) {
        add(await User.find({ school: schoolId, role: 'student', studentId: { $in: students.map(s => s._id) } }));
      }
      if (audiences.includes('parent') && !(parentPermKey && school?.parentPermissions?.[parentPermKey] === false)) {
        const parentIds = [...new Set(students.map(s => s.primaryGuardian?.toString()).filter(Boolean))];
        if (parentIds.length) add(await User.find({ school: schoolId, role: 'parent', parentId: { $in: parentIds } }));
      }
    }

    if (audiences.includes('teacher')) {
      const classes = await Class.find({ school: schoolId, _id: { $in: ids } }).select('classTeacher subjectTeachers.teacher');
      const empIds = new Set();
      classes.forEach(c => {
        if (c.classTeacher) empIds.add(String(c.classTeacher));
        (c.subjectTeachers || []).forEach(st => st.teacher && empIds.add(String(st.teacher)));
      });
      if (empIds.size) {
        const employees = await Employee.find({ _id: { $in: [...empIds] }, school: schoolId }).select('user');
        const userIds = employees.map(e => e.user).filter(Boolean);
        if (userIds.length) add(await User.find({ _id: { $in: userIds }, school: schoolId }));
      }
    }

    return await notifyUsers([...userMap.values()], { title, body, type, data });
  } catch (err) {
    console.error('[notifyClasses]', err.message);
    return { users: 0, sent: 0, error: err.message };
  }
}

// ── High level: notify the parent(s) of the given students (in-app + push) ───────
// The single entry point reused by Attendance now and Exams/Fees/Homework/etc later.
async function notifyStudentParents({ schoolId, studentIds, permKey, title, body, type = 'info', data = {} }) {
  try {
    if (permKey) {
      const school = await School.findById(schoolId).select('parentPermissions');
      if (school?.parentPermissions?.[permKey] === false) return { sent: 0, users: 0, skipped: 'permission-off' };
    }
    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    const students = await Student.find({ _id: { $in: ids }, school: schoolId }).select('primaryGuardian');
    const parentIds = [...new Set(students.map(s => s.primaryGuardian?.toString()).filter(Boolean))];
    if (!parentIds.length) return { sent: 0, users: 0 };

    const users = await User.find({ parentId: { $in: parentIds }, school: schoolId, role: 'parent' });
    if (!users.length) return { sent: 0, users: 0 };

    await persistInApp(users, { title, body, type });
    const pushRes = await pushToUsers(users, { title, body, data });
    return { users: users.length, ...pushRes };
  } catch (err) {
    console.error('[notifyStudentParents]', err.message);
    return { sent: 0, users: 0, error: err.message };
  }
}

module.exports = { persistInApp, pushToUsers, notifyUsers, notifyClasses, notifyStudentParents };
