import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2, Edit2, DoorOpen, Users, Clock, BellRing, LogOut, Phone, Mail, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, Pagination, SearchInput, PageLoader, EmptyState, StatCard, FormRow } from '../../components/ui';
import { format } from 'date-fns';

// Purpose categories with their display labels and colors.
const PURPOSES = [
  { value: 'admission_enquiry', label: 'Admission Enquiry', color: '#1a56e8', bg: '#eff6ff' },
  { value: 'fee_enquiry',       label: 'Fee Enquiry',       color: '#0891b2', bg: '#ecfeff' },
  { value: 'fee_payment',       label: 'Fee Payment',       color: '#16a34a', bg: '#f0fdf4' },
  { value: 'uniform',           label: 'Uniform',           color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'books_stationery',  label: 'Books / Stationery',color: '#d97706', bg: '#fffbeb' },
  { value: 'vendor_supplier',   label: 'Vendor / Supplier', color: '#9333ea', bg: '#faf5ff' },
  { value: 'parent_meeting',    label: 'Parent Meeting',    color: '#0d9488', bg: '#f0fdfa' },
  { value: 'staff_meeting',     label: 'Staff Meeting',     color: '#2563eb', bg: '#eff6ff' },
  { value: 'complaint',         label: 'Complaint',         color: '#dc2626', bg: '#fef2f2' },
  { value: 'document_collection', label: 'Document Collection', color: '#475569', bg: '#f1f5f9' },
  { value: 'repair',            label: 'Repair',            color: '#0d9488', bg: '#f0fdfa' },
  { value: 'other',             label: 'Other',             color: '#64748b', bg: '#f1f5f9' },
];
const PURPOSE_META = Object.fromEntries(PURPOSES.map(p => [p.value, p]));

const STATUS_META = {
  waiting:     { label: 'Waiting',     color: '#d97706', bg: '#fffbeb' },
  in_progress: { label: 'In Progress', color: '#1a56e8', bg: '#eff6ff' },
  completed:   { label: 'Completed',   color: '#16a34a', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   color: '#dc2626', bg: '#fef2f2' },
};
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));

function Pill({ meta }) {
  if (!meta) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
}

