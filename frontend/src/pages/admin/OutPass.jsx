import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2, Edit2, LogOut, Users, Clock, CheckCircle, Download, RotateCcw, X, User, Phone, Tag, ShieldCheck, FileText, CreditCard, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, Pagination, SearchInput, PageLoader, EmptyState, StatCard, FormRow, Avatar } from '../../components/ui';
import { format } from 'date-fns';

const REASONS = [
  { value: 'medical',         label: 'Medical',          color: '#dc2626', bg: '#fef2f2' },
  { value: 'family_function', label: 'Family Function',  color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'emergency',       label: 'Emergency',        color: '#b91c1c', bg: '#fef2f2' },
  { value: 'half_day',        label: 'Half Day',         color: '#0891b2', bg: '#ecfeff' },
  { value: 'early_leave',     label: 'Early Leave',      color: '#1a56e8', bg: '#eff6ff' },
  { value: 'appointment',     label: 'Appointment',      color: '#d97706', bg: '#fffbeb' },
  { value: 'other',           label: 'Other',            color: '#64748b', bg: '#f1f5f9' },
];
const REASON_META = Object.fromEntries(REASONS.map(r => [r.value, r]));

const STATUS_META = {
  active:    { label: 'Out',       color: '#d97706', bg: '#fffbeb' },
  returned:  { label: 'Returned',  color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
};
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));

const RELATIONS = ['father', 'mother', 'guardian', 'grandfather', 'grandmother', 'uncle', 'aunt', 'sibling', 'driver', 'other'];

function Pill({ meta }) {
  if (!meta) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
}

const classLabel = (cls) => cls ? `${cls.name}${cls.section ? ' - ' + cls.section : ''}` : '';

