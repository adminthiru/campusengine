import { useState, useRef, useEffect } from 'react';
import { Bell, Menu, Search, ChevronDown, Check, Globe } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

export default function Header({ onMenuClick, sidebarCollapsed }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef();
  const profileRef = useRef();

  const unread = user?.notifications?.filter(n => !n.read).length || 0;

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
    await api.put(`/auth/notifications/${id}/read`);
    updateUser({ notifications: user.notifications.map(n => n._id === id ? { ...n, read: true } : n) });
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

      <header className={`header${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="header-left">
          <button className="btn-icon btn btn-secondary mobile-menu-btn" onClick={onMenuClick}>
            <Menu size={20} />
          </button>
          <div className="text-18-bold" style={{ color: 'var(--text-primary)' }}>
            {user?.school?.name || 'School Management'}
          </div>
        </div>

        <div className="header-right">
          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className="btn btn-secondary btn-sm"
            style={{ gap: 6, padding: '6px 12px' }}
            data-tooltip={i18n.language === 'en' ? 'Switch to Tamil' : 'Switch to English'}
          >
            <Globe size={14} />
            {i18n.language === 'en' ? 'EN' : 'தமிழ்'}
          </button>

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
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {user?.notifications?.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <Bell size={28} style={{ marginBottom: 8, color: 'var(--text-muted)' }} />
                      <p className="text-14-regular">No notifications</p>
                    </div>
                  )}
                  {(user?.notifications || []).slice(0, 20).map(n => (
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
                      <div>
                        <div className="text-14-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                        <div className="text-12-regular" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                        <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
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
                  { label: 'School Settings', path: '/settings', skip: ['student', 'parent', 'maintenance', 'teacher'].includes(user?.role) },
                ].filter(i => !i.skip).map(item => (
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
