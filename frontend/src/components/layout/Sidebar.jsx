import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserCheck, BookOpen, Clock,
  DollarSign, CreditCard, Calendar, FileText, Truck,
  MessageSquare, CreditCard as IdCard, Settings, LogOut,
  GraduationCap, Building2, ChevronRight, Bell, BarChart3,
  ClipboardList, Banknote, School
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
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Classes', icon: BookOpen, path: '/classes' },
    { label: 'Subjects', icon: ClipboardList, path: '/subjects' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { section: 'Attendance & Exams' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { label: 'Expenses', icon: DollarSign, path: '/expenses' },
    { section: 'Other' },
    { label: 'Transport', icon: Truck, path: '/transport' },
    { label: 'ID Cards', icon: IdCard, path: '/id-cards' },
    { label: 'SMS Services', icon: MessageSquare, path: '/sms' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  correspondent: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Classes', icon: BookOpen, path: '/classes' },
    { label: 'Subjects', icon: ClipboardList, path: '/subjects' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { section: 'Attendance & Exams' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { label: 'Expenses', icon: DollarSign, path: '/expenses' },
    { section: 'Other' },
    { label: 'Transport', icon: Truck, path: '/transport' },
    { label: 'ID Cards', icon: IdCard, path: '/id-cards' },
    { label: 'SMS Services', icon: MessageSquare, path: '/sms' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  principal: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Classes', icon: BookOpen, path: '/classes' },
    { label: 'Timetable', icon: Clock, path: '/timetable' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
    { section: 'Finance' },
    { label: 'Fees', icon: CreditCard, path: '/fees' },
    { label: 'Salary', icon: Banknote, path: '/salary' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  teacher: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { section: 'Academics' },
    { label: 'My Classes', icon: BookOpen, path: '/my-classes' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance' },
    { label: 'Exams', icon: FileText, path: '/exams' },
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
    { label: 'My Attendance', icon: UserCheck, path: '/my-attendance' },
    { label: 'My Timetable', icon: Clock, path: '/my-timetable' },
    { label: 'My Exams', icon: FileText, path: '/my-exams' },
    { label: 'My Fees', icon: CreditCard, path: '/my-fees' },
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  parent: [
    { section: 'Overview' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'My Children', icon: GraduationCap, path: '/my-children' },
    { label: 'Attendance', icon: UserCheck, path: '/my-attendance' },
    { label: 'Fees', icon: CreditCard, path: '/my-fees' },
    { label: 'Exams', icon: FileText, path: '/my-exams' },
    { label: 'Timetable', icon: Clock, path: '/my-timetable' },
    { section: 'Account' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const items = navConfig[user?.role] || navConfig.admin;

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
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

        {/* User info */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar-placeholder text-14-regular" style={{ width: 36, height: 36 }}>
              {user?.name?.charAt(0)}
            </div>
            <div>
              <div className="text-14-semibold" style={{ color: 'white' }}>{user?.name}</div>
              <div className="text-12-regular" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
            </div>
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
              >
                <Icon className="icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button className="sidebar-link" onClick={logout} style={{ color: '#f87171' }}>
            <LogOut className="icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
