import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { PageLoader, Modal, Badge } from '../components/ui';
import {
  ArrowLeft, Users, GraduationCap, BookOpen, Power, RefreshCw, CalendarPlus,
  Copy, Pencil, Check, X, Wallet, Mail, Phone, MapPin, CalendarDays, Building2, Clock,
} from 'lucide-react';
import { moduleLabel } from '../config/modules';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// A labelled read-only field.
const Field = ({ icon: Icon, label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
      {Icon && <Icon size={12} />}{label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{value ?? '—'}</div>
  </div>
);

const Card = ({ title, action, children, pad = 18, style }) => (
  <div className="card" style={{ padding: 0, ...style }}>
    {title && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <span className="text-14-semibold">{title}</span>
        {action}
      </div>
    )}
    <div style={{ padding: pad }}>{children}</div>
  </div>
);

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [credsPw, setCredsPw] = useState(null);
  const [trialDays, setTrialDays] = useState(15);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['sa-school', id], queryFn: () => api.get(`/super-admin/schools/${id}`) });
  const { data: plansData } = useQuery({ queryKey: ['sa-plans'], queryFn: () => api.get('/super-admin/plans') });
  const plans = plansData?.plans || [];

  const invalidate = () => { qc.invalidateQueries(['sa-school', id]); qc.invalidateQueries(['sa-schools']); };
  const mut = (fn, msg) => useMutation({ mutationFn: fn, onSuccess: () => { invalidate(); toast.success(msg); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });

  const changePlan = useMutation({
    mutationFn: (planId) => api.put(`/super-admin/schools/${id}`, { planId }),
    onSuccess: () => { invalidate(); setEditingPlan(false); toast.success('Plan updated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
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
  const { school, admin, usage, payments, billing } = data;
  const sub = school.subscription || {};
  const limits = sub.limits || {};
  const planModules = sub.modules || [];
  const currentPlanId = String(sub.plan?._id || sub.plan || '');
  const currentPlanName = sub.planName || sub.plan?.name || 'No plan';
  const amountLabel = (sub.amount || 0) > 0 ? `${inr(sub.amount)}/${sub.billingCycle === 'yearly' ? 'yr' : 'mo'}` : 'Free';
  const initials = (school.name || '?').trim().charAt(0).toUpperCase();

  const openPlanEdit = () => { setPlanDraft(currentPlanId); setEditingPlan(true); };

  // KPI cards — Total Collected leads (the key business metric), then usage.
  const kpis = [
    { label: 'Total Collected', value: inr(billing?.totalCollected), sub: `${billing?.paymentCount || 0} payment${(billing?.paymentCount || 0) === 1 ? '' : 's'}`, icon: Wallet, accent: '#16a34a', bg: '#f0fdf4', big: true },
    { label: 'Students', value: usage.students, cap: limits.maxStudents || 0, icon: GraduationCap, accent: '#1a56e8', bg: '#eff6ff' },
    { label: 'Employees', value: usage.employees, cap: limits.maxStaff || 0, icon: Users, accent: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Classes', value: usage.classes, cap: 0, icon: BookOpen, accent: '#d97706', bg: '#fffbeb' },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tenants')} style={{ marginBottom: 14 }}><ArrowLeft size={14} /> Back to tenants</button>

      {/* Hero header */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg,#1a56e8,#0f172a)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>{initials}</div>
            <div>
              <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>{school.name} <Badge status={school.status} /></h1>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={13} /> {school.code}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={13} /> {school.email}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={13} /> {school.phone || 'no phone'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => resetPw.mutate()} disabled={resetPw.isPending}><RefreshCw size={14} /> Reset Password</button>
            {school.isActive
              ? <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`Suspend ${school.name}? Their access will be blocked.`)) suspend.mutate(); }}><Power size={14} /> Suspend</button>
              : <button className="btn btn-success btn-sm" onClick={() => reactivate.mutate()}><Power size={14} /> Reactivate</button>}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
        {kpis.map(k => {
          const atCap = k.cap > 0 && k.value >= k.cap;
          return (
            <div key={k.label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${k.accent}` }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.icon size={20} color={atCap ? '#ef4444' : k.accent} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: k.big ? 22 : 20, fontWeight: 800, color: atCap ? '#b91c1c' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                  {k.value}{k.cap ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}> / {k.cap.toLocaleString('en-IN')}</span> : ''}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}{k.sub ? ` · ${k.sub}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription + Admin */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Subscription */}
        <Card title="Subscription">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Status" value={<Badge status={school.status} />} />
            <Field icon={Wallet} label="Billing amount" value={amountLabel} />
            <Field icon={Clock} label="Trial ends" value={fmt(sub.trialEndDate)} />
            <Field icon={CalendarDays} label="Renews / ends" value={fmt(sub.currentPeriodEnd)} />
          </div>

          {/* Plan — read-only with an edit gate */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingPlan ? 8 : 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plan</div>
              {!editingPlan && (
                <button className="btn btn-secondary btn-sm" onClick={openPlanEdit} title="Change plan"><Pencil size={13} /> Change</button>
              )}
            </div>
            {!editingPlan ? (
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>{currentPlanName}</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-control" value={planDraft} onChange={e => setPlanDraft(e.target.value)} style={{ flex: 1 }}>
                  <option value="">No plan</option>
                  {plans.map(p => {
                    const net = Math.max(0, (p.monthlyPrice || p.price || 0) - (p.monthlyDiscount || 0));
                    const tag = p.trialDays > 0 ? `${p.trialDays}-day trial` : (net ? `${inr(net)}/mo` : 'free');
                    return <option key={p._id} value={p._id}>{p.name} — {tag}</option>;
                  })}
                </select>
                <button className="btn btn-primary btn-sm btn-icon" title="Save" disabled={changePlan.isPending || planDraft === currentPlanId} onClick={() => changePlan.mutate(planDraft)}><Check size={15} /></button>
                <button className="btn btn-secondary btn-sm btn-icon" title="Cancel" onClick={() => setEditingPlan(false)}><X size={15} /></button>
              </div>
            )}
            {editingPlan && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Assigning a plan updates the tenant's module access &amp; limits. A trial plan (re)starts the trial; paid activation happens when the school pays via Razorpay.
              </div>
            )}
          </div>

          {/* Modules unlocked */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Modules unlocked {planModules.length ? `(${planModules.length})` : '(all)'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {planModules.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>All modules</span>
                : planModules.map(k => <span key={k} style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', borderRadius: 6, padding: '2px 8px' }}>{moduleLabel(k)}</span>)}
            </div>
          </div>

          {/* Extend trial */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Extend trial</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-control" type="number" min="1" value={trialDays} onChange={e => setTrialDays(e.target.value)} style={{ maxWidth: 110 }} placeholder="Days" />
              <button className="btn btn-secondary" onClick={() => addTrialDays.mutate(trialDays)} disabled={addTrialDays.isPending || !trialDays}>
                <CalendarPlus size={14} /> Add days
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Adds to the current trial end date and keeps the tenant on trial.</div>
          </div>
        </Card>

        {/* Admin + Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="School Admin">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Name" value={admin?.name} />
              <Field icon={Mail} label="Email" value={admin?.email} />
              <Field icon={Phone} label="Phone" value={admin?.phone} />
              <Field icon={Clock} label="Last login" value={admin?.lastLogin ? fmt(admin.lastLogin) : 'never'} />
            </div>
          </Card>
          <Card title="School Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field icon={MapPin} label="Location" value={school.address?.city} />
              <Field label="Size (signup)" value={school.studentsRange} />
              <Field icon={CalendarDays} label="Registered" value={fmt(school.createdAt)} />
            </div>
          </Card>
        </div>
      </div>

      {/* Payment History */}
      <Card title="Payment History" pad={0}
        action={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total collected: <strong style={{ color: '#16a34a' }}>{inr(billing?.totalCollected)}</strong></span>}>
        {(payments || []).length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No payments yet — this tenant hasn't subscribed.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Invoice</th><th>Plan</th><th>Amount</th><th>Method</th><th>Period</th><th>Date</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id}>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{p.invoiceNumber}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.planName || '—'}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{inr(p.amount)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(p.method || '').replace('_', ' ')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(p.periodStart)} – {fmt(p.periodEnd)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
