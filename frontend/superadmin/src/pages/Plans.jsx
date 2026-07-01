import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { PageLoader, Modal, ConfirmDialog, EmptyState, Badge, FormRow } from '../components/ui';
import { Plus, Package, Pencil, Trash2, Check } from 'lucide-react';
import { MODULES, CORE_MODULES } from '../config/modules';

export default function Plans() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);     // { plan } or {}
  const [confirm, setConfirm] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['sa-plans'], queryFn: () => api.get('/super-admin/plans') });
  const plans = data?.plans || [];

  const del = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries(['sa-plans']); toast.success('Plan deleted'); setConfirm(null); },
    onError: (e) => { toast.error(e?.response?.data?.message || 'Failed'); setConfirm(null); },
  });

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="page-title">Plans</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> New Plan</button>
      </div>
      {plans.length === 0 ? <EmptyState icon={Package} message="No plans yet. Create one." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {plans.map(p => (
            <div key={p._id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="text-16-bold">{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.code}</div>
                </div>
                {!p.isActive && <Badge status="suspended" />}
              </div>
              {(() => {
                const mBase = p.monthlyPrice || p.price || 0;
                const mNet = Math.max(0, mBase - (p.monthlyDiscount || 0));
                const yBase = p.yearlyPrice || 0;
                const yNet = Math.max(0, yBase - (p.yearlyDiscount || 0));
                const Price = ({ label, base, net, disc }) => (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="text-18-bold" style={{ color: 'var(--primary)' }}>₹{net.toLocaleString('en-IN')}</span>
                    <span className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>/{label}</span>
                    {disc > 0 && <span className="text-12-regular" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{base.toLocaleString('en-IN')}</span>}
                    {disc > 0 && <span className="text-12-regular" style={{ color: '#16a34a' }}>−₹{disc.toLocaleString('en-IN')}</span>}
                  </div>
                );
                return (
                  <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {mBase > 0 && <Price label="mo" base={mBase} net={mNet} disc={p.monthlyDiscount || 0} />}
                    {yBase > 0 && <Price label="yr" base={yBase} net={yNet} disc={p.yearlyDiscount || 0} />}
                  </div>
                );
              })()}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ background: 'var(--bg-muted, #f1f5f9)', borderRadius: 6, padding: '2px 7px' }}>🧩 {(p.modules || []).length ? `${p.modules.length} modules` : 'All modules'}</span>
                <span style={{ background: 'var(--bg-muted, #f1f5f9)', borderRadius: 6, padding: '2px 7px' }}>👥 {p.limits?.maxStudents ? p.limits.maxStudents.toLocaleString('en-IN') : '∞'}</span>
                <span style={{ background: 'var(--bg-muted, #f1f5f9)', borderRadius: 6, padding: '2px 7px' }}>🧑‍🏫 {p.limits?.maxStaff ? p.limits.maxStaff.toLocaleString('en-IN') : '∞'}</span>
                {p.trialDays > 0 && <span style={{ background: '#fffbeb', color: '#b45309', borderRadius: 6, padding: '2px 7px' }}>🎁 {p.trialDays}-day trial</span>}
              </div>
              {(p.features || []).map(f => <div key={f} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, color: 'var(--text-secondary)' }}><Check size={12} color="#10b981" /> {f}</div>)}
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal({ plan: p })}><Pencil size={13} /> Edit</button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => setConfirm({ id: p._id, name: p.name })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && <PlanModal plan={modal.plan} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries(['sa-plans']); }} />}
      <ConfirmDialog open={!!confirm} danger title="Delete plan?" message={`Delete "${confirm?.name}"? Plans in use can't be deleted.`} onClose={() => setConfirm(null)} onConfirm={() => del.mutate(confirm.id)} />
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }) {
  const editing = !!plan;
  const [f, setF] = useState({
    name: plan?.name || '', code: plan?.code || '',
    monthlyPrice: plan?.monthlyPrice ?? plan?.price ?? '', monthlyDiscount: plan?.monthlyDiscount ?? '',
    yearlyPrice: plan?.yearlyPrice ?? '', yearlyDiscount: plan?.yearlyDiscount ?? '',
    trialDays: plan?.trialDays ?? '',
    description: plan?.description || '', features: (plan?.features || []).join('\n'), isActive: plan?.isActive ?? true,
    modules: plan?.modules || [],
    maxStudents: plan?.limits?.maxStudents ?? 0, maxStaff: plan?.limits?.maxStaff ?? 0,
  });
  const mNet = Math.max(0, (Number(f.monthlyPrice) || 0) - (Number(f.monthlyDiscount) || 0));
  const yNet = Math.max(0, (Number(f.yearlyPrice) || 0) - (Number(f.yearlyDiscount) || 0));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleModule = (key) => setF(p => ({ ...p, modules: p.modules.includes(key) ? p.modules.filter(m => m !== key) : [...p.modules, key] }));
  const selectAll = () => set('modules', MODULES.map(m => m.key));
  const selectCore = () => set('modules', CORE_MODULES);
  const selectNone = () => set('modules', []);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, code: f.code,
        monthlyPrice: Number(f.monthlyPrice) || 0, monthlyDiscount: Number(f.monthlyDiscount) || 0,
        yearlyPrice: Number(f.yearlyPrice) || 0, yearlyDiscount: Number(f.yearlyDiscount) || 0,
        trialDays: Number(f.trialDays) || 0,
        description: f.description, isActive: f.isActive,
        features: f.features.split('\n').map(s => s.trim()).filter(Boolean),
        modules: f.modules,
        limits: { maxStudents: Number(f.maxStudents) || 0, maxStaff: Number(f.maxStaff) || 0 },
      };
      return editing ? api.put(`/super-admin/plans/${plan._id}`, body) : api.post('/super-admin/plans', body);
    },
    onSuccess: () => { toast.success(editing ? 'Plan updated' : 'Plan created'); onSaved(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const submit = () => {
    if (!f.name || !f.code) return toast.error('Name and code are required');
    if ((Number(f.monthlyPrice) || 0) <= 0 && (Number(f.yearlyPrice) || 0) <= 0 && (Number(f.trialDays) || 0) <= 0)
      return toast.error('Enter a monthly/yearly price, or set free-trial days');
    save.mutate();
  };
  return (
    <Modal open onClose={onClose} title={editing ? 'Edit Plan' : 'New Plan'} size="md"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save Plan'}</button></>}>
      <FormRow>
        <div className="form-group"><label className="form-label">Name *</label><input className="form-control" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Standard" /></div>
        <div className="form-group"><label className="form-label">Code *</label><input className="form-control" value={f.code} onChange={e => set('code', e.target.value)} placeholder="standard" disabled={editing} /></div>
      </FormRow>
      {/* Monthly pricing */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' }}>Monthly</div>
      <FormRow>
        <div className="form-group"><label className="form-label">Monthly price (₹)</label><input className="form-control" type="number" min="0" value={f.monthlyPrice} onChange={e => set('monthlyPrice', e.target.value)} placeholder="e.g. 500" /></div>
        <div className="form-group"><label className="form-label">Monthly discount (₹)</label><input className="form-control" type="number" min="0" value={f.monthlyDiscount} onChange={e => set('monthlyDiscount', e.target.value)} placeholder="0" /></div>
      </FormRow>
      {(Number(f.monthlyPrice) || 0) > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6, marginBottom: 10 }}>
          Charged monthly: <strong style={{ color: 'var(--primary)' }}>₹{mNet.toLocaleString('en-IN')}</strong>{(Number(f.monthlyDiscount) || 0) > 0 && <span> (₹{(Number(f.monthlyPrice) || 0).toLocaleString('en-IN')} − ₹{(Number(f.monthlyDiscount) || 0).toLocaleString('en-IN')})</span>}
        </div>
      )}
      {/* Yearly pricing */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' }}>Yearly</div>
      <FormRow>
        <div className="form-group"><label className="form-label">Yearly price (₹)</label><input className="form-control" type="number" min="0" value={f.yearlyPrice} onChange={e => set('yearlyPrice', e.target.value)} placeholder="e.g. 5000" /></div>
        <div className="form-group"><label className="form-label">Yearly discount (₹)</label><input className="form-control" type="number" min="0" value={f.yearlyDiscount} onChange={e => set('yearlyDiscount', e.target.value)} placeholder="0" /></div>
      </FormRow>
      {(Number(f.yearlyPrice) || 0) > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6, marginBottom: 10 }}>
          Charged yearly: <strong style={{ color: 'var(--primary)' }}>₹{yNet.toLocaleString('en-IN')}</strong>{(Number(f.yearlyDiscount) || 0) > 0 && <span> (₹{(Number(f.yearlyPrice) || 0).toLocaleString('en-IN')} − ₹{(Number(f.yearlyDiscount) || 0).toLocaleString('en-IN')})</span>}
        </div>
      )}
      {/* Free trial */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' }}>Free Trial</div>
      <div className="form-group">
        <label className="form-label">Free-trial days</label>
        <input className="form-control" type="number" min="0" value={f.trialDays} onChange={e => set('trialDays', e.target.value)} placeholder="0" style={{ maxWidth: 200 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Days of free access this plan grants. 0 = no trial. You can extend a tenant's trial later from Tenants.</div>
      </div>
      <div className="form-group"><label className="form-label">Description</label><input className="form-control" value={f.description} onChange={e => set('description', e.target.value)} /></div>

      {/* Usage limits */}
      <FormRow>
        <div className="form-group">
          <label className="form-label">Max students</label>
          <input className="form-control" type="number" min="0" value={f.maxStudents} onChange={e => set('maxStudents', e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>0 = unlimited</div>
        </div>
        <div className="form-group">
          <label className="form-label">Max employees</label>
          <input className="form-control" type="number" min="0" value={f.maxStaff} onChange={e => set('maxStaff', e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>0 = unlimited</div>
        </div>
      </FormRow>

      {/* Module entitlements */}
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label className="form-label" style={{ margin: 0 }}>Module access {f.modules.length ? `(${f.modules.length})` : '(all)'}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectCore}>Core</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectAll}>All</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectNone}>None</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Leave none selected to unlock all modules (unrestricted).</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {MODULES.map(m => (
            <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, border: `1px solid ${f.modules.includes(m.key) ? 'var(--primary)' : 'var(--border)'}`, background: f.modules.includes(m.key) ? '#eff6ff' : 'transparent' }}>
              <input type="checkbox" checked={f.modules.includes(m.key)} onChange={() => toggleModule(m.key)} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group"><label className="form-label">Features (one per line)</label><textarea className="form-control" rows={4} value={f.features} onChange={e => set('features', e.target.value)} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.isActive} onChange={e => set('isActive', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} /> Active (available to assign / pay)
      </label>
    </Modal>
  );
}
