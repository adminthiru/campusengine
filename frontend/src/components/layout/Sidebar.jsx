import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserCheck, BookOpen, Clock,
  DollarSign, CreditCard, FileText, Truck,
  Settings,
  GraduationCap, ClipboardList, Banknote, School, BookMarked, UsersRound, Calendar, Library, DoorOpen, LogOut, Package, Lock, BedDouble
} from 'lucide-react';
import { MODULES, moduleKeyForPath } from '../../config/modules';

const navConfig = {
  admin: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Parents', icon: UsersRound, path: '/parents' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Classes', icon: BookOpen, path: '/classes' },
    { label: 'Subjects', icon: ClipboardList, path: '/subjects' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { label: 'My Calendar', icon: Calendar, path: '/calendar' },
    { section: 'Attendance & Exams' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { label: 'Homework', icon: BookMarked, path: '/homework' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { label: 'Expenses', icon: DollarSign, path: '/expenses' },
    { section: 'Other' },
    { label: 'Visits', icon: DoorOpen, path: '/visits' },
    { label: 'Out Pass', icon: LogOut, path: '/outpass' },
    { label: 'Inventory', icon: Package, path: '/inventory' },
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Hostel', icon: BedDouble, path: '/hostel' },
    { label: 'Transport', icon: Truck, path: '/transport' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  correspondent: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Parents', icon: UsersRound, path: '/parents' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Classes', icon: BookOpen, path: '/classes' },
    { label: 'Subjects', icon: ClipboardList, path: '/subjects' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { label: 'My Calendar', icon: Calendar, path: '/calendar' },
    { section: 'Attendance & Exams' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { label: 'Homework', icon: BookMarked, path: '/homework' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { label: 'Expenses', icon: DollarSign, path: '/expenses' },
    { section: 'Other' },
    { label: 'Visits', icon: DoorOpen, path: '/visits' },
    { label: 'Out Pass', icon: LogOut, path: '/outpass' },
    { label: 'Inventory', icon: Package, path: '/inventory' },
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Hostel', icon: BedDouble, path: '/hostel' },
    { label: 'Transport', icon: Truck, path: '/transport' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  principal: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Parents', icon: UsersRound, path: '/parents' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Classes', icon: BookOpen, path: '/classes' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { label: 'Homework', icon: BookMarked, path: '/homework' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { section: 'Other' },
    { label: 'Visits', icon: DoorOpen, path: '/visits' },
    { label: 'Out Pass', icon: LogOut, path: '/outpass' },
    { label: 'Inventory', icon: Package, path: '/inventory' },
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Hostel', icon: BedDouble, path: '/hostel' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  teacher: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'My Classes', icon: BookOpen, path: '/my-classes' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { label: 'Homework', icon: BookMarked, path: '/homework' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { section: 'Account' },
    { label: 'My Salary', icon: Banknote, path: '/my-salary' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  accountant: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { label: 'Expenses', icon: DollarSign, path: '/expenses' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  maintenance: [
    { section: 'Overview' },
    { label: 'My Tasks', icon: ClipboardList, path: '/my-tasks' },
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  student: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  parent: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'My Children', icon: GraduationCap, path: '/my-children' },
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
};

// Build the nav for a delegated staff login purely from their view-permissions.
const customNav = (user) => {
  const allowed = MODULES.filter(m => user?.permissions?.[m.key]?.view);
  return [
    { section: 'Modules' },
    ...allowed.map(m => ({ label: m.label, icon: m.icon, path: m.path })),
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ];
};

export default function Sidebar({ open, onClose, collapsed }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isCustom = user?.accessType === 'custom' || user?.role === 'staff';
  const items = isCustom ? customNav(user) : (navConfig[user?.role] || navConfig.admin);

  // Plan entitlement — modules not in the school's plan stay visible but locked.
  // Empty/absent list = all unlocked (legacy schools / trials).
  const planModules = user?.subscription?.modules || [];
  const isLocked = (path) => {
    if (user?.role === 'super_admin' || !planModules.length) return false;
    const key = moduleKeyForPath(path);
    return !!key && !planModules.includes(key);
  };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            {user?.school?.logo
              ? <img src={user.school.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
              : <School size={20} />}
          </div>
          <div className="sidebar-logo-text">
            <h3>{user?.school?.name || 'School ERP'}</h3>
            <span>{user?.school?.code || 'Super Admin'}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {items.map((item, idx) => {
            if (item.section) {
              return <div key={idx} className="sidebar-section-title">{item.section}</div>;
            }
            const Icon = item.icon;
            const locked = isLocked(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}${locked ? ' locked' : ''}`}
                onClick={onClose}
                title={collapsed ? item.label : (locked ? `${item.label} — not in your plan` : undefined)}
              >
                <Icon className="icon" />
                <span>{item.label}</span>
                {locked && <Lock size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </NavLink>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