export default function OutPass() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editPass, setEditPass] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const { data: statsData } = useQuery({ queryKey: ['outpass-stats'], queryFn: () => api.get('/outpasses/stats') });
  const stats = statsData?.stats || {};

  const { data, isLoading } = useQuery({
    queryKey: ['outpasses', page, search, statusFilter, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return api.get(`/outpasses?${params}`);
    },
  });
  const outpasses = data?.outpasses || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const refresh = () => { qc.invalidateQueries(['outpasses']); qc.invalidateQueries(['outpass-stats']); };

  const deleteMutation = useMutation({
    mutationFn: () => Promise.all(selected.map(id => api.delete(`/outpasses/${id}`))),
    onSuccess: () => { refresh(); toast.success(`${selected.length} pass(es) deleted`); setSelected([]); setBulkDeleteConfirm(false); },
    onError: () => { toast.error('Failed to delete'); setBulkDeleteConfirm(false); },
  });

  const returnMutation = useMutation({
    mutationFn: (id) => api.post(`/outpasses/${id}/return`),
    onSuccess: () => { refresh(); toast.success('Marked as returned'); setReturnTarget(null); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const downloadPass = async (op) => {
    setDownloadingId(op._id);
    try {
      const res = await api.get(`/outpasses/${op._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `OutPass_${op.passNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to generate pass'); }
    finally { setDownloadingId(null); }
  };

  const allSelected = outpasses.length > 0 && outpasses.every(o => selected.includes(o._id));
  const hasFilters = search || statusFilter || startDate || endDate;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Out Pass</h1>
          <p className="page-subtitle">Issue and track student gate passes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditPass(null); setShowModal(true); }}>
            <Plus size={16} /> New Out Pass
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard title="Today's Passes" value={stats.today ?? 0}      icon={LogOut}      color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Currently Out"  value={stats.out ?? 0}        icon={Clock}       color="#d97706" bg="#fffbeb" />
        <StatCard title="Returned Today" value={stats.returned ?? 0}   icon={CheckCircle} color="#16a34a" bg="#f0fdf4" />
        <StatCard title="This Month"     value={stats.monthTotal ?? 0} icon={Users}       color="#7c3aed" bg="#f5f3ff" />
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by pass no, person or phone..." />
        <AntSelect style={{ minWidth: 150 }} value={statusFilter || undefined} placeholder="All Status" allowClear
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }} options={STATUS_OPTIONS} />
        <DatePicker.RangePicker
          style={{ width: 280, marginLeft: 'auto' }}
          format="DD MMM YYYY"
          value={[startDate ? dayjs(startDate) : null, endDate ? dayjs(endDate) : null]}
          onChange={(r) => { setStartDate(r?.[0] ? r[0].format('YYYY-MM-DD') : ''); setEndDate(r?.[1] ? r[1].format('YYYY-MM-DD') : ''); setPage(1); }}
          getPopupContainer={() => document.body}
        />
        {hasFilters && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={allSelected}
                      onChange={e => setSelected(e.target.checked ? outpasses.map(o => o._id) : [])} />
                  </th>
                  <th>Pass No</th>
                  <th>Student</th>
                  <th>Collected By</th>
                  <th>Reason</th>
                  <th>Exit Time</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outpasses.length === 0 && (
                  <tr><td colSpan={8}>
                    <EmptyState icon={LogOut} message="No out passes issued." action={<button className="btn btn-primary btn-sm" onClick={() => { setEditPass(null); setShowModal(true); }}><Plus size={14} /> New Out Pass</button>} />
                  </td></tr>
                )}
                {outpasses.map(op => (
                  <tr key={op._id} style={{ cursor: 'pointer' }} onClick={() => setViewId(op._id)}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(op._id)}
                        onChange={e => setSelected(p => e.target.checked ? [...p, op._id] : p.filter(id => id !== op._id))} />
                    </td>
                    <td><span className="badge badge-info">{op.passNumber}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={op.student?.photo} name={op.student?.name} size={30} />
                        <div>
                          <div className="text-14-medium">{op.student?.name || '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{classLabel(op.student?.currentClass) || op.student?.admissionNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-14-regular">{op.pickupName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {op.pickupRelation || '—'}{op.pickupPhone ? ` · ${op.pickupPhone}` : ''}
                        {op.pickupType === 'guardian' && <span style={{ marginLeft: 6, color: '#d97706' }}>(Guardian)</span>}
                      </div>
                    </td>
                    <td><Pill meta={REASON_META[op.reason]} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{op.exitDate ? format(new Date(op.exitDate), 'dd MMM, hh:mm a') : '—'}</td>
                    <td><Pill meta={STATUS_META[op.status]} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm btn-icon" title="Download Pass" onClick={() => downloadPass(op)} disabled={downloadingId === op._id}>
                          <Download size={14} />
                        </button>
                        {op.status === 'active' && (
                          <button className="btn btn-secondary btn-sm btn-icon" title="Mark returned" onClick={() => setReturnTarget(op)}><RotateCcw size={14} /></button>
                        )}
                        <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => { setEditPass(op); setShowModal(true); }}><Edit2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      )}

      {showModal && (
        <OutPassModal pass={editPass} onClose={() => { setShowModal(false); setEditPass(null); }} onSaved={() => { refresh(); setShowModal(false); setEditPass(null); }} />
      )}

      {viewId && (
        <OutPassDetailModal id={viewId} onClose={() => setViewId(null)}
          onEdit={(op) => { setViewId(null); setEditPass(op); setShowModal(true); }}
          onDownload={downloadPass}
          onReturn={(op) => { setViewId(null); setReturnTarget(op); }} />
      )}

      <ConfirmDialog open={!!returnTarget} onClose={() => setReturnTarget(null)}
        onConfirm={() => returnMutation.mutate(returnTarget._id)}
        title="Mark Returned" message={`Confirm that ${returnTarget?.student?.name || 'the student'} has returned to school?`} />

      <ConfirmDialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Out Passes" message={`This will permanently delete ${selected.length} pass record(s). This cannot be undone.`} danger />
    </div>
  );
}

