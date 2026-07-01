import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { PageLoader, Modal, Badge, FormRow } from '../components/ui';
import { ArrowLeft, Users, GraduationCap, BookOpen, Power, RefreshCw, IndianRupee, CalendarPlus, CheckCircle, Copy } from 'lucide-react';
import { moduleLabel } from '../config/modules';

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [credsPw, setCredsPw] = useState(null);
  const [trialDays, setTrialDays] = useState(15);

  const { data, isLoading } = useQuery({ queryKey: ['sa-school', id], queryFn: () => api.get(`/super-admin/schools/${id}`) });
  const { data: plansData } = useQuery({ queryKey: ['sa-plans'], queryFn: () => api.get('/super-admin/plans') });
  const plans = plansData?.plans || [];

  const invalidate = () => { qc.invalidateQueries(['sa-school', id]); qc.invalidateQueries(['sa-schools']); };
  const mut = (fn, msg) => useMutation({ mutationFn: fn, onSuccess: () => { invalidate(); toast.success(msg); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });

  const extendTrial = mut(() => {
    const end = new Date(); end.setDate(end.getDate() + 30);
    return api.put(`/super-admin/schools/${id}/subscription`, { status: 'trial', trialEndDate: end });
  }, 'Trial extended 30 days');
  const changePlan = useMutation({
    mutationFn: (planId) => api.put(`/super-admin/schools/${id}`, { planId }),
    onSuccess: () => { invalidate(); toast.success('Plan updated'); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const addTrialDays = useMutation({
    mutationFn: (days) => {
      const cur = data?.school?.subscription?.trialEndDate;
      const base = (cur && new Date(cur) > new Date()) ? new Date(cur) : new Date();
      base.setDate(base.getDate() + Number(days));
      return api.put(`/super-admin/schools/${id}/subscription`, { status: 'trial', trialEndDate: base });
    },
    onSuccess: () => { invalidate(); toast.success(`Trial extended by ${trialDays} day(s)`); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const suspend = mut(() => api.post(`/super-admin/schools/${id}/suspend`, {}), 'Suspended');
  const reactivate = mut(() => api.post(`/super-admin/schools/${id}/reactivate`, {}), 'Reactivated');
  const resetPw = useMutation({
    mutationFn: () => api.post(`/super-admin/schools/${id}/reset-admin-password`, {}),
    onSuccess: (res) => setCredsPw(res.tempPassword), onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  if (isLoading || !data) return <PageLoader />;
  const { school, admin, usage, payments } = data;
  const sub = school.subscription || {};
  const limits = sub.limits || {};
  const planModules = sub.modules || [];
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const Info = ({ label, value }) => (<div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div><div style={{ fontSize: 14, fontWeight: 500 }}>{value || '—'}</div></div>);

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tenants')} style={{ marginBottom: 14 }}><ArrowLeft size={14} /> Back</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{school.name} <Badge status={school.status} /></h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Code {school.code} · {school.email} · {school.phone || 'no phone'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Plans are activated by the school via Razorpay checkout — no manual
              activate / record-payment here. Super admin only extends trials. */}
          <button className="btn btn-secondary btn-sm" onClick={() => extendTrial.mutate()}><CalendarPlus size={14} /> +30d Trial</button>
          <button className="btn btn-secondary btn-sm" onClick={() => resetPw.mutate()}><RefreshCw size={14} /> Reset Pw</button>
          {school.isActive
            ? <button className="btn btn-danger btn-sm" onClick={() => suspend.mutate()}><Power size={14} /> Suspend</button>
            : <button className="btn btn-success btn-sm" onClick={() => reactivate.mutate()}><Power size={14} /> Reactivate</button>}
        </div>
      </div>

      {/* Usage vs plan limits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { l: 'Students', v: usage.students, cap: limits.maxStudents || 0, i: GraduationCap },
          { l: 'Employees', v: usage.employees, cap: limits.maxStaff || 0, i: Users },
          { l: 'Classes', v: usage.classes, cap: 0, i: BookOpen },
        ].map(x => {
          const atCap = x.cap > 0 && x.v >= x.cap;
          return (
            <div key={x.l} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <x.i size={20} color={atCap ? '#ef4444' : 'var(--primary)'} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: atCap ? '#b91c1c' : undefined }}>{x.v}{x.cap ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}> / {x.cap}</span> : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{x.l}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* School details captured at signup */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>School Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <Info label="School Code" value={school.code} />
          <Info label="School Name" value={school.name} />
          <Info label="Email" value={school.email} />
          <Info label="Admin Phone" value={school.phone} />
          <Info label="Location" value={school.address?.city} />
          <Info label="Students (signup)" value={school.studentsRange} />
          <Info label="Registered" value={fmt(school.createdAt)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Subscription */}
        <div className="card" style={{ padding: 18 }}>
          <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>Subscription</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Info label="Status" value={<Badge status={school.status} />} />
            <Info label="Amount" value={(sub.amount || 0) > 0 ? `₹${(sub.amount || 0).toLocaleString('en-IN')}/${sub.billingCycle === 'yearly' ? 'yr' : 'mo'}` : 'Free'} />
            <Info label="Trial ends" value={fmt(sub.trialEndDate)} />
            <Info label="Renews / ends" value={fmt(sub.currentPeriodEnd)} />
          </div>
          <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
            <label className="form-label">Plan</label>
            <select className="form-control" value={String(sub.plan?._id || sub.plan || '')} onChange={e => changePlan.mutate(e.target.value)}>
              <option value="">No plan</option>
              {plans.map(p => <option key={p._id} value={p._id}>{p.name}{p.trialDays > 0 ? ` — ${p.trialDays}-day trial` : ((p.monthlyPrice || p.price) ? ` — ₹${(Math.max(0,(p.monthlyPrice||p.price)-(p.monthlyDiscount||0))).toLocaleString('en-IN')}/mo` : '')}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
            <label className="form-label">Extend trial</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-control" type="number" min="1" value={trialDays} onChange={e => setTrialDays(e.target.value)} style={{ maxWidth: 120 }} placeholder="Days" />
              <button className="btn btn-secondary" onClick={() => addTrialDays.mutate(trialDays)} disabled={addTrialDays.isPending || !trialDays}>
                <CalendarPlus size={14} /> Add days
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Adds to the current trial end date and keeps the tenant on trial.</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Modules unlocked {planModules.length ? `(${planModules.length})` : '(all)'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {planModules.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>All modules</span>
                : planModules.map(k => <span key={k} style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', borderRadius: 6, padding: '2px 8px' }}>{moduleLabel(k)}</span>)}
            </div>
          </div>
        </div>

        {/* Admin */}
        <div className="card" style={{ padding: 18 }}>
          <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>School Admin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Info label="Name" value={admin?.name} />
            <Info label="Email" value={admin?.email} />
            <Info label="Phone" value={admin?.phone} />
            <Info label="Last login" value={admin?.lastLogin ? fmt(admin.lastLogin) : 'never'} />
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}><span className="text-14-semibold">Payment History</span></div>
        {(payments || []).length === 0 ? <div style={{ padding: 18, fontSize: 13, color: 'var(--text-muted)' }}>No payments yet.</div> : (
          <table style={{ width: '100%' }}>
            <thead><tr><th>Invoice</th><th>Plan</th><th>Amount</th><th>Method</th><th>Period</th><th>Date</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id}>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{p.invoiceNumber}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.planName || '—'}</td>
                  <td style={{ fontSize: 13 }}>₹{p.amount}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(p.method || '').replace('_', ' ')}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(p.periodStart)} – {fmt(p.periodEnd)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {credsPw && (
        <Modal open onClose={() => setCredsPw(null)} size="sm" title="Password Reset"
          footer={<button className="btn btn-primary" onClick={() => setCredsPw(null)}>Done</button>}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>New temporary password for <strong>{admin?.email}</strong> (also emailed). Shown once:</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <code style={{ fontSize: 16, fontWeight: 700, background: '#eff6ff', color: 'var(--primary)', padding: '6px 14px', borderRadius: 8 }}>{credsPw}</code>
            <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(credsPw); toast.success('Copied'); }}><Copy size={13} /> Copy</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
