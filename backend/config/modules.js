// ── Module registry — single source of truth for RBAC ────────────────────────
// Maps functional modules to the API route prefixes they own. Used by the
// permission enforcement in middleware/auth.js and by the access controller.
// The frontend mirrors this list (frontend/src/config/modules.js) for the
// permission-matrix UI, sidebar and route gating.

const MODULES = [
  { key: 'students',   label: 'Students',   path: '/students',   prefixes: ['/students'] },
  { key: 'parents',    label: 'Parents',    path: '/parents',    prefixes: ['/parents', '/parent'] },
  { key: 'employees',  label: 'Employees',  path: '/employees',  prefixes: ['/employees'] },
  { key: 'classes',    label: 'Classes',    path: '/classes',    prefixes: ['/classes'] },
  { key: 'subjects',   label: 'Subjects',   path: '/subjects',   prefixes: ['/subjects'] },
  { key: 'timetable',  label: 'Timetable',  path: '/timetable',  prefixes: ['/timetable'] },
  { key: 'calendar',   label: 'Calendar',   path: '/calendar',   prefixes: ['/calendar'] },
  { key: 'attendance', label: 'Attendance', path: '/attendance', prefixes: ['/attendance', '/staff-attendance', '/leaves'] },
  { key: 'exams',      label: 'Exams',      path: '/exams',      prefixes: ['/exams'] },
  { key: 'homework',   label: 'Homework',   path: '/homework',   prefixes: ['/homework'] },
  { key: 'fees',       label: 'Fees',       path: '/fees',       prefixes: ['/fees'] },
  { key: 'salary',     label: 'Salary',     path: '/salary',     prefixes: ['/salaries'] },
  { key: 'expenses',   label: 'Expenses',   path: '/expenses',   prefixes: ['/expenses'] },
  { key: 'library',    label: 'Library',    path: '/library',    prefixes: ['/library'] },
  { key: 'visits',     label: 'Visits',     path: '/visits',     prefixes: ['/visits'] },
  { key: 'outpass',    label: 'Out Pass',   path: '/outpass',    prefixes: ['/outpasses'] },
  { key: 'inventory',  label: 'Inventory',  path: '/inventory',  prefixes: ['/inventory', '/purchase-requests'] },
  { key: 'transport',  label: 'Transport',  path: '/transport',  prefixes: ['/transport'] },
  { key: 'hostel',     label: 'Hostel',     path: '/hostel',     prefixes: ['/hostel'] },
];

const ACTIONS = ['view', 'add', 'edit', 'delete'];

// POST sub-paths that are "actions" on an existing record rather than creating a
// new one — these require the `edit` permission, not `add`.
const POST_EDIT_VERBS = [
  'collect', 'pay', 'revert', 'recalculate', 'send', 'test', 'recipients',
  'checkout', 'return', 'receive', 'reverse', 'complete', 'publish', 'promote',
  'generate', 'retry', 'notify', 'visit', 'submit', 'renewal', 'toggle-status',
  'read', 'marks', 'class-structure', 'transfer', 'vacate',
];

// Endpoints any authenticated user may reach regardless of module permissions:
// self-service (auth/profile) + low-sensitivity reference reads needed by the
// pickers inside many module pages (student/class search, etc.). Mutations on
// these reference modules are still gated by their own module permission.
const SHARED_GET_PREFIXES = [
  '/students', '/parents', '/employees', '/classes', '/subjects',
  '/academic-years', '/school/dashboard', '/school',
];

// Strip the leading /api and any query string, return a clean path like
// "/library/books".
const cleanPath = (originalUrl) => {
  let p = (originalUrl || '').split('?')[0];
  if (p.startsWith('/api')) p = p.slice(4);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
};

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(prefix + '/');

// Which module does this path belong to (or null if it's not a gated module).
const moduleForPath = (path) => {
  for (const m of MODULES) {
    if (m.prefixes.some(pre => matchesPrefix(path, pre))) return m;
  }
  return null;
};

// Map HTTP method (+ path for action verbs) to a CRUD action.
const actionForRequest = (method, path) => {
  const verb = (method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') return 'view';
  if (verb === 'DELETE') return 'delete';
  if (verb === 'PUT' || verb === 'PATCH') return 'edit';
  if (verb === 'POST') {
    const last = path.split('/').filter(Boolean).pop() || '';
    return POST_EDIT_VERBS.includes(last) ? 'edit' : 'add';
  }
  return 'view';
};

// Is this request always allowed for any authenticated user (self-service or a
// shared reference read)?
const isAlwaysAllowed = (path, method) => {
  if (matchesPrefix(path, '/auth')) return true;
  const verb = (method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') {
    if (SHARED_GET_PREFIXES.some(pre => matchesPrefix(path, pre))) return true;
  }
  return false;
};

module.exports = {
  MODULES, ACTIONS, POST_EDIT_VERBS,
  cleanPath, moduleForPath, actionForRequest, isAlwaysAllowed, matchesPrefix,
};
