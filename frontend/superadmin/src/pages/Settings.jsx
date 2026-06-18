import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { FormRow } from '../components/ui';
import { Globe, Landmark, Smartphone, Save, CreditCard, Settings as SettingsIcon, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';

const TABS = [
  { id: 'collection', label: 'Payment Collection', icon: CreditCard },
  { id: 'profile', label: 'My Profile', icon: SettingsIcon },
  { id: 'password', label: 'Change Password', icon: KeyRound },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('collection');
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
          {activeTab === 'collection' && <CollectionSettings />}
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

// Owner's receiving accounts — these surface on each school's Billing page.
function CollectionSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['payment-settings'], queryFn: () => api.get('/super-admin/payment-settings') });
  const [f, setF] = useState(null);
  const [secret, setSecret] = useState('');   // only sent if typed
  const [open, setOpen] = useState({ gateway: false, bankTransfer: false, upi: false });
  const toggleOpen = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setF({
        gateway: { enabled: !!s.gateway?.enabled, keyId: s.gateway?.keyId || '', hasSecret: !!s.gateway?.hasSecret },
        bankTransfer: { enabled: !!s.bankTransfer?.enabled, accountName: s.bankTransfer?.accountName || '', accountNumber: s.bankTransfer?.accountNumber || '', ifsc: s.bankTransfer?.ifsc || '', bankName: s.bankTransfer?.bankName || '', branch: s.bankTransfer?.branch || '' },
        upi: { enabled: !!s.upi?.enabled, upiId: s.upi?.upiId || '', payeeName: s.upi?.payeeName || '' },
        note: s.note || '',
      });
      // Expand any method that's already enabled.
      setOpen({ gateway: !!s.gateway?.enabled, bankTransfer: !!s.bankTransfer?.enabled, upi: !!s.upi?.enabled });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/super-admin/payment-settings', {
      gateway: { enabled: f.gateway.enabled, keyId: f.gateway.keyId, ...(secret ? { keySecret: secret } : {}) },
      bankTransfer: f.bankTransfer, upi: f.upi, note: f.note,
    }),
    onSuccess: () => { qc.invalidateQueries(['payment-settings']); qc.invalidateQueries(['payment-methods']); setSecret(''); toast.success('Payment settings saved'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  if (!f) return null;
  const setG = (k, v) => setF(p => ({ ...p, gateway: { ...p.gateway, [k]: v } }));
  const setB = (k, v) => setF(p => ({ ...p, bankTransfer: { ...p.bankTransfer, [k]: v } }));
  const setU = (k, v) => setF(p => ({ ...p, upi: { ...p.upi, [k]: v } }));
  const Toggle = ({ on, onClick }) => (
    <button type="button" onClick={onClick} style={{ width: 38, height: 21, borderRadius: 11, border: 'none', cursor: 'pointer', background: on ? 'var(--primary)' : '#cbd5e1', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 2.5, left: on ? 19 : 2.5, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .15s' }} />
    </button>
  );
  // Collapsible section header (click row to expand/collapse; toggle controls enabled).
  const sectionHeader = (k, Icon, title, enabled, onToggle) => (
    <div onClick={() => toggleOpen(k)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color="var(--primary)" />
        <span className="text-14-semibold">{title}</span>
        {enabled && <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#ecfdf5', padding: '1px 7px', borderRadius: 20 }}>On</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
        <Toggle on={enabled} onClick={onToggle} />
        <button type="button" onClick={() => toggleOpen(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          {open[k] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <CreditCard size={16} color="var(--primary)" />
        <div>
          <div className="text-14-semibold">Payment Collection</div>
          <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>Where schools send subscription payments — shown on their Billing page.</div>
        </div>
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        {/* Online gateway */}
        <div style={{ borderBottom: '1px solid #f1f5f9' }}>
          {sectionHeader('gateway', Globe, 'Online Gateway (Razorpay) — Card / UPI / Netbanking', f.gateway.enabled, () => setG('enabled', !f.gateway.enabled))}
          {open.gateway && (
            <div style={{ paddingBottom: 16 }}>
              <FormRow>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Key ID</label><input className="form-control" value={f.gateway.keyId} onChange={e => setG('keyId', e.target.value)} placeholder="rzp_live_…" /></div>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Key Secret</label><input className="form-control" type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder={f.gateway.hasSecret ? '•••••••• (unchanged)' : 'Enter secret'} /></div>
              </FormRow>
            </div>
          )}
        </div>

        {/* Bank transfer */}
        <div style={{ borderBottom: '1px solid #f1f5f9' }}>
          {sectionHeader('bankTransfer', Landmark, 'Bank Transfer (NEFT / IMPS)', f.bankTransfer.enabled, () => setB('enabled', !f.bankTransfer.enabled))}
          {open.bankTransfer && (
            <div style={{ paddingBottom: 16 }}>
              <FormRow>
                <div className="form-group"><label className="form-label">Account Name</label><input className="form-control" value={f.bankTransfer.accountName} onChange={e => setB('accountName', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Account Number</label><input className="form-control" value={f.bankTransfer.accountNumber} onChange={e => setB('accountNumber', e.target.value)} /></div>
              </FormRow>
              <FormRow>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">IFSC</label><input className="form-control" value={f.bankTransfer.ifsc} onChange={e => setB('ifsc', e.target.value)} /></div>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Bank Name</label><input className="form-control" value={f.bankTransfer.bankName} onChange={e => setB('bankName', e.target.value)} placeholder="Bank name" /></div>
              </FormRow>
            </div>
          )}
        </div>

        {/* UPI */}
        <div style={{ borderBottom: '1px solid #f1f5f9' }}>
          {sectionHeader('upi', Smartphone, 'UPI', f.upi.enabled, () => setU('enabled', !f.upi.enabled))}
          {open.upi && (
            <div style={{ paddingBottom: 16 }}>
              <FormRow>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">UPI ID</label><input className="form-control" value={f.upi.upiId} onChange={e => setU('upiId', e.target.value)} placeholder="owner@upi" /></div>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Payee Name</label><input className="form-control" value={f.upi.payeeName} onChange={e => setU('payeeName', e.target.value)} /></div>
              </FormRow>
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Note to schools (optional)</label>
          <input className="form-control" value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} placeholder="e.g. After paying, share the screenshot to support@…" />
        </div>

        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}><Save size={15} /> {save.isPending ? 'Saving…' : 'Save Settings'}</button>
      </div>
    </div>
  );
}
