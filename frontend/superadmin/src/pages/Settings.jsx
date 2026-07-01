import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Settings as SettingsIcon, KeyRound } from 'lucide-react';

const TABS = [
  { id: 'profile', label: 'My Profile', icon: SettingsIcon },
  { id: 'password', label: 'Change Password', icon: KeyRound },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Settings</h1>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Tab sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div className="card" style={{ padding: 8 }}>
            {TABS.map(t => {
              const Icon = t.icon;
              const on = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left',
                    fontSize: 14, fontWeight: on ? 600 : 400, background: on ? '#eff6ff' : 'none', color: on ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  <Icon size={16} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'password' && <PasswordTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { const res = await api.put('/auth/profile', profile); updateUser(res.user || profile); toast.success('Profile updated'); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>My Profile</h3>
      <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={user?.email || ''} disabled style={{ background: '#f8fafc' }} /></div>
      <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} /></div>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
    </div>
  );
}

function PasswordTab() {
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const change = async () => {
    if (pw.newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try { await api.put('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); toast.success('Password changed'); setPw({ currentPassword: '', newPassword: '', confirm: '' }); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>Change Password</h3>
      <div className="form-group"><label className="form-label">Current Password</label><input className="form-control" type="password" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">New Password</label><input className="form-control" type="password" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-control" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} /></div>
      <button className="btn btn-primary" onClick={change} disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</button>
    </div>
  );
}
