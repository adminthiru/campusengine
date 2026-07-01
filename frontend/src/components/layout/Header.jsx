import { useState, useRef, useEffect } from 'react';
import {
  Bell, Menu, Search, ChevronDown, Check, Globe, CalendarRange, Home,
  LayoutDashboard, GraduationCap, UsersRound, Users, BookOpen, ClipboardList, Clock, Calendar,
  UserCheck, FileText, BookMarked, CreditCard, Banknote, DollarSign, Library, DoorOpen, Truck,
  MessageSquare, Settings, Building2, LogOut, Package,
} from 'lucide-react';
import { Select, Breadcrumb } from 'antd';
import { useAuth } from '../../store/AuthContext';
import { useYear } from '../../store/YearContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../utils/api';

// Path segment → readable label for the header breadcrumb.
const ROUTE_LABELS = {
  dashboard: 'Dashboard', students: 'Students', parents: 'Parents', employees: 'Employees',
  classes: 'Classes', subjects: 'Subjects', timetable: 'Timetable', calendar: 'My Calendar',
  attendance: 'Attendance', exams: 'Exams', homework: 'Homework', fees: 'Fees', salary: 'Salary',
  expenses: 'Expenses', library: 'Library', visits: 'Visits', outpass: 'Out Pass', inventory: 'Inventory', transport: 'Transport',
  sms: 'SMS Services', settings: 'Settings', 'super-admin': 'Schools', 'my-classes': 'My Classes',
  'my-salary': 'My Salary', 'my-tasks': 'My Tasks', 'my-children': 'My Children',
};
const labelFor = (seg) =>
  /^[0-9a-fA-F]{24}$/.test(seg) ? 'Detail' : (ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '));

// Same icons used in the sidebar nav, keyed by path segment.
const ROUTE_ICONS = {
  dashboard: LayoutDashboard, students: GraduationCap, parents: UsersRound, employees: Users,
  classes: BookOpen, subjects: ClipboardList, timetable: Clock, calendar: Calendar,
  attendance: UserCheck, exams: FileText, homework: BookMarked, fees: CreditCard, salary: Banknote,
  expenses: DollarSign, library: Library, visits: DoorOpen, outpass: LogOut, inventory: Package, transport: Truck, sms: MessageSquare,
  settings: Settings, 'super-admin': Building2, 'my-classes': BookOpen, 'my-salary': Banknote,
  'my-tasks': ClipboardList, 'my-children': GraduationCap,
};
const CrumbLabel = ({ seg, label }) => {
  const Icon = ROUTE_ICONS[seg];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 500, lineHeight: 1 }}>
      {Icon && <Icon size={16} />}{label}
    </span>
  );
};

