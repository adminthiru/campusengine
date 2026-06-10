import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserCheck, BookOpen, Clock,
  DollarSign, CreditCard, FileText, Truck,
  MessageSquare, Settings,
  GraduationCap, Building2, ClipboardList, Banknote, School, BookMarked, UsersRound, Calendar, Library
} from 'lucide-react';

const navConfig = {
  super_admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/super-admin' },
    { label: 'All Schools', icon: Building2, path: '/super-admin/schools' },
    { label: 'Settings', icon: Settings, path: '/super-admin/settings' },
  ],
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
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Transport', icon: Truck, path: '/transport' },
    { label: 'SMS Services', icon: MessageSquare, path: '/sms' },
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
    { label: 'Library', icon: Library, path: '/library' },
    { label: 'Transport', icon: Truck, path: '/transport' },
    { label: 'SMS Services', icon: MessageSquare, path: '/sms' },
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
    { label: 'Library', icon: Library, path: '/library' },
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

export default function Sidebar({ open, onClose, collapsed }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const items = navConfig[user?.role] || navConfig.admin;

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
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
