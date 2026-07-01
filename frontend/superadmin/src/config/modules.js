// Mirror of backend/config/modules.js (key + label only). Drives the plan
// module-entitlement checkboxes. Keys MUST match the backend registry.
export const MODULES = [
  { key: 'students',   label: 'Students' },
  { key: 'parents',    label: 'Parents' },
  { key: 'employees',  label: 'Employees' },
  { key: 'classes',    label: 'Classes' },
  { key: 'subjects',   label: 'Subjects' },
  { key: 'timetable',  label: 'Timetable' },
  { key: 'calendar',   label: 'Calendar' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'exams',      label: 'Exams' },
  { key: 'homework',   label: 'Homework' },
  { key: 'fees',       label: 'Fees' },
  { key: 'salary',     label: 'Salary' },
  { key: 'expenses',   label: 'Expenses' },
  { key: 'library',    label: 'Library' },
  { key: 'visits',     label: 'Visits' },
  { key: 'outpass',    label: 'Out Pass' },
  { key: 'inventory',  label: 'Inventory' },
  { key: 'transport',  label: 'Transport' },
  { key: 'hostel',     label: 'Hostel' },
];

// Core modules every paid tier typically includes — used by the "Core" preset.
export const CORE_MODULES = ['students', 'parents', 'employees', 'classes', 'subjects', 'timetable', 'calendar', 'attendance', 'exams', 'homework', 'fees'];

export const moduleLabel = (key) => MODULES.find(m => m.key === key)?.label || key;