// ── Create / Edit Modal ─────────────────────────────────────────────────────────
function OutPassModal({ pass, onClose, onSaved }) {
  const isEdit = !!pass;

  const { data: parentsData } = useQuery({ queryKey: ['parents'], queryFn: () => api.get('/parents'), enabled: !isEdit });
  const parents = parentsData?.parents || [];

  const [parentId, setParentId] = useState(pass?.parent?._id || pass?.parent || '');
  const [studentIds, setStudentIds] = useState(pass?.student ? [pass.student._id || pass.student] : []);
  const [pickupType, setPickupType] = useState(pass?.pickupType || 'parent');
  const [form, setForm] = useState({
    pickupName:     pass?.pickupName || '',
    pickupRelation: pass?.pickupRelation || '',
    pickupPhone:    pass?.pickupPhone || '',
    pickupIdProof:  pass?.pickupIdProof || '',
    reason:         pass?.reason || 'early_leave',
    reasonDetail:   pass?.reasonDetail || '',
    exitDate:       pass?.exitDate || dayjs().toISOString(),
    expectedReturn: pass?.expectedReturn || '',
    remarks:        pass?.remarks || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedParent = parents.find(p => p._id === parentId);
  const parentStudents = selectedParent?.students || [];
  const selectedStudents = parentStudents.filter(s => studentIds.includes(s._id));

  // When a parent is chosen: load their children, auto-select if single, prefill pickup
  const onParentChange = (pid) => {
    setParentId(pid);
    const p = parents.find(x => x._id === pid);
    const studs = p?.students || [];
    setStudentIds(studs.length === 1 ? [studs[0]._id] : []);
    if (pickupType === 'parent' && p) {
      setForm(f => ({ ...f, pickupName: p.name || '', pickupRelation: p.relation || '', pickupPhone: p.phone || '', pickupIdProof: '' }));
    }
  };

  const onPickupTypeChange = (type) => {
    setPickupType(type);
    if (type === 'parent' && selectedParent) {
      setForm(f => ({ ...f, pickupName: selectedParent.name || '', pickupRelation: selectedParent.relation || '', pickupPhone: selectedParent.phone || '', pickupIdProof: '' }));
    } else if (type === 'guardian') {
      setForm(f => ({ ...f, pickupName: '', pickupRelation: '', pickupPhone: '', pickupIdProof: '' }));
    }
  };

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? api.put(`/outpasses/${pass._id}`, payload) : api.post('/outpasses', payload),
    onSuccess: (res) => {
      const n = res?.count || 1;
      toast.success(isEdit ? 'Out pass updated!' : `${n} out pass${n > 1 ? 'es' : ''} issued!`);
      onSaved();
    },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = () => {
    if (!isEdit && !studentIds.length) return toast.error('Please select at least one student');
    if (!form.pickupName?.trim()) return toast.error('Pickup person name is required');
    if (form.pickupPhone && !/^[0-9]{10}$/.test(form.pickupPhone)) return toast.error('Enter a valid 10-digit phone');
    const payload = {
      ...(isEdit ? { student: pass.student?._id || pass.student } : { studentIds }),
      parent: pickupType === 'parent' ? (parentId || undefined) : undefined,
      pickupType,
      pickupName: form.pickupName.trim(),
      pickupRelation: form.pickupRelation || undefined,
      pickupPhone: form.pickupPhone || undefined,
      pickupIdProof: pickupType === 'guardian' ? (form.pickupIdProof || undefined) : undefined,
      reason: form.reason,
      reasonDetail: form.reasonDetail || undefined,
      exitDate: form.exitDate || undefined,
      expectedReturn: form.expectedReturn || undefined,
      remarks: form.remarks || undefined,
    };
    saveMutation.mutate(payload);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Out Pass · ${pass.passNumber}` : 'New Out Pass'} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Issue Out Pass'}
        </button>
      </>}>
      {/* Student selection */}
      {isEdit ? (
        <div className="form-group">
          <label className="form-label">Student</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
            <Avatar src={pass.student?.photo} name={pass.student?.name} size={32} />
            <div>
              <div className="text-14-semibold">{pass.student?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{classLabel(pass.student?.currentClass) || pass.student?.admissionNumber}</div>
            </div>
          </div>
        </div>
      ) : (
        <FormRow>
          <div className="form-group">
            <label className="form-label">Parent / Guardian on record *</label>
            <AntSelect
              style={{ width: '100%' }} showSearch optionFilterProp="label"
              placeholder="Select registered parent"
              value={parentId || undefined}
              onChange={onParentChange}
              options={parents.map(p => ({ value: p._id, label: `${p.name} — ${p.phone}` }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Student{parentStudents.length > 1 ? 's' : ''} *</label>
            <AntSelect
              mode="multiple"
              style={{ width: '100%' }} showSearch optionFilterProp="label"
              placeholder={parentId ? 'Select one or more students' : 'Select a parent first'}
              disabled={!parentId}
              value={studentIds}
              onChange={setStudentIds}
              options={parentStudents.map(s => ({ value: s._id, label: `${s.name}${s.currentClass ? ` (${classLabel(s.currentClass)})` : ''}` }))}
            />
          </div>
        </FormRow>
      )}

      {!isEdit && selectedStudents.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {selectedStudents.map(st => (
            <div key={st._id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 12px' }}>
              <Avatar src={st.photo} name={st.name} size={32} />
              <div>
                <div className="text-14-semibold">{st.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{classLabel(st.currentClass)} · {st.admissionNumber}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Who is collecting */}
      <div className="form-group">
        <label className="form-label">Who is collecting the student?</label>
        <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
          {[
            { key: 'parent', label: 'Registered Parent' },
            { key: 'guardian', label: 'Other Guardian' },
          ].map(opt => (
            <button key={opt.key} type="button" onClick={() => onPickupTypeChange(opt.key)}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                borderLeft: opt.key === 'guardian' ? '1px solid var(--border)' : 'none',
                background: pickupType === opt.key ? 'var(--primary)' : '#f8fafc',
                color: pickupType === opt.key ? 'white' : 'var(--text-muted)',
              }}>{opt.label}</button>
          ))}
        </div>
        {pickupType === 'guardian' && (
          <p style={{ fontSize: 12, color: '#d97706', marginTop: 6, marginBottom: 0 }}>
            Capture the guardian's details and ID proof — the watchman will verify these.
          </p>
        )}
      </div>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Pickup Person Name *</label>
          <input className="form-control" value={form.pickupName} onChange={e => set('pickupName', e.target.value)}
            placeholder="Full name" disabled={pickupType === 'parent'} />
        </div>
        <div className="form-group">
          <label className="form-label">Relation</label>
          <AntSelect
            style={{ width: '100%' }} showSearch placeholder="Select relation"
            value={form.pickupRelation || undefined}
            onChange={v => set('pickupRelation', v)}
            disabled={pickupType === 'parent'}
            options={RELATIONS.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
          />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input className="form-control" type="tel" maxLength={10} value={form.pickupPhone}
            onChange={e => set('pickupPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="9876543210" disabled={pickupType === 'parent'} />
        </div>
        {pickupType === 'guardian' && (
          <div className="form-group">
            <label className="form-label">ID Proof Number</label>
            <input className="form-control" value={form.pickupIdProof} onChange={e => set('pickupIdProof', e.target.value)} placeholder="Aadhaar / License / Voter ID" />
          </div>
        )}
      </FormRow>

      {/* Reason + timing */}
      <FormRow>
        <div className="form-group">
          <label className="form-label">Reason *</label>
          <AntSelect style={{ width: '100%' }} value={form.reason} onChange={v => set('reason', v)}
            options={REASONS.map(r => ({ value: r.value, label: r.label }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Exit Date &amp; Time</label>
          <DatePicker
            style={{ width: '100%' }}
            showTime format="DD MMM YYYY, hh:mm A"
            value={form.exitDate ? dayjs(form.exitDate) : null}
            onChange={(d) => set('exitDate', d ? d.toISOString() : '')}
            getPopupContainer={() => document.body}
          />
        </div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Reason Details</label>
        <textarea className="form-control" rows={2} value={form.reasonDetail} onChange={e => set('reasonDetail', e.target.value)} placeholder="Add any specifics (optional)" style={{ resize: 'vertical' }} />
      </div>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Expected Return (optional)</label>
          <DatePicker
            style={{ width: '100%' }}
            showTime format="DD MMM YYYY, hh:mm A"
            placeholder="If returning the same day"
            value={form.expectedReturn ? dayjs(form.expectedReturn) : null}
            onChange={(d) => set('expectedReturn', d ? d.toISOString() : '')}
            getPopupContainer={() => document.body}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Remarks</label>
          <input className="form-control" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Internal notes (optional)" />
        </div>
      </FormRow>
    </Modal>
  );
}

// ── Detail Modal ────────────────────────────────────────────────────────────────
// ── Detail-tab presentational helpers ───────────────────────────────────────────
function StatTile({ icon: Icon, color, bg, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function IconField({ icon: Icon, label, value, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        {children || <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</div>}
      </div>
    </div>
  );
}

function TextBlock({ label, value }) {
  const empty = !value || value === '—';
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 5 }}>{label}</div>
      {empty ? (
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>—</div>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>{value}</div>
      )}
    </div>
  );
}

function OutPassDetailModal({ id, onClose, onEdit, onDownload, onReturn }) {
  const { data, isLoading } = useQuery({ queryKey: ['outpass', id], queryFn: () => api.get(`/outpasses/${id}`) });
  const op = data?.outpass;
  const fmt = (d) => d ? format(new Date(d), 'dd MMM, hh:mm a') : null;

  return (
    <Modal open onClose={onClose} title="Out Pass Details" size="lg"
      footer={op ? <>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {op.status === 'active' && <button className="btn btn-secondary" onClick={() => onReturn(op)}><RotateCcw size={14} /> Mark Returned</button>}
        <button className="btn btn-secondary" onClick={() => onEdit(op)}>Edit</button>
        <button className="btn btn-primary" onClick={() => onDownload(op)}><Download size={14} /> Download Pass</button>
      </> : null}>
      {isLoading || !op ? <PageLoader /> : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
            <Avatar src={op.student?.photo} name={op.student?.name} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{op.student?.name}</h3>
                <Pill meta={STATUS_META[op.status]} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>{classLabel(op.student?.currentClass)} · {op.student?.admissionNumber}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>· {op.passNumber}</span>
                <Pill meta={REASON_META[op.reason]} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatTile icon={LogOut} color="#1a56e8" bg="#eff6ff" label="Exit Time" value={fmt(op.exitDate) || '—'} />
              <StatTile icon={Clock} color="#d97706" bg="#fffbeb" label="Expected Return" value={fmt(op.expectedReturn) || 'Not set'} />
              <StatTile icon={CheckCircle} color="#16a34a" bg="#f0fdf4" label="Returned"
                value={op.returnedAt ? fmt(op.returnedAt) : (op.status === 'active' ? 'Still out' : (STATUS_META[op.status]?.label || '—'))} />
            </div>

            {/* Pickup + Pass */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <DetailSection title="Collected By">
                <IconField icon={User} label="Pickup Person" value={op.pickupName || '—'} />
                <IconField icon={Users} label="Relation" value={op.pickupRelation || '—'} />
                <IconField icon={Phone} label="Phone" value={op.pickupPhone || '—'} />
                <IconField icon={ShieldCheck} label="Pickup Type" value={op.pickupType === 'guardian' ? 'Other Guardian' : 'Registered Parent'} />
                {op.pickupIdProof && <IconField icon={CreditCard} label="ID Proof No." value={op.pickupIdProof} />}
              </DetailSection>
              <DetailSection title="Pass">
                <IconField icon={Hash} label="Pass No" value={op.passNumber} />
                <IconField icon={Tag} label="Reason">
                  <div style={{ marginTop: 2 }}><Pill meta={REASON_META[op.reason]} /></div>
                </IconField>
                <IconField icon={User} label="Issued By" value={op.approvedBy?.name || '—'} />
              </DetailSection>
            </div>

            {/* Notes */}
            <DetailSection title="Notes">
              <TextBlock label="Reason Details" value={op.reasonDetail || '—'} />
              {op.remarks && <TextBlock label="Remarks" value={op.remarks} />}
            </DetailSection>
          </div>
        </>
      )}
    </Modal>
  );
}
