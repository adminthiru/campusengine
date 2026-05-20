import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Download, MessageSquare, Eye, CreditCard, IndianRupee, Trash2, Edit2, Users, User, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput, PageLoader, FormRow, EmptyState, StatCard, ColumnSelector, useColumnSelector } from '../../components/ui';

const FEE_COLS = [
  { key: 'academicYear', label: 'Academic Year' },
  { key: 'terms',        label: 'Terms' },
  { key: 'total',        label: 'Total (₹)' },
  { key: 'paid',         label: 'Paid (₹)' },
  { key: 'pending',      label: 'Pending (₹)' },
  { key: 'status',       label: 'Status' },
];

const emptyTerm = (name = '') => ({ name, feeBreakdown: [{ type: 'Tuition Fee', amount: '' }], discount: { amount: '', reason: '' } });

export default function Fees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState('individual');
  const [indivClassId, setIndivClassId] = useState('');
  const [termRows, setTermRows] = useState([emptyTerm('Term 1')]);
  const [showCollect, setShowCollect] = useState(null);
  const [viewFee, setViewFee] = useState(null);
  const [editFee, setEditFee] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null); // { feeId, paymentId, amount, termName }
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const feeTerms = schoolData?.school?.feeTerms || [];

  const { data, isLoading } = useQuery({
    queryKey: ['fees', page, statusFilter, classFilter],
    queryFn: () => api.get(`/fees?page=${page}&limit=20&status=${statusFilter}&classId=${classFilter}`)
  });
  const fees = data?.fees || [];
  const total = data?.total || 0;

  const { register, handleSubmit, reset } = useForm();

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/fees', d),
    onSuccess: () => { qc.invalidateQueries(['fees']); toast.success('Fee record created!'); setShowCreate(false); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const bulkMutation = useMutation({
    mutationFn: (d) => api.post('/fees/bulk', d),
    onSuccess: (res) => { qc.invalidateQueries(['fees']); toast.success(res.message || 'Fee records created!'); setShowCreate(false); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const { data: studentData } = useQuery({ queryKey: ['students-all'], queryFn: () => api.get('/students?limit=500&status=active') });
  const students = studentData?.students || [];

  const openCreateModal = () => {
    const rows = feeTerms.length > 0
      ? feeTerms.map(t => emptyTerm(t.name))
      : [emptyTerm('Term 1')];
    setTermRows(rows);
    reset();
    setCreateMode('individual');
    setIndivClassId('');
    setShowCreate(true);
  };

  const downloadReceipt = async (id) => {
    try {
      const res = await fetch(`/api/fees/${id}/receipt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'receipt.pdf'; a.click();
    } catch { toast.error('Failed'); }
  };

  const sendReminders = async () => {
    if (!selected.length) return toast.error('Select fee records first');
    try {
      const res = await api.post('/fees/send-reminder', { feeIds: selected });
      toast.success(res.message);
      setSelected([]);
    } catch { toast.error('Failed to send reminders'); }
  };

  const reverseMutation = useMutation({
    mutationFn: ({ feeId, paymentId }) => api.delete(`/fees/${feeId}/payment/${paymentId}`),
    onSuccess: (res) => {
      qc.invalidateQueries(['fees']);
      setViewFee(res.fee);
      toast.success('Payment reversed successfully');
      setReverseTarget(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed to reverse'); setReverseTarget(null); }
  });

  const deleteSelected = useMutation({
    mutationFn: async () => Promise.all(selected.map(id => api.delete(`/fees/${id}`))),
    onSuccess: () => { qc.invalidateQueries(['fees']); toast.success(`${selected.length} record${selected.length > 1 ? 's' : ''} deleted`); setSelected([]); setConfirmDelete(false); },
    onError: () => { toast.error('Failed to delete'); setConfirmDelete(false); }
  });

  // Term row helpers
  const updateTermName = (i, val) => setTermRows(r => r.map((t, idx) => idx === i ? { ...t, name: val } : t));
  const addTermRow = () => setTermRows(r => [...r, emptyTerm(`Term ${r.length + 1}`)]);
  const removeTermRow = (i) => setTermRows(r => r.filter((_, idx) => idx !== i));
  const addBreakdownItem = (i) => setTermRows(r => r.map((t, idx) => idx === i ? { ...t, feeBreakdown: [...t.feeBreakdown, { type: '', amount: '' }] } : t));
  const removeBreakdownItem = (ti, bi) => setTermRows(r => r.map((t, idx) => idx === ti ? { ...t, feeBreakdown: t.feeBreakdown.filter((_, bi2) => bi2 !== bi) } : t));
  const updateBreakdown = (ti, bi, field, val) => setTermRows(r => r.map((t, idx) => idx === ti ? { ...t, feeBreakdown: t.feeBreakdown.map((f, fi) => fi === bi ? { ...f, [field]: val } : f) } : t));
  const updateDiscount = (i, field, val) => setTermRows(r => r.map((t, idx) => idx === i ? { ...t, discount: { ...t.discount, [field]: val } } : t));

  const handleCreate = handleSubmit((formData) => {
    const terms = termRows.map(t => ({
      name: t.name,
      feeBreakdown: t.feeBreakdown.map(f => ({ type: f.type, amount: Number(f.amount) || 0 })),
      discount: { amount: Number(t.discount.amount) || 0, reason: t.discount.reason }
    }));
    if (!terms.length || terms.some(t => !t.name.trim())) return toast.error('All terms need a name');
    const payload = { ...formData, terms };
    createMode === 'class' ? bulkMutation.mutate(payload) : createMutation.mutate(payload);
  });

  const [visibleCols, setVisibleCols] = useColumnSelector('fees', FEE_COLS);
  const col = (key) => visibleCols.has(key);

  const totalPending = fees.reduce((s, f) => s + (f.pendingAmount || 0), 0);
  const totalCollected = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const isPending = createMutation.isPending || bulkMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fees</h1>
          <p className="page-subtitle">{total} fee records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={sendReminders}>
                <MessageSquare size={16} /> Send Reminder ({selected.length})
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Delete ({selected.length})
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Add Fee Record
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard title="Total Collected" value={`₹${totalCollected.toLocaleString('en-IN')}`} icon={IndianRupee} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Pending Amount" value={`₹${totalPending.toLocaleString('en-IN')}`} icon={IndianRupee} color="#ef4444" bg="#fef2f2" />
        <StatCard title="Total Records" value={total} icon={CreditCard} color="#1a56e8" bg="#eff6ff" />
      </div>

      <div className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['pending', 'partial', 'paid', 'overdue'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <ColumnSelector storageKey="fees" cols={FEE_COLS} visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={e => setSelected(e.target.checked ? fees.map(f => f._id) : [])} /></th>
                  <th>Student</th>
                  {col('academicYear') && <th>Year</th>}
                  {col('terms')        && <th>Terms</th>}
                  {col('total')        && <th>Total (₹)</th>}
                  {col('paid')         && <th>Paid (₹)</th>}
                  {col('pending')      && <th>Pending (₹)</th>}
                  {col('status')       && <th>Status</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fees.length === 0 && (
                  <tr><td colSpan={3 + FEE_COLS.filter(c => visibleCols.has(c.key)).length}>
                    <EmptyState icon={CreditCard} message="No fee records." />
                  </td></tr>
                )}
                {fees.map(fee => (
                  <tr key={fee._id}>
                    <td><input type="checkbox" checked={selected.includes(fee._id)} onChange={e => setSelected(p => e.target.checked ? [...p, fee._id] : p.filter(i => i !== fee._id))} /></td>
                    <td className="text-14-medium">
                      <div>{fee.student?.name}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{fee.student?.admissionNumber}</div>
                    </td>
                    {col('academicYear') && <td className="text-14-regular">{fee.academicYear}</td>}
                    {col('terms') && (
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(fee.terms || []).map(t => (
                            <span key={t.name} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 12, fontWeight: 600,
                              background: t.status === 'paid' ? '#dcfce7' : t.status === 'partial' ? '#fef9c3' : '#fee2e2',
                              color: t.status === 'paid' ? '#166534' : t.status === 'partial' ? '#92400e' : '#dc2626'
                            }}>{t.name}</span>
                          ))}
                        </div>
                      </td>
                    )}
                    {col('total')   && <td className="text-14-semibold">₹{(fee.netAmount || 0).toLocaleString('en-IN')}</td>}
                    {col('paid')    && <td className="text-14-medium" style={{ color: '#10b981' }}>₹{(fee.paidAmount || 0).toLocaleString('en-IN')}</td>}
                    {col('pending') && <td className="text-14-medium" style={{ color: fee.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>₹{(fee.pendingAmount || 0).toLocaleString('en-IN')}</td>}
                    {col('status')  && <td><StatusBadge status={fee.status} /></td>}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setViewFee(fee)} title="View details"><Eye size={14} /></button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditFee(fee)} title="Edit concession"><Edit2 size={14} /></button>
                        {fee.paidAmount > 0 && (
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadReceipt(fee._id)} title="Download receipt"><Download size={14} /></button>
                        )}
                        {fee.pendingAmount > 0 && (
                          <button className="btn btn-success btn-sm" onClick={() => setShowCollect(fee)} style={{ padding: '4px 12px', fontSize: 12 }}>Collect Fee</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Fee Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Fee Record" size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={isPending}>
            {isPending ? 'Creating...' : createMode === 'class' ? 'Assign to Class' : 'Create Record'}
          </button>
        </>}>
        <form onSubmit={e => e.preventDefault()}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, background: '#f1f5f9', borderRadius: 10 }}>
            {[{ key: 'individual', label: 'Individual Student', Icon: User }, { key: 'class', label: 'Entire Class', Icon: Users }].map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => setCreateMode(key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: createMode === key ? 600 : 400,
                  background: createMode === key ? 'white' : 'transparent',
                  color: createMode === key ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: createMode === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {createMode === 'individual' ? (
            <>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Class *</label>
                  <select className="form-control" value={indivClassId} onChange={e => { setIndivClassId(e.target.value); reset({ studentId: '', academicYear: '' }); }}>
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <input className="form-control" {...register('academicYear')} placeholder="Auto-detected if empty" />
                </div>
              </FormRow>
              <div className="form-group">
                <label className="form-label">Student *</label>
                <select className="form-control" {...register('studentId', { required: true })} disabled={!indivClassId}>
                  <option value="">{indivClassId ? 'Select student' : 'Select a class first'}</option>
                  {students
                    .filter(s => s.currentClass?._id === indivClassId || s.currentClass === indivClassId)
                    .map(s => <option key={s._id} value={s._id}>{s.name} ({s.admissionNumber})</option>)}
                </select>
              </div>
            </>
          ) : (
            <FormRow>
              <div className="form-group">
                <label className="form-label">Class *</label>
                <select className="form-control" {...register('classId', { required: true })}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Academic Year</label>
                <input className="form-control" {...register('academicYear')} placeholder="Auto-detected if empty" />
              </div>
            </FormRow>
          )}

          {/* Terms */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Fee Terms *</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addTermRow}>
                <Plus size={13} /> Add Term
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {termRows.map((term, ti) => {
                const termTotal = term.feeBreakdown.reduce((s, f) => s + (Number(f.amount) || 0), 0);
                const discAmt = createMode === 'individual' ? (Number(term.discount.amount) || 0) : 0;
                const net = Math.max(0, termTotal - discAmt);
                return (
                  <TermSection key={ti}
                    term={term} index={ti} net={net} termTotal={termTotal}
                    showDiscount={createMode === 'individual'}
                    canRemove={termRows.length > 1}
                    onNameChange={val => updateTermName(ti, val)}
                    onRemove={() => removeTermRow(ti)}
                    onAddItem={() => addBreakdownItem(ti)}
                    onRemoveItem={bi => removeBreakdownItem(ti, bi)}
                    onUpdateItem={(bi, field, val) => updateBreakdown(ti, bi, field, val)}
                    onDiscountChange={(field, val) => updateDiscount(ti, field, val)}
                  />
                );
              })}
            </div>

            {/* Grand total */}
            {termRows.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#eff6ff', borderRadius: 8, marginTop: 10 }}>
                <span className="text-14-semibold" style={{ color: 'var(--primary)' }}>Total (all terms)</span>
                <span className="text-16-bold" style={{ color: 'var(--primary)' }}>
                  ₹{termRows.reduce((s, t) => {
                    const sub = t.feeBreakdown.reduce((ss, f) => ss + (Number(f.amount) || 0), 0);
                    const disc = createMode === 'individual' ? (Number(t.discount.amount) || 0) : 0;
                    return s + Math.max(0, sub - disc);
                  }, 0).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Collect Payment Modal */}
      {showCollect && (
        <CollectPaymentModal
          fee={showCollect}
          onClose={() => setShowCollect(null)}
          onSuccess={() => { qc.invalidateQueries(['fees']); setShowCollect(null); }}
        />
      )}

      {/* Edit concession modal */}
      {editFee && (
        <EditFeeModal
          fee={editFee}
          onClose={() => setEditFee(null)}
          onSuccess={() => { qc.invalidateQueries(['fees']); setEditFee(null); }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Fee Records"
        message={`This will permanently delete ${selected.length} fee record${selected.length > 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteSelected.mutate()}
        onClose={() => setConfirmDelete(false)}
      />

      {/* View Fee Modal */}
      {viewFee && (
        <Modal open onClose={() => setViewFee(null)} title="Fee Details" size="lg">
          <div>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
              <div className="text-16-bold">{viewFee.student?.name}</div>
              <div className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{viewFee.academicYear}</div>
            </div>

            {/* Per-term breakdown */}
            {(viewFee.terms || []).map((t, i) => (
              <div key={i} style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-14-semibold">{t.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                    background: t.status === 'paid' ? '#dcfce7' : t.status === 'partial' ? '#fef9c3' : '#fee2e2',
                    color: t.status === 'paid' ? '#166534' : t.status === 'partial' ? '#92400e' : '#dc2626'
                  }}>{t.status}</span>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  {t.feeBreakdown?.map((f, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: j < t.feeBreakdown.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span className="text-13-regular">{f.type}</span>
                      <span className="text-13-medium">₹{(f.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {t.discount?.amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#16a34a' }}>
                      <span className="text-13-regular">Discount ({t.discount.reason})</span>
                      <span className="text-13-medium">−₹{t.discount.amount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                    <span className="text-13-semibold">Net: ₹{(t.netAmount || 0).toLocaleString('en-IN')}</span>
                    <span className="text-13-semibold" style={{ color: t.pendingAmount > 0 ? '#ef4444' : '#16a34a' }}>
                      Pending: ₹{(t.pendingAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <div style={{ flex: 1, background: '#f0fdf4', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div className="text-12-regular" style={{ color: '#16a34a' }}>Paid</div>
                <div className="text-16-bold" style={{ color: '#16a34a' }}>₹{(viewFee.paidAmount || 0).toLocaleString('en-IN')}</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div className="text-12-regular" style={{ color: '#dc2626' }}>Pending</div>
                <div className="text-16-bold" style={{ color: '#dc2626' }}>₹{(viewFee.pendingAmount || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Payment history */}
            {viewFee.payments?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="text-14-semibold" style={{ marginBottom: 8 }}>Payment History</div>
                {viewFee.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f8fafc', borderRadius: 6, marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <span className="text-13-regular">{new Date(p.date).toLocaleDateString('en-IN')} · {p.method}</span>
                      {p.termName && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#eff6ff', color: 'var(--primary)', fontWeight: 600 }}>{p.termName}</span>}
                      {p.receiptNumber && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>#{p.receiptNumber}</span>}
                    </div>
                    <span className="text-14-semibold">₹{p.amount.toLocaleString('en-IN')}</span>
                    <button
                      className="btn btn-sm btn-icon"
                      title="Reverse this payment"
                      onClick={() => setReverseTarget({ feeId: viewFee._id, paymentId: p._id, amount: p.amount, termName: p.termName })}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', flexShrink: 0 }}>
                      <RotateCcw size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Reverse payment confirmation — must render AFTER view modal to stack on top */}
      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse Payment"
        message={reverseTarget ? `Reverse payment of ₹${reverseTarget.amount.toLocaleString('en-IN')}${reverseTarget.termName ? ` for ${reverseTarget.termName}` : ''}? This will mark the amount as unpaid again.` : ''}
        confirmLabel="Reverse"
        danger
        onConfirm={() => reverseMutation.mutate({ feeId: reverseTarget.feeId, paymentId: reverseTarget.paymentId })}
        onClose={() => setReverseTarget(null)}
      />
    </div>
  );
}

// Collapsible term section inside create modal
function TermSection({ term, index, net, termTotal, showDiscount, canRemove, onNameChange, onRemove, onAddItem, onRemoveItem, onUpdateItem, onDiscountChange }) {
  const [open, setOpen] = useState(true);
  const discAmt = showDiscount ? (Number(term.discount.amount) || 0) : 0;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Term header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderBottom: open ? '1px solid var(--border)' : 'none' }}>
        <input
          className="form-control"
          style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, padding: '2px 0' }}
          value={term.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Term name"
        />
        <span className="text-13-regular" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          ₹{net.toLocaleString('en-IN')}
        </span>
        {canRemove && (
          <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={onRemove} title="Remove term">
            <Trash2 size={13} />
          </button>
        )}
        <button type="button" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>
          {/* Fee breakdown items */}
          <div style={{ marginBottom: 8 }}>
            {term.feeBreakdown.map((f, bi) => (
              <div key={bi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="form-control" value={f.type} onChange={e => onUpdateItem(bi, 'type', e.target.value)} placeholder="Fee type" style={{ flex: 1 }} />
                <input className="form-control" type="number" value={f.amount} onChange={e => onUpdateItem(bi, 'amount', e.target.value)} placeholder="Amount" style={{ width: 120 }} />
                {bi > 0 && (
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => onRemoveItem(bi)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onAddItem} style={{ marginTop: 2 }}>
              <Plus size={13} /> Add Item
            </button>
          </div>

          {/* Discount row — individual mode only */}
          {showDiscount && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Discount (₹)</label>
                <input className="form-control" type="number" min={0} value={term.discount.amount} onChange={e => onDiscountChange('amount', e.target.value)} placeholder="0" />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Discount Reason</label>
                <input className="form-control" value={term.discount.reason} onChange={e => onDiscountChange('reason', e.target.value)} placeholder="e.g. Sibling concession" />
              </div>
            </div>
          )}

          {/* Term subtotal */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Subtotal: ₹{termTotal.toLocaleString('en-IN')}</span>
            {discAmt > 0 && <span style={{ color: '#16a34a', marginLeft: 8 }}>−₹{discAmt.toLocaleString('en-IN')}</span>}
            <span style={{ fontWeight: 700, marginLeft: 8, color: 'var(--primary)' }}>= ₹{net.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectPaymentModal({ fee, onClose, onSuccess }) {
  const pendingTerms = (fee.terms || []).filter(t => t.pendingAmount > 0);
  const [selectedTerm, setSelectedTerm] = useState(pendingTerms.length === 1 ? pendingTerms[0].name : 'all');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const autoAmount = selectedTerm === 'all'
    ? pendingTerms.reduce((s, t) => s + t.pendingAmount, 0)
    : fee.terms?.find(t => t.name === selectedTerm)?.pendingAmount || 0;

  const handleCollect = async () => {
    setLoading(true);
    try {
      await api.post('/fees/collect', {
        feeId: fee._id,
        termName: selectedTerm === 'all' ? undefined : selectedTerm,
        amount: autoAmount,
        method
      });
      toast.success('Payment collected!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Collect Payment"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleCollect} disabled={loading || autoAmount <= 0}>
          {loading ? 'Processing...' : `✓ Collect ₹${autoAmount.toLocaleString('en-IN')}`}
        </button>
      </>}>
      <div style={{ marginBottom: 16 }}>
        <div className="text-14-semibold">{fee.student?.name}</div>
        <div className="text-13-regular" style={{ color: 'var(--text-muted)' }}>{fee.academicYear}</div>
      </div>

      {/* Term selector */}
      <div className="form-group">
        <label className="form-label">Select Payment For</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* All pending option */}
          {pendingTerms.length > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${selectedTerm === 'all' ? 'var(--primary)' : 'var(--border)'}`, background: selectedTerm === 'all' ? '#eff6ff' : 'white', cursor: 'pointer' }}>
              <input type="radio" name="term" checked={selectedTerm === 'all'} onChange={() => setSelectedTerm('all')} />
              <div style={{ flex: 1 }}>
                <div className="text-14-semibold" style={{ color: selectedTerm === 'all' ? 'var(--primary)' : undefined }}>Pay All Pending</div>
                <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{pendingTerms.map(t => t.name).join(' + ')}</div>
              </div>
              <span className="text-14-semibold" style={{ color: selectedTerm === 'all' ? 'var(--primary)' : undefined }}>
                ₹{pendingTerms.reduce((s, t) => s + t.pendingAmount, 0).toLocaleString('en-IN')}
              </span>
            </label>
          )}

          {/* Individual terms */}
          {pendingTerms.map(t => (
            <label key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${selectedTerm === t.name ? 'var(--primary)' : 'var(--border)'}`, background: selectedTerm === t.name ? '#eff6ff' : 'white', cursor: 'pointer' }}>
              <input type="radio" name="term" checked={selectedTerm === t.name} onChange={() => setSelectedTerm(t.name)} />
              <div style={{ flex: 1 }}>
                <div className="text-14-semibold" style={{ color: selectedTerm === t.name ? 'var(--primary)' : undefined }}>{t.name}</div>
                <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>
                  Net ₹{(t.netAmount || 0).toLocaleString('en-IN')} · Paid ₹{(t.paidAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <span className="text-14-semibold" style={{ color: selectedTerm === t.name ? 'var(--primary)' : '#ef4444' }}>
                ₹{t.pendingAmount.toLocaleString('en-IN')}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Payment Method</label>
        <select className="form-control" value={method} onChange={e => setMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
          <option value="online">Online (UPI/NEFT)</option>
        </select>
      </div>
    </Modal>
  );
}

function EditFeeModal({ fee, onClose, onSuccess }) {
  const [termIdx, setTermIdx] = useState(0);
  const [discounts, setDiscounts] = useState(
    (fee.terms || []).map(t => ({ amount: t.discount?.amount || 0, reason: t.discount?.reason || '' }))
  );
  const [loading, setLoading] = useState(false);

  const term = fee.terms?.[termIdx];
  const disc = discounts[termIdx] || { amount: 0, reason: '' };
  const net = Math.max(0, (term?.totalAmount || 0) - (Number(disc.amount) || 0));

  const updateDisc = (field, val) => setDiscounts(d => d.map((item, i) => i === termIdx ? { ...item, [field]: val } : item));

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/fees/${fee._id}`, {
        termName: term?.name,
        discount: { amount: Number(disc.amount) || 0, reason: disc.reason }
      });
      toast.success('Concession updated!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit Concession"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </>}>
      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, marginBottom: 20 }}>
        <div className="text-14-semibold">{fee.student?.name}</div>
        <div className="text-13-regular" style={{ color: 'var(--text-secondary)' }}>{fee.academicYear}</div>
      </div>

      {/* Term tabs (if multiple) */}
      {(fee.terms || []).length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {fee.terms.map((t, i) => (
            <button key={t.name} type="button" onClick={() => setTermIdx(i)}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${termIdx === i ? 'var(--primary)' : 'var(--border)'}`, background: termIdx === i ? '#eff6ff' : 'white', color: termIdx === i ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: termIdx === i ? 600 : 400 }}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {term && (
        <>
          {/* Breakdown read-only */}
          <div style={{ marginBottom: 16 }}>
            {term.feeBreakdown?.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span className="text-14-regular">{f.type}</span>
                <span className="text-14-medium">₹{(f.amount || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontWeight: 600 }}>
              <span>Subtotal</span>
              <span>₹{(term.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Concession inputs */}
          <div style={{ padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, marginBottom: 16 }}>
            <div className="text-14-semibold" style={{ color: '#92400e', marginBottom: 12 }}>Concession / Discount</div>
            <FormRow>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Discount Amount (₹)</label>
                <input className="form-control" type="number" min={0} max={term.totalAmount}
                  value={disc.amount} onChange={e => updateDisc('amount', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason</label>
                <input className="form-control" value={disc.reason}
                  onChange={e => updateDisc('reason', e.target.value)}
                  placeholder="e.g. Sibling concession, Merit" />
              </div>
            </FormRow>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#eff6ff', borderRadius: 10 }}>
            <span className="text-14-semibold">Net Payable ({term.name})</span>
            <span className="text-16-bold" style={{ color: 'var(--primary)' }}>₹{net.toLocaleString('en-IN')}</span>
          </div>
        </>
      )}
    </Modal>
  );
}
