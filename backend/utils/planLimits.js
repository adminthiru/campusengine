const Student = require('../models/Student');
const Employee = require('../models/Employee');

// Plan usage caps. A limit of 0 (or null/undefined) means unlimited. Existing
// schools with no snapshotted limits are therefore never blocked.
const limitFor = (school, kind) => {
  const limits = school?.subscription?.limits || {};
  return kind === 'students' ? (limits.maxStudents || 0) : (limits.maxStaff || 0);
};

// How many more records of `kind` the school may create (Infinity if unlimited).
const remaining = async (school, kind) => {
  const cap = limitFor(school, kind);
  if (!cap) return Infinity;
  const Model = kind === 'students' ? Student : Employee;
  const current = await Model.countDocuments({ school: school._id });
  return Math.max(0, cap - current);
};

// Throws an Error tagged with { status:403, code:'PLAN_LIMIT', limit, current }
// when creating `count` more records would exceed the plan cap. No-op when the
// limit is 0/unlimited.
const assertWithinLimit = async (school, kind, count = 1) => {
  const cap = limitFor(school, kind);
  if (!cap) return;
  const Model = kind === 'students' ? Student : Employee;
  const current = await Model.countDocuments({ school: school._id });
  if (current + count > cap) {
    const label = kind === 'students' ? 'students' : 'employees';
    const err = new Error(`You've reached your plan limit of ${cap} ${label} (${current}/${cap}). Upgrade your plan to add more.`);
    err.status = 403;
    err.code = 'PLAN_LIMIT';
    err.limit = cap;
    err.current = current;
    throw err;
  }
};

module.exports = { limitFor, remaining, assertWithinLimit };