export default function Header({ onMenuClick, sidebarCollapsed }) {
  const { user, logout } = useAuth();
  const { selectedYear, setSelectedYear, availableYears, isCurrent } = useYear();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();

  // Build a navigation breadcrumb from the current path.
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbItems = [
    { title: <span onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}><Home size={16} /></span> },
    ...segments.map((seg, i) => {
      const isLast = i === segments.length - 1;
      const path = '/' + segments.slice(0, i + 1).join('/');
      const inner = <CrumbLabel seg={seg} label={labelFor(seg)} />;
      return { title: isLast ? inner : <span onClick={() => navigate(path)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>{inner}</span> };
    }),
  ];

  const canSwitchYear = ['admin', 'correspondent', 'principal', 'accountant'].includes(user?.role) && availableYears.length > 0;
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifs, setNotifs] = useState(user?.notifications || []);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [actingId, setActingId] = useState(null);
  const notifRef = useRef();
  const profileRef = useRef();

  const isLeaveApprover = ['admin', 'correspondent', 'principal'].includes(user?.role);

  // Synthesize a notification-shaped item for a pending leave so it shows in the
  // bell even when no stored notification exists (e.g. leaves created before the
  // notification feature, or if a push failed to persist).
  const leaveToItem = (lv) => {
    const fmtD = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const dateLabel = String(lv.fromDate) === String(lv.toDate) ? fmtD(lv.fromDate) : `${fmtD(lv.fromDate)} – ${fmtD(lv.toDate)}`;
    const who = lv.parent?.name || 'A parent';
    return {
      _id: `leave-${lv._id}`,
      synthetic: true,
      title: 'Leave Request',
      message: `${who} requested leave for ${lv.student?.name || 'a student'} on ${dateLabel}.${lv.reason ? ` Reason: ${lv.reason}` : ''}`,
      createdAt: lv.createdAt,
      read: false,
      action: 'student_leave',
      refId: lv._id,
      actionStatus: 'pending',
    };
  };

  // Stored notifications + any pending leaves not already represented by a
  // stored leave notification (deduped by leave id), newest first.
  const storedLeaveRefIds = new Set(
    notifs.filter(n => n.action === 'student_leave' && n.refId).map(n => String(n.refId))
  );
  const items = [
    ...notifs,
    ...pendingLeaves.filter(lv => !storedLeaveRefIds.has(String(lv._id))).map(leaveToItem),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const unread = items.filter(n => !n.read).length;

  const fetchNotifs = async () => {
    try {
      const [nRes, lRes] = await Promise.all([
        api.get('/notifications'),
        isLeaveApprover ? api.get('/student-leaves?status=pending').catch(() => null) : Promise.resolve(null),
      ]);
      if (Array.isArray(nRes?.notifications)) setNotifs(nRes.notifications);
      if (lRes && Array.isArray(lRes.leaves)) setPendingLeaves(lRes.leaves);
    } catch { /* keep current */ }
  };

  // Poll so admins receive leave requests (and other alerts) without a reload.
  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 20000);
    return () => clearInterval(t);
  }, []);
  // Refresh on open.
  useEffect(() => { if (notifOpen) fetchNotifs(); }, [notifOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    if (String(id).startsWith('leave-')) return; // synthetic item, nothing to mark
    setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    try { await api.put(`/auth/notifications/${id}/read`); } catch { /* ignore */ }
  };

  // Approve/reject a leave request straight from the notification.
  const actOnLeave = async (e, n, status) => {
    e.stopPropagation();
    if (actingId) return;
    setActingId(n._id);
    try {
      await api.put(`/student-leaves/${n.refId}`, { status });
      toast.success(`Leave ${status === 'approved' ? 'approved' : 'rejected'}`);
      await fetchNotifs();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ta' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  // Trial banner
  const isTrialExpired = user?.subscription?.status === 'trial' &&
    user?.subscription?.trialEndDate &&
    new Date(user.subscription.trialEndDate) < new Date();

  const trialDaysLeft = user?.subscription?.status === 'trial' && user?.subscription?.trialEndDate
    ? Math.max(0, Math.ceil((new Date(user.subscription.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  // Paid-subscription renewal reminder: days until the active period ends
  // (shown ≤7 days out, or once expired). Super admins are exempt.
  const renewDaysLeft = user?.role !== 'super_admin' && user?.subscription?.status === 'active' && user?.subscription?.currentPeriodEnd
    ? Math.ceil((new Date(user.subscription.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const showRenew = renewDaysLeft !== null && renewDaysLeft <= 7;

  return (
    <>
      {/* Trial Banner */}
      {trialDaysLeft !== null && trialDaysLeft <= 5 && (
        <div className="text-14-medium" style={{
          background: trialDaysLeft === 0 ? '#ef4444' : '#f59e0b',
          color: 'white', padding: '8px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
        }}>
          {trialDaysLeft === 0
            ? '⚠️ Trial expired! Please subscribe to continue.'
            : `⚡ Trial expires in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}!`}
          <button
            onClick={() => navigate('/settings/subscription')}
            className="text-12-semibold" style={{ background: 'white', color: '#1a56e8', border: 'none', padding: '3px 14px', borderRadius: 20, cursor: 'pointer' }}
          >
            Subscribe Now
          </button>
        </div>
      )}

      {/* Renewal Banner (paid plans nearing / past their period end) */}
      {showRenew && (
        <div className="text-14-medium" style={{
          background: renewDaysLeft <= 0 ? '#ef4444' : '#f59e0b',
          color: 'white', padding: '8px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
        }}>
          {renewDaysLeft <= 0
            ? '⚠️ Your plan has expired! Renew to keep using all features.'
            : `⏳ Your plan expires in ${renewDaysLeft} day${renewDaysLeft !== 1 ? 's' : ''}. Renew to avoid interruption.`}
          <button
            onClick={() => navigate('/settings/subscription')}
            className="text-12-semibold" style={{ background: 'white', color: '#1a56e8', border: 'none', padding: '3px 14px', borderRadius: 20, cursor: 'pointer' }}
          >
            Renew Now
          </button>
        </div>
      )}

      <header className={`header${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="header-left">
          <button className="btn-icon btn btn-secondary mobile-menu-btn" onClick={onMenuClick}>
            <Menu size={20} />
          </button>
          <Breadcrumb className="header-breadcrumb" items={crumbItems} style={{ fontSize: 14 }} />
        </div>

        <div className="header-right">
          {/* Academic year selector */}
          {canSwitchYear && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isCurrent ? '#fff' : '#fffbeb',
                border: `1px solid ${isCurrent ? 'var(--border)' : '#fcd34d'}`,
                borderRadius: 10, padding: '0 6px 0 10px', height: 36,
              }}
              data-tooltip={isCurrent ? 'Academic year' : 'Viewing a past academic year'}
            >
              <CalendarRange size={15} color={isCurrent ? 'var(--text-muted)' : '#d97706'} />
              <Select
                variant="borderless"
                size="small"
                value={selectedYear}
                onChange={setSelectedYear}
                popupMatchSelectWidth={false}
                style={{ minWidth: 92 }}
                options={availableYears.map(y => ({ value: y.value, label: y.label }))}
              />
            </div>
          )}


          {/* Notifications */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setNotifOpen(o => !o)}
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="text-12-bold" style={{
                  position: 'absolute', top: 4, right: 4, width: 16, height: 16,
                  background: '#ef4444', borderRadius: '50%',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid white'
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </button>

            {notifOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                width: 340, background: 'white', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 200
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-14-bold">Notifications</span>
                  {unread > 0 && <span className="badge badge-info">{unread} new</span>}
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {items.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <Bell size={28} style={{ marginBottom: 8, color: 'var(--text-muted)' }} />
                      <p className="text-14-regular">No notifications</p>
                    </div>
                  )}
                  {items.slice(0, 20).map(n => {
                    const isLeave = n.action === 'student_leave';
                    return (
                    <div
                      key={n._id}
                      onClick={() => markRead(n._id)}
                      style={{
                        padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                        background: n.read ? 'white' : '#eff6ff',
                        display: 'flex', gap: 10, alignItems: 'flex-start'
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                        background: n.read ? 'transparent' : 'var(--primary)'
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-14-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                        <div className="text-12-regular" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                        <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {/* Inline approve/reject for leave requests */}
                        {isLeave && n.actionStatus === 'pending' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              className="btn btn-success btn-sm"
                              disabled={actingId === n._id}
                              onClick={(e) => actOnLeave(e, n, 'approved')}
                              style={{ padding: '4px 12px', fontSize: 12 }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={actingId === n._id}
                              onClick={(e) => actOnLeave(e, n, 'rejected')}
                              style={{ padding: '4px 12px', fontSize: 12 }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {isLeave && n.actionStatus === 'approved' && (
                          <span className="badge badge-success" style={{ marginTop: 8, display: 'inline-block' }}>Approved</span>
                        )}
                        {isLeave && n.actionStatus === 'rejected' && (
                          <span className="badge badge-danger" style={{ marginTop: 8, display: 'inline-block' }}>Rejected</span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setProfileOpen(o => !o)}
              style={{ gap: 8, padding: '6px 10px' }}
            >
              <div className="avatar-placeholder text-12-regular" style={{ width: 28, height: 28 }}>
                {user?.name?.charAt(0)}
              </div>
              <span className="text-14-regular">{user?.name?.split(' ')[0]}</span>
              <ChevronDown size={14} />
            </button>

            {profileOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                width: 200, background: 'white', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 200, overflow: 'hidden'
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div className="text-14-semibold">{user?.name}</div>
                  <div className="text-12-regular" style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
                </div>
                {[
                  { label: 'My Profile', path: '/settings/profile' },
                  { label: 'Change Password', path: '/settings/password' },
                  ...(user?.role !== 'super_admin' ? [{ label: 'Subscription', path: '/settings/subscription' }] : []),
                ].map(item => (
                  <button key={item.path} onClick={() => { navigate(item.path); setProfileOpen(false); }}
                    className="text-14-regular" style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}
                    onMouseEnter={e => e.target.style.background = '#f8fafc'}
                    onMouseLeave={e => e.target.style.background = 'none'}
                  >
                    {item.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={logout}
                    className="text-14-medium" style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: '#ef4444' }}
                    onMouseEnter={e => e.target.style.background = '#fef2f2'}
                    onMouseLeave={e => e.target.style.background = 'none'}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