export default function Visits() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editVisit, setEditVisit] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const { data: statsData } = useQuery({ queryKey: ['visit-stats'], queryFn: () => api.get('/visits/stats') });
  const stats = statsData?.stats || {};

  const { data, isLoading } = useQuery({
    queryKey: ['visits', page, search, statusFilter, purposeFilter, startDate, endDate, followUpOnly],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (purposeFilter) params.set('purpose', purposeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (followUpOnly) params.set('followUp', 'true');
      return api.get(`/visits?${params}`);
    },
  });
  const visits = data?.visits || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const refresh = () => { qc.invalidateQueries(['visits']); qc.invalidateQueries(['visit-stats']); };

  const deleteMutation = useMutation({
    mutationFn: () => Promise.all(selected.map(id => api.delete(`/visits/${id}`))),
    onSuccess: () => { refresh(); toast.success(`${selected.length} visit(s) deleted`); setSelected([]); setBulkDeleteConfirm(false); },
    onError: () => { toast.error('Failed to delete'); setBulkDeleteConfirm(false); },
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ id, outcome }) => api.post(`/visits/${id}/checkout`, { outcome }),
    onSuccess: () => { refresh(); toast.success('Visitor checked out'); setCheckoutTarget(null); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const followUpMutation = useMutation({
    mutationFn: ({ id, outcome }) => api.post(`/visits/${id}/complete-followup`, { outcome }),
    onSuccess: () => { refresh(); toast.success('Follow-up completed'); setFollowUpTarget(null); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const allSelected = visits.length > 0 && visits.every(v => selected.includes(v._id));
  const hasFilters = search || statusFilter || purposeFilter || startDate || endDate || followUpOnly;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Visits</h1>
          <p className="page-subtitle">Front-desk visitor &amp; enquiry log</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditVisit(null); setShowModal(true); }}>
            <Plus size={16} /> Add Visitor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard title="Today's Visits"  value={stats.today ?? 0}        icon={DoorOpen} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Waiting / Active" value={stats.active ?? 0}       icon={Clock}    color="#d97706" bg="#fffbeb" />
        <StatCard title="Follow-ups Due"  value={stats.followUpsDue ?? 0}  icon={BellRing} color="#dc2626" bg="#fef2f2" />
        <StatCard title="This Month"      value={stats.monthTotal ?? 0}    icon={Users}    color="#16a34a" bg="#f0fdf4" />
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name or phone..." />
        <AntSelect style={{ minWidth: 150 }} value={statusFilter || undefined} placeholder="All Status" allowClear
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }} options={STATUS_OPTIONS} />
        <AntSelect style={{ minWidth: 180 }} value={purposeFilter || undefined} placeholder="All Purposes" allowClear showSearch optionFilterProp="label"
          onChange={v => { setPurposeFilter(v ?? ''); setPage(1); }} options={PURPOSES.map(p => ({ value: p.value, label: p.label }))} />
        <DatePicker.RangePicker
          style={{ width: 280 }}
          format="DD MMM YYYY"
          value={[startDate ? dayjs(startDate) : null, endDate ? dayjs(endDate) : null]}
          onChange={(r) => { setStartDate(r?.[0] ? r[0].format('YYYY-MM-DD') : ''); setEndDate(r?.[1] ? r[1].format('YYYY-MM-DD') : ''); setPage(1); }}
          getPopupContainer={() => document.body}
        />
        <button className={`btn btn-sm ${followUpOnly ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFollowUpOnly(f => !f); setPage(1); }}>
          <BellRing size={14} /> Follow-ups
        </button>
        {hasFilters && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); setPurposeFilter(''); setStartDate(''); setEndDate(''); setFollowUpOnly(false); setPage(1); }}>
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
                      onChange={e => setSelected(e.target.checked ? visits.map(v => v._id) : [])} />
                  </th>
                  <th>Visitor</th>
                  <th>Purpose</th>
                  <th>Reason</th>
                  <th>Attended By</th>
                  <th>Check-in</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 && (
                  <tr><td colSpan={8}>
                    <EmptyState icon={DoorOpen} message="No visits recorded." action={<button className="btn btn-primary btn-sm" onClick={() => { setEditVisit(null); setShowModal(true); }}><Plus size={14} /> Add Visitor</button>} />
                  </td></tr>
                )}
                {visits.map(v => (
                  <tr key={v._id} style={{ cursor: 'pointer' }} onClick={() => setViewId(v._id)}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(v._id)}
                        onChange={e => setSelected(p => e.target.checked ? [...p, v._id] : p.filter(id => id !== v._id))} />
                    </td>
                    <td>
                      <div className="text-14-semibold">{v.visitorName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.phone}{v.numberOfVisitors > 1 ? ` · ${v.numberOfVisitors} people` : ''}</div>
                      {v.followUpRequired && !v.followUpCompleted && v.status !== 'cancelled' && (
                        <span style={{ fontSize: 11, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <BellRing size={11} /> Follow-up{v.followUpDate ? ` · ${format(new Date(v.followUpDate), 'dd MMM')}` : ''}
                        </span>
                      )}
                    </td>
                    <td><Pill meta={PURPOSE_META[v.purpose]} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.purposeDetail || '—'}</td>
                    <td style={{ fontSize: 13 }}>{v.attendedBy?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v.checkInTime ? format(new Date(v.checkInTime), 'dd MMM, hh:mm a') : '—'}</td>
                    <td><Pill meta={STATUS_META[v.status]} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {v.followUpRequired && !v.followUpCompleted && v.status !== 'cancelled' && (
                          <button className="btn btn-sm" title="Complete follow-up" onClick={() => setFollowUpTarget(v)}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <BellRing size={13} /> Complete Follow-up
                          </button>
                        )}
                        {v.status !== 'completed' && v.status !== 'cancelled' && (
                          <button className="btn btn-secondary btn-sm btn-icon" title="Check out" onClick={() => setCheckoutTarget(v)}><LogOut size={14} /></button>
                        )}
                        <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => { setEditVisit(v); setShowModal(true); }}><Edit2 size={14} /></button>
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
        <VisitModal visit={editVisit} onClose={() => { setShowModal(false); setEditVisit(null); }} onSaved={() => { refresh(); setShowModal(false); setEditVisit(null); }} />
      )}

      {viewId && (
        <VisitDetailModal id={viewId} onClose={() => setViewId(null)}
          onEdit={(v) => { setViewId(null); setEditVisit(v); setShowModal(true); }}
          onCheckout={(v) => { setViewId(null); setCheckoutTarget(v); }}
          onCompleteFollowUp={(v) => { setViewId(null); setFollowUpTarget(v); }} />
      )}

      {checkoutTarget && (
        <CheckoutModal visit={checkoutTarget} loading={checkoutMutation.isPending}
          onClose={() => setCheckoutTarget(null)}
          onConfirm={(outcome) => checkoutMutation.mutate({ id: checkoutTarget._id, outcome })} />
      )}

      {followUpTarget && (
        <CompleteFollowUpModal visit={followUpTarget} loading={followUpMutation.isPending}
          onClose={() => setFollowUpTarget(null)}
          onConfirm={(outcome) => followUpMutation.mutate({ id: followUpTarget._id, outcome })} />
      )}

      <ConfirmDialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Visits" message={`This will permanently delete ${selected.length} visit record(s). This cannot be undone.`} danger />
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function VisitModal({ visit, onClose, onSaved }) {
  const isEdit = !!visit;
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      visitorName: visit?.visitorName || '',
      phone: visit?.phone || '',
      email: visit?.email || '',
      numberOfVisitors: visit?.numberOfVisitors || 1,
      purpose: visit?.purpose || 'admission_enquiry',
      purposeDetail: visit?.purposeDetail || '',
      relatedStudent: visit?.relatedStudent?._id || visit?.relatedStudent || undefined,
      attendedBy: visit?.attendedBy?._id || visit?.attendedBy || undefined,
      status: visit?.status || 'waiting',
      followUpRequired: visit?.followUpRequired || false,
      followUpDate: visit?.followUpDate ? format(new Date(visit.followUpDate), 'yyyy-MM-dd') : '',
      outcome: visit?.outcome || '',
      remarks: visit?.remarks || '',
    },
  });
  const followUpRequired = watch('followUpRequired');

  const { data: stuData } = useQuery({ queryKey: ['students-all-visits'], queryFn: () => api.get('/students?limit=500') });
  const students = stuData?.students || [];
  const { data: empData } = useQuery({ queryKey: ['employees-all-visits'], queryFn: () => api.get('/employees?limit=200') });
  const employees = empData?.employees || [];

  const saveMutation = useMutation({
    mutationFn: (d) => isEdit ? api.put(`/visits/${visit._id}`, d) : api.post('/visits', d),
    onSuccess: () => { toast.success(isEdit ? 'Visit updated!' : 'Visitor checked in!'); onSaved(); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  const submit = (d) => {
    const payload = { ...d };
    payload.numberOfVisitors = Number(d.numberOfVisitors) || 1;
    if (!d.relatedStudent) delete payload.relatedStudent;
    if (!d.attendedBy) delete payload.attendedBy;
    if (!d.followUpRequired) { payload.followUpDate = undefined; }
    saveMutation.mutate(payload);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Visit' : 'Add Visitor'} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit(submit)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Check In Visitor'}
        </button>
      </>}>
      <form>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Visitor Name *</label>
            <input className="form-control" {...register('visitorName', { required: 'Required' })} placeholder="Full name" />
            {errors.visitorName && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.visitorName.message}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input className="form-control" type="tel" maxLength={10}
              {...register('phone', { required: 'Required', pattern: { value: /^[0-9]{10}$/, message: 'Enter a valid 10-digit number' } })}
              placeholder="9876543210" onInput={e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }} />
            {errors.phone && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
          </div>
        </FormRow>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" {...register('email')} placeholder="optional@email.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Number of Visitors</label>
            <input className="form-control" type="number" min={1} {...register('numberOfVisitors')} />
          </div>
        </FormRow>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Purpose *</label>
            <Controller name="purpose" control={control} render={({ field }) => (
              <AntSelect {...field} style={{ width: '100%' }} showSearch optionFilterProp="label"
                options={PURPOSES.map(p => ({ value: p.value, label: p.label }))} />
            )} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <Controller name="status" control={control} render={({ field }) => (
              <AntSelect {...field} style={{ width: '100%' }} options={STATUS_OPTIONS} />
            )} />
          </div>
        </FormRow>
        <div className="form-group">
          <label className="form-label">Reason / Details</label>
          <textarea className="form-control" rows={2} {...register('purposeDetail')} placeholder="What is the visit about?" style={{ resize: 'vertical' }} />
        </div>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Related Student</label>
            <Controller name="relatedStudent" control={control} render={({ field }) => (
              <AntSelect {...field} style={{ width: '100%' }} placeholder="Link to a student (optional)" allowClear showSearch optionFilterProp="label"
                options={students.map(s => ({ value: s._id, label: `${s.name}${s.admissionNumber ? ` (${s.admissionNumber})` : ''}` }))} />
            )} />
          </div>
          <div className="form-group">
            <label className="form-label">Attended By</label>
            <Controller name="attendedBy" control={control} render={({ field }) => (
              <AntSelect {...field} style={{ width: '100%' }} placeholder="Staff who handled (optional)" allowClear showSearch optionFilterProp="label"
                options={employees.map(e => ({ value: e._id, label: `${e.name}${e.designation ? ` — ${e.designation}` : ''}` }))} />
            )} />
          </div>
        </FormRow>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" {...register('followUpRequired')} />
            <span className="form-label" style={{ margin: 0 }}>Follow-up required</span>
          </label>
        </div>
        {followUpRequired && (
          <div className="form-group">
            <label className="form-label">Follow-up Date</label>
            <Controller name="followUpDate" control={control}
              render={({ field }) => (
                <DatePicker
                  style={{ maxWidth: 220, width: '100%' }}
                  format="DD MMM YYYY"
                  placeholder="Select follow-up date"
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                  getPopupContainer={() => document.body}
                />
              )}
            />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Outcome</label>
          <textarea className="form-control" rows={2} {...register('outcome')} placeholder="Result of the visit (optional)" style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Remarks</label>
          <textarea className="form-control" rows={2} {...register('remarks')} placeholder="Any internal notes" style={{ resize: 'vertical' }} />
        </div>
      </form>
    </Modal>
  );
}

// ── Detail Modal (with visitor history) ─────────────────────────────────────────
function VisitDetailModal({ id, onClose, onEdit, onCheckout, onCompleteFollowUp }) {
  const { data, isLoading } = useQuery({ queryKey: ['visit', id], queryFn: () => api.get(`/visits/${id}`) });
  const v = data?.visit;
  const history = data?.history || [];

  const rows = v ? [
    { label: 'Phone', value: v.phone, icon: Phone },
    { label: 'Email', value: v.email || '—', icon: Mail },
    { label: 'Visitors', value: v.numberOfVisitors },
    { label: 'Purpose', value: PURPOSE_META[v.purpose]?.label },
    { label: 'Reason', value: v.purposeDetail || '—', full: true },
    { label: 'Related Student', value: v.relatedStudent ? `${v.relatedStudent.name}${v.relatedStudent.admissionNumber ? ` (${v.relatedStudent.admissionNumber})` : ''}` : '—' },
    { label: 'Attended By', value: v.attendedBy?.name || '—' },
    { label: 'Check-in', value: v.checkInTime ? format(new Date(v.checkInTime), 'dd MMM yyyy, hh:mm a') : '—' },
    { label: 'Check-out', value: v.checkOutTime ? format(new Date(v.checkOutTime), 'dd MMM yyyy, hh:mm a') : '—' },
    { label: 'Follow-up', value: !v.followUpRequired ? 'No'
        : v.followUpCompleted ? `Completed${v.followUpCompletedAt ? ` · ${format(new Date(v.followUpCompletedAt), 'dd MMM yyyy')}` : ''}`
        : `Pending${v.followUpDate ? ` · ${format(new Date(v.followUpDate), 'dd MMM yyyy')}` : ''}` },
    { label: 'Outcome', value: v.outcome || '—', full: true },
    { label: 'Remarks', value: v.remarks || '—', full: true },
  ] : [];

  return (
    <Modal open onClose={onClose} title="Visit Details" size="lg"
      footer={v ? <>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {v.followUpRequired && !v.followUpCompleted && v.status !== 'cancelled' && (
          <button className="btn btn-secondary" style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }} onClick={() => onCompleteFollowUp(v)}>
            <BellRing size={14} /> Complete Follow-up
          </button>
        )}
        {v.status !== 'completed' && v.status !== 'cancelled' && (
          <button className="btn btn-secondary" onClick={() => onCheckout(v)}><LogOut size={14} /> Check Out</button>
        )}
        <button className="btn btn-primary" onClick={() => onEdit(v)}>Edit</button>
      </> : null}>
      {isLoading || !v ? <PageLoader /> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{v.visitorName}</h3>
            <Pill meta={PURPOSE_META[v.purpose]} />
            <Pill meta={STATUS_META[v.status]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {rows.map(({ label, value, full }) => (
              <div key={label} style={full ? { gridColumn: '1 / -1' } : {}}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 500 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>{value}</p>
              </div>
            ))}
          </div>

          {history.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Previous visits from {v.phone}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(h => (
                  <div key={h._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Pill meta={PURPOSE_META[h.purpose]} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.checkInTime ? format(new Date(h.checkInTime), 'dd MMM yyyy') : ''}</span>
                    </div>
                    <Pill meta={STATUS_META[h.status]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ── Check-out Modal ─────────────────────────────────────────────────────────────
function CheckoutModal({ visit, onClose, onConfirm, loading }) {
  const [outcome, setOutcome] = useState(visit.outcome || '');
  return (
    <Modal open onClose={onClose} title="Check Out Visitor"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-success" onClick={() => onConfirm(outcome)} disabled={loading}>
          {loading ? 'Saving...' : 'Confirm Check Out'}
        </button>
      </>}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
        Mark <strong>{visit.visitorName}</strong>'s visit as completed and record the check-out time.
      </p>
      <div className="form-group">
        <label className="form-label">Outcome (optional)</label>
        <textarea className="form-control" rows={3} value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="What was the result of this visit?" style={{ resize: 'vertical' }} />
      </div>
    </Modal>
  );
}

// ── Complete Follow-up Modal ────────────────────────────────────────────────────
function CompleteFollowUpModal({ visit, onClose, onConfirm, loading }) {
  const [outcome, setOutcome] = useState('');
  return (
    <Modal open onClose={onClose} title="Complete Follow-up"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-success" onClick={() => onConfirm(outcome)} disabled={loading || !outcome.trim()}>
          {loading ? 'Saving...' : 'Mark Completed'}
        </button>
      </>}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
        Record what happened on the follow-up with <strong>{visit.visitorName}</strong>
        {visit.followUpDate ? ` (due ${format(new Date(visit.followUpDate), 'dd MMM yyyy')})` : ''}. This marks the visit as completed.
      </p>
      <div className="form-group">
        <label className="form-label">Follow-up Outcome / Reason *</label>
        <textarea className="form-control" rows={3} value={outcome} onChange={e => setOutcome(e.target.value)}
          placeholder="e.g. Shared bus quote, parent will confirm next week" style={{ resize: 'vertical' }} autoFocus />
      </div>
    </Modal>
  );
}
