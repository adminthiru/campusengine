// ── Module registry (frontend mirror of backend/config/modules.js) ───────────
// Drives the permission-matrix UI, the custom-staff sidebar, and route gating.
// Keys MUST match the backend registry.
import {
  GraduationCap, UsersRound, Users, BookOpen, ClipboardList, Clock, Calendar,
  UserCheck, FileText, BookMarked, CreditCard, Banknote, DollarSign, Library,
  DoorOpen, LogOut, Package, Truck, BedDouble,
} from 'lucide-react';

export const MODULES = [
  { key: 'students',   label: 'Students',   path: '/students',   icon: GraduationCap },
  { key: 'parents',    label: 'Parents',    path: '/parents',    icon: UsersRound },
  { key: 'employees',  label: 'Employees',  path: '/employees',  icon: Users },
  { key: 'classes',    label: 'Classes',    path: '/classes',    icon: BookOpen },
  { key: 'subjects',   label: 'Subjects',   path: '/subjects',   icon: ClipboardList },
  { key: 'timetable',  label: 'Timetable',  path: '/timetable',  icon: Clock },
  { key: 'calendar',   label: 'My Calendar', path: '/calendar',  icon: Calendar },
  { key: 'attendance', label: 'Attendance', path: '/attendance', icon: UserCheck },
  { key: 'exams',      label: 'Exams',      path: '/exams',      icon: FileText },
  { key: 'homework',   label: 'Homework',   path: '/homework',   icon: BookMarked },
  { key: 'fees',       label: 'Fees',       path: '/fees',       icon: CreditCard },
  { key: 'salary',     label: 'Salary',     path: '/salary',     icon: Banknote },
  { key: 'expenses',   label: 'Expenses',   path: '/expenses',   icon: DollarSign },
  { key: 'library',    label: 'Library',    path: '/library',    icon: Library },
  { key: 'visits',     label: 'Visits',     path: '/visits',     icon: DoorOpen },
  { key: 'outpass',    label: 'Out Pass',   path: '/outpass',    icon: LogOut },
  { key: 'inventory',  label: 'Inventory',  path: '/inventory',  icon: Package },
  { key: 'transport',  label: 'Transport',  path: '/transport',  icon: Truck },
  { key: 'hostel',     label: 'Hostel',     path: '/hostel',     icon: BedDouble },
];

export const ACTIONS = [
  { key: 'view',   label: 'View' },
  { key: 'add',    label: 'Add' },
  { key: 'edit',   label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

// Map a frontend route path to its module key (for ProtectedRoute gating).
export const moduleKeyForPath = (path) => MODULES.find(m => m.path === path)?.key || null;

// A blank permission matrix (all false) keyed by module.
export const emptyPermissions = () =>
  Object.fromEntries(MODULES.map(m => [m.key, { view: false, add: false, edit: false, delete: false }]));
