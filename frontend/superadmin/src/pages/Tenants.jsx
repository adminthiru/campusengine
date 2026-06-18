import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { PageLoader, Modal, ConfirmDialog, SearchInput, EmptyState, Badge, FormRow } from '../components/ui';
import { Plus, Building2, Eye, Power, RefreshCw, Copy, Lock } from 'lucide-react';

export default function Tenants() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creds, setCreds] = useState(null);          // { name, email, code, tempPassword }
  const [confirm, setConfirm] = useState(null);      // { kind, id, name }

  const { data, isLoading } = useQuery({ queryKey: ['sa-schools'], queryFn: () => api.get('/super-admin/schools') });
  const schools = data?.schools || [];

  const suspend = useMutation({
    mutationFn: (id) => api.post(`/super-admin/schools/${id}/suspend`, {}),
    onSuccess: () => { qc.invalidateQueries(['sa-schools']); toast.success('Suspended'); setConfirm(null); },
    onError: (e) => { toast.error(e?.response?.data?.message || 'Failed'); setConfirm(null); },
  });
  const reactivate = useMutation({
    mutationFn: (id) => api.post(`/super-admin/schools/${id}/reactivate`, {}),
    onSuccess: () => { qc.invalidateQueries(['sa-schools']); toast.success('Reactivated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const resetPw = useMutation({
    mutationFn: (id) => api.post(`/super-admin/schools/${id}/reset-admin-password`, {}),
    onSuccess: (res, id) => { const s = schools.find(x => x._id === id); setCreds({ name: s?.name, email: res.email, code: s?.code, tempPassword: res.tempPassword }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const filtered = schools.filter(s =>
    (!status || s.subscription?.status === status) &&
    (!search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="page-title">Tenants</h1>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Create Tenant</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, code, email..." />
        <select className="form-control" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All status</option>
          {['trial', 'active', 'expired', 'suspended'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? <EmptyState icon={Building2} message="No tenants found." /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%' }}>
            <thead><tr><th>School</th><th>Plan</th><th>Status</th><th>Expiry</th><th>Students</th><th></th></tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tenants/${s._id}`)}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.code} · {s.email}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{s.subscription?.planName || '—'} <span style={{ color: 'var(--text-muted)' }}>{s.subscription?.amount ? `₹${s.subscription.amount}` : ''}</span></td>
                  <td><Badge status={s.subscription?.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.daysLeft != null ? (s.daysLeft >= 0 ? `${s.daysLeft}d left` : 'expired') : '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.students}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm btn-icon" title="View" onClick={() => navigate(`/tenants/${s._id}`)}><Eye size={13} /></button>
                    <button className="btn btn-secondary btn-sm btn-icon" title="Reset admin password" style={{ marginLeft: 4 }} onClick={() => resetPw.mutate(s._id)}><RefreshCw size={13} /></button>
                    {s.isActive
                      ? <button className="btn btn-danger btn-sm btn-icon" title="Suspend" style={{ marginLeft: 4 }} onClick={() => setConfirm({ kind: 'suspend', id: s._id, name: s.name })}><Power size={13} /></button>
                      : <button className="btn btn-success btn-sm btn-icon" title="Reactivate" style={{ marginLeft: 4 }} onClick={() => reactivate.mutate(s._id)}><Power size={13} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <CreateTenantModal onClose={() => setCreateOpen(false)} onCreated={(c) => { setCreateOpen(false); qc.invalidateQueries(['sa-schools']); setCreds(c); }} />}
      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
      <ConfirmDialog open={!!confirm} danger title="Suspend tenant?"
        message={`Suspend ${confirm?.name}? Their school will be blocked from accessing the app until reactivated.`}
        onClose={() => setConfirm(null)} onConfirm={() => suspend.mutate(confirm.id)} />
    </div>
  );
}

function CreateTenantModal({ onClose, onCreated }) {
  const { data: plansData } = useQuery({ queryKey: ['sa-plans'], queryFn: () => api.get('/super-admin/plans') });
  const plans = plansData?.plans || [];
  const [f, setF] = useState({ schoolName: '', adminName: '', adminEmail: '', phone: '', planId: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post('/super-admin/schools', f),
    onSuccess: (res) => onCreated({ name: f.schoolName, email: f.adminEmail, code: res.code, tempPassword: res.tempPassword }),
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to create tenant'),
  });

  const submit = () => {
    if (!f.schoolName.trim() || !f.adminName.trim() || !f.adminEmail.trim()) return toast.error('School name, admin name and email are required');
    create.mutate();
  };

  return (
    <Modal open onClose={onClose} title="Create Tenant" size="md"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Tenant'}</button></>}>
      <FormRow>
        <div className="form-group"><label className="form-label">School Name *</label><input className="form-control" value={f.schoolName} onChange={e => set('schoolName', e.target.value)} placeholder="Sri Vidya Mandir" /></div>
        <div className="form-group"><label className="form-label">Admin Name *</label><input className="form-control" value={f.adminName} onChange={e => set('adminName', e.target.value)} placeholder="Principal name" /></div>
      </FormRow>
      <FormRow>
        <div className="form-group"><label className="form-label">Admin Email *</label><input className="form-control" value={f.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@school.com" /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="Optional" /></div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Plan</label>
        <select className="form-control" value={f.planId} onChange={e => set('planId', e.target.value)}>
          <option value="">Select a plan (optional)</option>
          {plans.map(p => <option key={p._id} value={p._id}>{p.name} — ₹{p.price}/mo</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
        A school code + temporary password are generated and shown once (also emailed). The admin changes the password on first login.
      </div>
    </Modal>
  );
}

function CredentialsModal({ creds, onClose }) {
  const loginUrl = (import.meta.env.VITE_SCHOOL_URL || 'http://localhost:3000') + '/login';
  const copyAll = () => { navigator.clipboard?.writeText(`Login URL: ${loginUrl}\nSchool Code: ${creds.code}\nEmail: ${creds.email}\nTemporary Password: ${creds.tempPassword}`); toast.success('Copied'); };
  const row = (label, value, mono) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  );
  return (
    <Modal open onClose={onClose} size="sm"
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={16} color="var(--primary)" /> Tenant Created</span>}
      footer={<><button className="btn btn-secondary" onClick={copyAll}><Copy size={14} /> Copy All</button><button className="btn btn-primary" onClick={onClose}>Done</button></>}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Share these with <strong>{creds.name}</strong>. The password is shown only once.</div>
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 16px' }}>
        {row('Login URL', loginUrl)}
        {row('School Code', creds.code, true)}
        {row('Email', creds.email)}
        {row('Temp Password', creds.tempPassword, true)}
      </div>
    </Modal>
  );
}
