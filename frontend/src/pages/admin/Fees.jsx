import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Select as AntSelect, Dropdown } from 'antd';
import { Plus, Download, MessageSquare, CreditCard, IndianRupee, Trash2, Edit2, Users, User, RotateCcw, Tag, RefreshCw, X, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useYear } from '../../store/YearContext';
import { Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput, PageLoader, FormRow, EmptyState, StatCard, ColumnSelector, useColumnSelector } from '../../components/ui';

const FEE_COLS = [
  { key: 'mobile',       label: 'Mobile' },
  { key: 'academicYear', label: 'Academic Year' },
  { key: 'terms',        label: 'Terms' },
  { key: 'total',        label: 'Total (₹)' },
  { key: 'paid',         label: 'Paid (₹)' },
  { key: 'pending',      label: 'Pending (₹)' },
  { key: 'status',       label: 'Status' },
];

const emptyItem = () => ({ type: '', amount: '' });

// Class label for the row: show the class the student was in DURING the fee's
// academic year (from classHistory), not their current class — a promoted
// student's currentClass reflects only their latest year.
const classLabelForYear = (student, academicYear) => {
  const h = (student?.classHistory || []).find(x => x.academicYear === academicYear);
  if (h?.className) return `${h.className}${h.section ? ' - ' + h.section : ''}`;
  const c = student?.currentClass;
  return c?.name ? `${c.name}${c.section ? ' - ' + c.section : ''}` : '—';
};

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online (UPI/NEFT)' },
];

export default function Fees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [feeItems, setFeeItems] = useState([{ type: 'Tuition Fee', amount: '' }]);
  const [showCollect, setShowCollect] = useState(null);
  const [viewFee, setViewFee] = useState(null);
  const [editFee, setEditFee] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null); // { feeId, paymentId, amount, termName }
  const [clearDiscTarget, setClearDiscTarget] = useState(null); // { feeId, termName, amount }
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [arrearOnly, setArrearOnly] = useState(false);
  const [arrearTarget, setArrearTarget] = useState(null); // student for the arrear popup

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const feeTerms = schoolData?.school?.feeTerms || [];

  const { selectedYear } = useYear();

  const { data, isLoading } = useQuery({
    queryKey: ['fees', page, statusFilter, classFilter, search, selectedYear, arrearOnly],
    queryFn: () => api.get(`/fees?page=${page}&limit=20&status=${statusFilter}&classId=${classFilter}&search=${encodeURIComponent(search)}&academicYear=${encodeURIComponent(selectedYear)}${arrearOnly ? '&arrearOnly=true' : ''}`)
  });
  const fees = data?.fees || [];
  const total = data?.total || 0;

  // Map of studentId → prior-year arrear info { total, years }. Drives the
  // "Collect Arrear" button per row and the arrear filter chip.
  const { data: arrearsData } = useQuery({
    queryKey: ['fees-arrears-summary', selectedYear],
    queryFn: () => api.get(`/fees/arrears-summary?academicYear=${encodeURIComponent(selectedYear)}`),
  });
  const arrearsMap = arrearsData?.arrears || {};

  // Amount collected per payment method (across all matching records).
  const [methodFilter, setMethodFilter] = useState('all');
  const { data: paySummary } = useQuery({
    queryKey: ['fees-payment-summary', statusFilter, classFilter, search, selectedYear],
    queryFn: () => api.get(`/fees/payment-summary?status=${statusFilter}&classId=${classFilter}&search=${encodeURIComponent(search)}&academicYear=${encodeURIComponent(selectedYear)}`),
  });
  const methodTotals = paySummary?.methods || { cash: 0, bank_transfer: 0, cheque: 0, online: 0 };
  const collectedAllMethods = paySummary?.total || 0;
  const methodValue = methodFilter === 'all' ? collectedAllMethods : (methodTotals[methodFilter] || 0);

  const { register, handleSubmit, reset, control, watch } = useForm();
  const selectedClassId = watch('classId');
  const [hasExisting, setHasExisting] = useState(false);

  // Students in classes with a fee structure who don't yet have a record.
  const { data: unsyncedData } = useQuery({
    queryKey: ['fees-unsynced', selectedYear],
    queryFn: () => api.get(`/fees/unsynced-count?academicYear=${encodeURIComponent(selectedYear)}`),
  });
  const unsyncedCount = unsyncedData?.count || 0;

  const syncMutation = useMutation({
    mutationFn: () => api.post('/fees/sync', { academicYear: selectedYear }),
    onSuccess: (res) => { qc.invalidateQueries(['fees']); qc.invalidateQueries(['fees-unsynced']); toast.success(res.message || 'Students synced'); },
    onError: (err) => toast.error(err.message || 'Failed to sync'),
  });

  // Upsert a class fee structure: creates records for students without one and
  // updates existing — the unified add/edit save.
  const applyMutation = useMutation({
    mutationFn: (d) => api.post('/fees/apply-structure', d),
    onSuccess: (res) => { qc.invalidateQueries(['fees']); qc.invalidateQueries(['fees-unsynced']); toast.success(res.message || 'Fee structure saved'); setShowCreate(false); },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  // Load the selected class's existing fee structure into the editor (edit mode).
  const { data: structurePreview } = useQuery({
    queryKey: ['fee-structure-preview', selectedClassId, selectedYear],
    enabled: showCreate && !!selectedClassId,
    queryFn: () => api.get(`/fees?classId=${selectedClassId}&academicYear=${encodeURIComponent(selectedYear)}&limit=1`),
  });
  useEffect(() => {
    if (!showCreate || !selectedClassId) return;
    const rec = structurePreview?.fees?.[0];
    if (rec?.terms?.length) {
      setFeeItems(rec.terms.map(t => ({ type: t.name, amount: (t.feeBreakdown || []).reduce((s, f) => s + (f.amount || 0), 0) || t.totalAmount || '' })));
      setHasExisting(true);
    } else {
      setHasExisting(false);
    }
  }, [structurePreview, selectedClassId, showCreate]);

  const openCreateModal = () => {
    const items = feeTerms.length > 0
      ? feeTerms.map(t => ({ type: t.name, amount: '' }))
      : [{ type: 'Tuition Fee', amount: '' }];
    setFeeItems(items);
    setHasExisting(false);
    reset();
    setShowCreate(true);
  };

  const downloadReceipt = async (id) => {
    try {
      const res = await fetch(`/api/fees/${id}/receipt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'receipt.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const [reportLoading, setReportLoading] = useState(false);

  const downloadReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (classFilter) params.append('classId', classFilter);
      if (statusFilter) params.append('status', statusFilter);
      const res = await fetch(`/api/fees/report?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fees_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Fees report downloaded');
    } catch { toast.error('Failed to download report'); }
    finally { setReportLoading(false); }
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

  const clearDiscMutation = useMutation({
    mutationFn: ({ feeId, termName }) => api.post(`/fees/${feeId}/clear-discount`, { termName }),
    onSuccess: (res) => {
      qc.invalidateQueries(['fees']);
      setViewFee(res.fee);
      toast.success('Discount removed');
      setClearDiscTarget(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed to remove discount'); setClearDiscTarget(null); }
  });

  const deleteSelected = useMutation({
    mutationFn: async () => Promise.all(selected.map(id => api.delete(`/fees/${id}`))),
    onSuccess: () => { qc.invalidateQueries(['fees']); toast.success(`${selected.length} record${selected.length > 1 ? 's' : ''} deleted`); setSelected([]); setConfirmDelete(false); },
    onError: () => { toast.error('Failed to delete'); setConfirmDelete(false); }
  });

  const handleCreate = handleSubmit((formData) => {
    if (!formData.classId) return toast.error('Select a class');
    if (!feeItems.length || feeItems.some(f => !f.type.trim())) return toast.error('All categories need a name');
    const terms = feeItems.map(f => ({
      name: f.type,
      feeBreakdown: [{ type: f.type, amount: Number(f.amount) || 0 }]
    }));
    applyMutation.mutate({ classId: formData.classId, academicYear: (formData.academicYear || '').trim() || selectedYear, terms });
  });

  const [visibleCols, setVisibleCols] = useColumnSelector('fees', FEE_COLS);
  const col = (key) => visibleCols.has(key);

  const totalPending = fees.reduce((s, f) => s + (f.pendingAmount || 0), 0);
  const totalCollected = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const totalDiscount = fees.reduce((s, f) => s + (f.terms || []).reduce((ts, t) => ts + (t.discount?.amount || 0), 0), 0);
  const isPending = applyMutation.isPending;

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
          {unsyncedCount > 0 && (
            <button className="btn btn-secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw size={16} /> {syncMutation.isPending ? 'Syncing…' : `Sync Students (${unsyncedCount})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Add / Edit Fee Record
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total Collected" value={`₹${totalCollected.toLocaleString('en-IN')}`} icon={IndianRupee} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Pending Amount" value={`₹${totalPending.toLocaleString('en-IN')}`} icon={IndianRupee} color="#ef4444" bg="#fef2f2" />
        <StatCard title="Total Discount" value={`₹${totalDiscount.toLocaleString('en-IN')}`} icon={Tag} color="#f59e0b" bg="#fffbeb" />
        <div className="stat-card">
          <div>
            {/* Title doubles as the method picker — click to choose a method */}
            <Dropdown
              trigger={['click']}
              menu={{
                selectable: true,
                selectedKeys: [methodFilter],
                onClick: ({ key }) => setMethodFilter(key),
                items: [
                  { key: 'all', label: 'All Methods' },
                  ...PAYMENT_METHODS.map(m => ({ key: m.value, label: `${m.label} · ₹${(methodTotals[m.value] || 0).toLocaleString('en-IN')}` })),
                ],
              }}
            >
              <span className="text-14-regular" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                {methodFilter === 'all' ? 'Collected (All Methods)' : `Collected · ${PAYMENT_METHODS.find(m => m.value === methodFilter)?.label}`}
                <ChevronDown size={14} />
              </span>
            </Dropdown>
            <div className="text-24-bold" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', marginTop: 4 }}>
              ₹{methodValue.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eff6ff' }}>
            <CreditCard size={22} color="#1a56e8" />
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div style={{ minWidth: 260 }}>
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by student name or admission no..." />
        </div>
        <button
          className={`btn btn-sm ${arrearOnly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setArrearOnly(v => !v); setPage(1); }}
          style={arrearOnly ? undefined : { color: '#b45309', borderColor: '#fcd34d' }}
          title="Show only students carrying fees from previous years"
        >
          <AlertTriangle size={14} /> Arrears
        </button>
        <AntSelect
          style={{ minWidth: 160 }}
          value={classFilter || undefined}
          placeholder="All Classes"
          allowClear
          showSearch
          optionFilterProp="label"
          onChange={val => { setClassFilter(val ?? ''); setPage(1); }}
          options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
        />
        <AntSelect
          style={{ minWidth: 140 }}
          value={statusFilter || undefined}
          placeholder="All Status"
          allowClear
          onChange={val => setStatusFilter(val ?? '')}
          options={['pending','partial','paid','overdue'].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
        />
        <ColumnSelector storageKey="fees" cols={FEE_COLS} visible={visibleCols} onChange={setVisibleCols} />
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={downloadReport} disabled={reportLoading}>
            <Download size={15} /> {reportLoading ? 'Preparing…' : 'Download Report'}
          </button>
        </div>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={e => setSelected(e.target.checked ? fees.map(f => f._id) : [])} /></th>
                  <th>Student</th>
                  {col('mobile')       && <th>Mobile</th>}
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
                  <tr key={fee._id} onClick={() => setViewFee(fee)} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(fee._id)} onChange={e => setSelected(p => e.target.checked ? [...p, fee._id] : p.filter(i => i !== fee._id))} /></td>
                    <td className="text-14-medium">
                      <div>{fee.student?.name}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{classLabelForYear(fee.student, fee.academicYear)}</div>
                    </td>
                    {col('mobile') && <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{fee.student?.phone || '—'}</td>}
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
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditFee(fee)} title="Edit fee structure"><Edit2 size={14} /></button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadReceipt(fee._id)} title={fee.paidAmount > 0 ? 'Download receipt' : 'Download fee statement'}><Download size={14} /></button>
                        {fee.pendingAmount > 0 && (
                          <button className="btn btn-success btn-sm" onClick={() => setShowCollect(fee)} style={{ padding: '4px 12px', fontSize: 12 }}>Collect Fee</button>
                        )}
                        {arrearsMap[fee.student?._id] && (
                          <button className="btn btn-sm" onClick={() => setArrearTarget(fee.student)}
                            style={{ padding: '4px 12px', fontSize: 12, background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', fontWeight: 600, whiteSpace: 'nowrap' }}
                            title={`Arrears from ${arrearsMap[fee.student._id].years} previous year(s): ₹${(arrearsMap[fee.student._id].total || 0).toLocaleString('en-IN')}`}>
                            <AlertTriangle size={13} /> Collect Arrear
                          </button>
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

      {/* Add / Edit Fee Record — selecting a class loads its existing structure */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add / Edit Fee Record" size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={isPending}>
            {isPending ? 'Saving…' : hasExisting ? 'Update Class Fees' : 'Assign to Class'}
          </button>
        </>}>
        <form onSubmit={e => e.preventDefault()}>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Class *</label>
              <Controller
                name="classId"
                control={control}
                render={({ field }) => (
                  <AntSelect
                    {...field}
                    style={{ width: '100%' }}
                    placeholder="Select class"
                    showSearch
                    optionFilterProp="label"
                    options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
                  />
                )}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <input className="form-control" {...register('academicYear')} placeholder="Auto-detected if empty" />
            </div>
          </FormRow>

          {hasExisting && (
            <div style={{ fontSize: 12.5, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              This class already has a fee structure — saving updates existing records and creates records for any new students.
            </div>
          )}

          {/* Fee Categories */}
          <div style={{ marginTop: 4 }}>
            <label className="form-label">Fee Categories *</label>
            <FeeItemsEditor items={feeItems} onChange={setFeeItems} />
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

      {/* Collect Arrear Modal — prior-year pending fees, class-wise */}
      {arrearTarget && (
        <ArrearModal
          student={arrearTarget}
          beforeYear={selectedYear}
          onClose={() => setArrearTarget(null)}
          onSuccess={() => { qc.invalidateQueries(['fees']); qc.invalidateQueries(['fees-arrears-summary']); qc.invalidateQueries(['fees-payment-summary']); }}
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
            {/* Header strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #1a56e8 0%, #3b82f6 100%)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{viewFee.student?.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  {viewFee.student?.admissionNumber} · {viewFee.academicYear}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Total', val: viewFee.netAmount, color: 'rgba(255,255,255,0.95)' },
                  { label: 'Paid', val: viewFee.paidAmount, color: '#86efac' },
                  { label: 'Pending', val: viewFee.pendingAmount, color: viewFee.pendingAmount > 0 ? '#fca5a5' : '#86efac' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', minWidth: 72 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>₹{(val || 0).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee terms table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Net</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th style={{ textAlign: 'right' }}>Pending</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewFee.terms || []).map((t, i) => {
                      const lastPayment =
                        (viewFee.payments || []).filter(p => p.termName === t.name).slice(-1)[0] ||
                        (viewFee.payments || []).filter(p => !p.termName).slice(-1)[0];
                      return (
                        <tr key={i}>
                          <td className="text-14-medium">{t.name}</td>
                          <td className="text-14-regular" style={{ textAlign: 'right' }}>₹{(t.totalAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="text-13-regular" style={{ textAlign: 'right', color: t.discount?.amount > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                            {t.discount?.amount > 0 ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                <span>−₹{t.discount.amount.toLocaleString('en-IN')}</span>
                                <button title="Remove this discount"
                                  onClick={() => setClearDiscTarget({ feeId: viewFee._id, termName: t.name, amount: t.discount.amount })}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', padding: 0 }}>
                                  <X size={11} />
                                </button>
                              </div>
                            ) : '—'}
                            {t.discount?.amount > 0 && t.discount?.reason && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2, fontStyle: 'italic' }}>
                                {t.discount.reason}
                              </div>
                            )}
                          </td>
                          <td className="text-14-semibold" style={{ textAlign: 'right' }}>₹{(t.netAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="text-14-medium" style={{ textAlign: 'right', color: '#10b981' }}>₹{(t.paidAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="text-14-medium" style={{ textAlign: 'right', color: t.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>₹{(t.pendingAmount || 0).toLocaleString('en-IN')}</td>
                          <td>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                              background: t.status === 'paid' ? '#dcfce7' : t.status === 'partial' ? '#fef9c3' : '#fee2e2',
                              color: t.status === 'paid' ? '#166534' : t.status === 'partial' ? '#92400e' : '#dc2626'
                            }}>{t.status}</span>
                          </td>
                          <td>
                            {t.paidAmount > 0 && lastPayment && (
                              <button className="btn btn-sm btn-icon" title="Reverse last payment for this term"
                                onClick={() => setReverseTarget({ feeId: viewFee._id, paymentId: lastPayment._id, amount: lastPayment.amount, termName: t.name })}
                                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr style={{ background: '#f8fafc' }}>
                      <td className="text-14-semibold">Total</td>
                      <td className="text-14-semibold" style={{ textAlign: 'right' }}>₹{(viewFee.totalAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="text-13-regular" style={{ textAlign: 'right', color: '#16a34a' }}>
                        {(viewFee.terms || []).reduce((s, t) => s + (t.discount?.amount || 0), 0) > 0
                          ? `−₹${(viewFee.terms || []).reduce((s, t) => s + (t.discount?.amount || 0), 0).toLocaleString('en-IN')}`
                          : '—'}
                      </td>
                      <td className="text-14-semibold" style={{ textAlign: 'right' }}>₹{(viewFee.netAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="text-14-semibold" style={{ textAlign: 'right', color: '#10b981' }}>₹{(viewFee.paidAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="text-14-semibold" style={{ textAlign: 'right', color: viewFee.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>₹{(viewFee.pendingAmount || 0).toLocaleString('en-IN')}</td>
                      <td><StatusBadge status={viewFee.status} /></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

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

      {/* Clear / remove a term discount */}
      <ConfirmDialog
        open={!!clearDiscTarget}
        title="Remove Discount"
        message={clearDiscTarget ? `Remove the ₹${clearDiscTarget.amount.toLocaleString('en-IN')} discount on ${clearDiscTarget.termName}? The term's net amount and pending will be recalculated.` : ''}
        confirmLabel="Remove"
        danger
        onConfirm={() => clearDiscMutation.mutate({ feeId: clearDiscTarget.feeId, termName: clearDiscTarget.termName })}
        onClose={() => setClearDiscTarget(null)}
      />
    </div>
  );
}

// Shared flat fee items editor used in create, class edit, and per-student edit
function FeeItemsEditor({ items, onChange, readonlyTypes = false }) {
  const add = () => onChange([...items, emptyItem()]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const total = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="form-control"
              value={item.type}
              onChange={e => update(i, 'type', e.target.value)}
              placeholder="Category name (e.g. Tuition Fee, Exam Fee)"
              style={{ flex: 1 }}
              readOnly={readonlyTypes}
            />
            <input
              className="form-control"
              type="number"
              min={0}
              value={item.amount}
              onChange={e => update(i, 'amount', e.target.value)}
              placeholder="Amount (₹)"
              style={{ width: 140 }}
            />
            {!readonlyTypes && items.length > 1 && (
              <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => remove(i)}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        {!readonlyTypes ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
            <Plus size={13} /> Add Item
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total:</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
            ₹{total.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </div>
  );
}

// Collect arrears: prior-year pending fees shown class/year-wise. Each year can
// be collected independently (amount distributed across that year's pending
// terms by the backend's "pay all" logic).
function ArrearModal({ student, beforeYear, onClose, onSuccess }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['student-arrears', student._id, beforeYear],
    queryFn: () => api.get(`/fees/arrears/${student._id}?beforeYear=${encodeURIComponent(beforeYear)}`),
  });
  const items = data?.items || [];
  const grandTotal = data?.total || 0;

  // Per-year input state keyed by feeId: { amount, method, discount, reason }
  const [inputs, setInputs] = useState({});
  const [busyId, setBusyId] = useState(null);

  const getInput = (it) => inputs[it.feeId] || { amount: String(it.pendingAmount), method: 'cash', discount: '', reason: '' };
  const setInput = (feeId, patch) => setInputs(p => ({ ...p, [feeId]: { ...(p[feeId] || {}), ...patch } }));

  // Changing the discount auto-adjusts the amount to settle the remaining balance.
  const setDiscount = (it, val) => {
    const disc = Math.max(0, parseFloat(val) || 0);
    setInput(it.feeId, { discount: val, amount: String(Math.max(0, it.pendingAmount - disc)) });
  };

  const collectYear = async (it) => {
    const inp = getInput(it);
    const amt = Math.max(0, parseFloat(inp.amount) || 0);
    const disc = Math.max(0, parseFloat(inp.discount) || 0);
    if (disc > it.pendingAmount) return toast.error(`Discount cannot exceed ₹${it.pendingAmount.toLocaleString('en-IN')}`);
    if (amt <= 0 && disc <= 0) return toast.error('Enter an amount or a discount');
    if (amt > it.pendingAmount - disc) return toast.error(`Amount + discount cannot exceed ₹${it.pendingAmount.toLocaleString('en-IN')}`);
    // Distribute the discount across this year's pending terms, in order.
    const discList = [];
    let remaining = disc;
    for (const t of it.terms) {
      if (remaining <= 0) break;
      const give = Math.min(remaining, t.pendingAmount);
      if (give > 0) discList.push({ termName: t.name, amount: give, reason: inp.reason || '' });
      remaining -= give;
    }
    setBusyId(it.feeId);
    try {
      await api.post('/fees/collect', { feeId: it.feeId, amount: amt, method: inp.method || 'cash', discounts: discList });
      toast.success(amt > 0
        ? `₹${amt.toLocaleString('en-IN')} collected for ${it.className || it.academicYear}${disc > 0 ? ` (₹${disc.toLocaleString('en-IN')} discount)` : ''}`
        : `₹${disc.toLocaleString('en-IN')} discount applied for ${it.className || it.academicYear}`);
      qc.invalidateQueries(['student-arrears', student._id, beforeYear]);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Failed to collect');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open onClose={onClose} title="Collect Arrears" size="lg"
      footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}>
      <div style={{ marginBottom: 14 }}>
        <div className="text-14-semibold">{data?.student?.name || student.name}</div>
        <div className="text-13-regular" style={{ color: 'var(--text-muted)' }}>
          {data?.student?.admissionNumber || student.admissionNumber} · Pending from previous years
        </div>
      </div>

      {isLoading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon={CreditCard} message="No arrears found." />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <span className="text-13-medium" style={{ color: '#92400e' }}>Total Arrears</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#b45309' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(it => {
              const inp = getInput(it);
              const amt = Math.max(0, parseFloat(inp.amount) || 0);
              const disc = Math.max(0, parseFloat(inp.discount) || 0);
              return (
                <div key={it.feeId} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div className="text-14-semibold">{it.className || '—'}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{it.academicYear}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>₹{it.pendingAmount.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <div style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {it.terms.map(t => (
                        <span key={t.name} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626' }}>
                          {t.name}: ₹{t.pendingAmount.toLocaleString('en-IN')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Amount (₹)</div>
                        <input className="form-control no-spinner" type="number" min={0} max={it.pendingAmount}
                          value={inp.amount} onWheel={e => e.currentTarget.blur()}
                          onChange={e => setInput(it.feeId, { amount: e.target.value })}
                          style={{ textAlign: 'right', fontWeight: 600 }} />
                      </div>
                      <div style={{ width: 120 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Discount (₹)</div>
                        <input className="form-control no-spinner" type="number" min={0} max={it.pendingAmount}
                          value={inp.discount} onWheel={e => e.currentTarget.blur()}
                          onChange={e => setDiscount(it, e.target.value)}
                          placeholder="0" style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }} />
                      </div>
                      <div style={{ width: 140 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Method</div>
                        <AntSelect style={{ width: '100%' }} value={inp.method || 'cash'}
                          onChange={v => setInput(it.feeId, { method: v })}
                          options={PAYMENT_METHODS} />
                      </div>
                      <button className="btn btn-success" disabled={busyId === it.feeId || (amt <= 0 && disc <= 0) || amt > it.pendingAmount - disc}
                        onClick={() => collectYear(it)} style={{ whiteSpace: 'nowrap' }}>
                        {busyId === it.feeId ? '…' : amt > 0 ? `Collect ₹${amt.toLocaleString('en-IN')}` : 'Apply Discount'}
                      </button>
                    </div>
                    {disc > 0 && (
                      <input className="form-control" value={inp.reason || ''}
                        onChange={e => setInput(it.feeId, { reason: e.target.value })}
                        placeholder="Discount reason (optional)" style={{ marginTop: 8, fontSize: 13 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

function CollectPaymentModal({ fee, onClose, onSuccess }) {
  const pendingTerms = (fee.terms || []).filter(t => t.pendingAmount > 0);
  const [selectedTerm, setSelectedTerm] = useState(pendingTerms.length === 1 ? pendingTerms[0].name : 'all');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [discounts, setDiscounts] = useState({}); // { [termName]: { amount, reason } } — per category
  const [payAmount, setPayAmount] = useState(() => {
    if (pendingTerms.length === 1) return String(pendingTerms[0].pendingAmount);
    return String(pendingTerms.reduce((s, t) => s + t.pendingAmount, 0));
  });

  // "Pay All" discount — kept SEPARATE from the per-term discounts so it never
  // bleeds into the individual term rows. Distributed across terms only at submit.
  const [allDiscount, setAllDiscount] = useState('');
  const [allReason, setAllReason] = useState('');
  const allDiscNum = Math.max(0, Number(allDiscount) || 0);
  const sumPending = pendingTerms.reduce((s, t) => s + t.pendingAmount, 0);

  const discOf = (name, src = discounts) => Math.max(0, Number(src[name]?.amount) || 0);
  const effPending = (t, src = discounts) => Math.max(0, t.pendingAmount - discOf(t.name, src));
  const computeBase = (term, src = discounts, allD = allDiscNum) => term === 'all'
    ? Math.max(0, sumPending - allD)
    : effPending(fee.terms?.find(x => x.name === term) || { pendingAmount: 0, name: term }, src);
  const basePending = computeBase(selectedTerm);
  const maxAmount = basePending;
  const scopeDisc = selectedTerm === 'all' ? allDiscNum : discOf(selectedTerm);

  const handleSelectTerm = (val) => {
    setSelectedTerm(val);
    setPayAmount(String(computeBase(val)));
  };

  const setTermDiscount = (name, field, val) => {
    setDiscounts(prev => {
      const next = { ...prev, [name]: { ...prev[name], [field]: val } };
      // Only the per-term row drives the amount when that term is selected.
      if (field === 'amount' && selectedTerm === name) setPayAmount(String(computeBase(name, next)));
      return next;
    });
  };

  const setAllDiscountVal = (val) => {
    setAllDiscount(val);
    if (selectedTerm === 'all') setPayAmount(String(Math.max(0, sumPending - Math.max(0, Number(val) || 0))));
  };

  const enteredAmount = Math.max(0, parseFloat(payAmount) || 0);
  const isPartial = enteredAmount < maxAmount && enteredAmount > 0;
  const isValid = (enteredAmount > 0 || scopeDisc > 0) && enteredAmount <= maxAmount;

  const handleCollect = async () => {
    if (!isValid) return toast.error(`Enter an amount up to ₹${maxAmount.toLocaleString('en-IN')}`);
    setLoading(true);
    try {
      let discList = [];
      if (selectedTerm === 'all') {
        // Distribute the single "Pay All" discount across pending terms in order.
        let remaining = allDiscNum;
        for (const t of pendingTerms) {
          if (remaining <= 0) break;
          const give = Math.min(remaining, t.pendingAmount);
          if (give > 0) discList.push({ termName: t.name, amount: give, reason: allReason || '' });
          remaining -= give;
        }
      } else {
        const da = discOf(selectedTerm);
        if (da > 0) discList = [{ termName: selectedTerm, amount: da, reason: discounts[selectedTerm]?.reason || '' }];
      }
      await api.post('/fees/collect', {
        feeId: fee._id,
        termName: selectedTerm === 'all' ? undefined : selectedTerm,
        amount: enteredAmount,
        method,
        discounts: discList,
      });
      toast.success(enteredAmount > 0
        ? (isPartial ? `Partial payment of ₹${enteredAmount.toLocaleString('en-IN')} collected!` : 'Payment collected!')
        : 'Discount applied!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const renderAmountInput = (pendingAmt) => (
    <div style={{ padding: '10px 14px', borderTop: '1px solid #dbeafe', background: '#f0f7ff' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Amount to Collect (₹)</div>
          <input
            className="form-control no-spinner"
            type="number"
            min={1}
            max={pendingAmt}
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
            onWheel={e => e.currentTarget.blur()}
            style={{ fontSize: 15, fontWeight: 600, textAlign: 'right' }}
            placeholder={`Max ₹${pendingAmt.toLocaleString('en-IN')}`}
            autoFocus
          />
          {enteredAmount > pendingAmt && (
            <p style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>
              Cannot exceed ₹{pendingAmt.toLocaleString('en-IN')}
            </p>
          )}
        </div>
        {enteredAmount !== pendingAmt && (
          <button type="button"
            onClick={() => setPayAmount(String(pendingAmt))}
            style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--primary)', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Pay full ₹{pendingAmt.toLocaleString('en-IN')}
          </button>
        )}
      </div>
      {enteredAmount > 0 && enteredAmount <= pendingAmt && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, background: 'white', borderRadius: 8, padding: '6px 10px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Paying</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>₹{enteredAmount.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: 8, padding: '6px 10px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Balance After</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: pendingAmt - enteredAmount > 0 ? '#d97706' : '#16a34a' }}>
              ₹{(pendingAmt - enteredAmount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Collect Payment"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleCollect} disabled={loading || !isValid}>
          {loading ? 'Processing...' : enteredAmount > 0 ? `✓ Collect ₹${enteredAmount.toLocaleString('en-IN')}` : 'Apply Discount'}
        </button>
      </>}>
      <div style={{ marginBottom: 16 }}>
        <div className="text-14-semibold">{fee.student?.name}</div>
        <div className="text-13-regular" style={{ color: 'var(--text-muted)' }}>{fee.academicYear}</div>
      </div>

      <div className="form-group">
        <label className="form-label">Select Payment For</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Pay All option */}
          {pendingTerms.length > 1 && (
            <div style={{ border: `1.5px solid ${selectedTerm === 'all' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: selectedTerm === 'all' ? '#eff6ff' : 'white' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <input type="radio" name="term" checked={selectedTerm === 'all'} onChange={() => handleSelectTerm('all')} />
                <div style={{ flex: 1 }}>
                  <div className="text-14-semibold" style={{ color: selectedTerm === 'all' ? 'var(--primary)' : undefined }}>Pay All</div>
                  <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{pendingTerms.map(t => t.name).join(' + ')}</div>
                </div>
                <span className="text-14-semibold" style={{ color: selectedTerm === 'all' ? 'var(--primary)' : undefined }}>
                  ₹{computeBase('all').toLocaleString('en-IN')}
                </span>
              </label>
              {selectedTerm === 'all' && (
                <>
                  <div style={{ display: 'flex', gap: 8, padding: '8px 14px 10px', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Discount</span>
                    <input className="form-control no-spinner" type="number" min={0} value={allDiscount}
                      onChange={e => setAllDiscountVal(e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder="₹0" style={{ flex: 1, fontSize: 13 }} />
                    <input className="form-control" value={allReason}
                      onChange={e => setAllReason(e.target.value)} placeholder="Reason (e.g. Merit)" style={{ flex: 2, fontSize: 13 }} />
                  </div>
                  {allDiscNum > 0 && (
                    <div style={{ fontSize: 11, color: '#16a34a', padding: '4px 14px 0' }}>−₹{allDiscNum.toLocaleString('en-IN')} discount spread across terms</div>
                  )}
                  {renderAmountInput(computeBase('all'))}
                </>
              )}
            </div>
          )}

          {/* Individual terms — each with its own discount */}
          {pendingTerms.map(t => {
            const d = discOf(t.name);
            return (
            <div key={t.name} style={{ border: `1.5px solid ${selectedTerm === t.name ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: selectedTerm === t.name ? '#eff6ff' : 'white' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <input type="radio" name="term" checked={selectedTerm === t.name} onChange={() => handleSelectTerm(t.name)} />
                <div style={{ flex: 1 }}>
                  <div className="text-14-semibold" style={{ color: selectedTerm === t.name ? 'var(--primary)' : undefined }}>{t.name}</div>
                  <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>
                    Net ₹{(t.netAmount || 0).toLocaleString('en-IN')} · Paid ₹{(t.paidAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <span className="text-14-semibold" style={{ color: selectedTerm === t.name ? 'var(--primary)' : '#ef4444' }}>
                  ₹{effPending(t).toLocaleString('en-IN')}
                </span>
              </label>
              {/* Per-category discount */}
              <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Discount</span>
                <input className="form-control no-spinner" type="number" min={0} value={discounts[t.name]?.amount || ''}
                  onChange={e => setTermDiscount(t.name, 'amount', e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder="₹0" style={{ flex: 1, fontSize: 13 }} />
                <input className="form-control" value={discounts[t.name]?.reason || ''}
                  onChange={e => setTermDiscount(t.name, 'reason', e.target.value)} placeholder="Reason (e.g. Merit)" style={{ flex: 2, fontSize: 13 }} />
              </div>
              {d > 0 && (
                <div style={{ fontSize: 11, color: '#16a34a', padding: '0 14px 8px' }}>−₹{d.toLocaleString('en-IN')} discount · pending now ₹{effPending(t).toLocaleString('en-IN')}</div>
              )}
              {selectedTerm === t.name && renderAmountInput(effPending(t))}
            </div>
            );
          })}
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Payment Method</label>
        <AntSelect
          style={{ width: '100%' }}
          value={method}
          onChange={val => setMethod(val)}
          options={PAYMENT_METHODS}
        />
      </div>
    </Modal>
  );
}

function EditClassFeeModal({ classes, schoolFeeTerms, onClose, onSuccess }) {
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [feeItems, setFeeItems] = useState([{ type: 'Tuition Fee', amount: '' }]);

  const { data: existingData, isFetching } = useQuery({
    queryKey: ['fees-class-preview', classId],
    queryFn: () => api.get(`/fees?classId=${classId}&limit=1`),
    enabled: !!classId,
  });

  useEffect(() => {
    if (!classId || existingData === undefined) return;
    const sample = existingData?.fees?.[0];
    if (sample?.terms?.length) {
      if (sample.academicYear) setAcademicYear(sample.academicYear);
      setFeeItems(sample.terms.map(t => ({
        type: t.name,
        amount: String(t.feeBreakdown?.[0]?.amount ?? t.totalAmount ?? '')
      })));
    } else {
      setFeeItems(schoolFeeTerms.length > 0 ? schoolFeeTerms.map(t => ({ type: t.name, amount: '' })) : [{ type: 'Tuition Fee', amount: '' }]);
    }
  }, [existingData, classId]);

  const saveMutation = useMutation({
    mutationFn: (d) => api.put('/fees/class-structure', d),
    onSuccess: (res) => { toast.success(res.message || 'Fee structure updated!'); onSuccess(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const handleSave = () => {
    if (!classId) return toast.error('Select a class');
    if (!academicYear.trim()) return toast.error('Enter academic year');
    if (feeItems.some(f => !f.type.trim())) return toast.error('All categories need a name');
    const terms = feeItems.map(f => ({
      name: f.type,
      feeBreakdown: [{ type: f.type, amount: Number(f.amount) || 0 }]
    }));
    saveMutation.mutate({ classId, academicYear: academicYear.trim(), terms });
  };

  return (
    <Modal open onClose={onClose} title="Edit Fee Structure (Class)" size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending || !classId}>
          {saveMutation.isPending ? 'Saving...' : 'Update All Students in Class'}
        </button>
      </>}>
      <FormRow style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Class *</label>
          <AntSelect
            style={{ width: '100%' }}
            value={classId || undefined}
            placeholder="Select class"
            showSearch
            optionFilterProp="label"
            onChange={val => setClassId(val ?? '')}
            options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Academic Year *</label>
          <input className="form-control" value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="e.g. 2024-2025" />
        </div>
      </FormRow>

      {classId && isFetching && (
        <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: 'var(--text-muted)' }}>
          Loading existing fee structure…
        </div>
      )}
      {classId && !isFetching && existingData?.fees?.[0] && (
        <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#166534' }}>
          Loaded existing structure · {existingData.fees[0].academicYear}. Changes will apply to all students in this class.
        </div>
      )}
      {classId && !isFetching && existingData && !existingData?.fees?.[0] && (
        <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#92400e' }}>
          No fee records found for this class. Create fee records first using "Add Fee Record".
        </div>
      )}

      <label className="form-label">Fee Categories *</label>
      <FeeItemsEditor items={feeItems} onChange={setFeeItems} />
    </Modal>
  );
}

function EditFeeModal({ fee, onClose, onSuccess }) {
  const [rows, setRows] = useState(
    (fee.terms || []).map(t => ({
      termName: t.name,
      type: t.name,
      amount: String(t.feeBreakdown?.[0]?.amount ?? t.totalAmount ?? ''),
      discAmount: String(t.discount?.amount || ''),
      discReason: t.discount?.reason || '',
      paidAmount: t.paidAmount || 0,
      isNew: false,
      custom: !!t.custom
    }))
  );
  const [deletedTerms, setDeletedTerms] = useState([]);
  const [loading, setLoading] = useState(false);

  // Backward-compat: legacy per-student categories predate the `custom` flag.
  // A term that appears only on THIS student (not on classmates) is per-student.
  const classId = fee.student?.currentClass?._id || fee.student?.currentClass;
  const { data: classFeesData } = useQuery({
    queryKey: ['class-fees-custom', classId, fee.academicYear],
    queryFn: () => api.get(`/fees?classId=${classId}&limit=500`),
    enabled: !!classId,
  });
  const { siblingTermNames, hasSiblings } = useMemo(() => {
    const names = new Set();
    let siblings = false;
    for (const f of (classFeesData?.fees || [])) {
      if (String(f._id) === String(fee._id)) continue;
      siblings = true;
      for (const t of (f.terms || [])) names.add(t.name);
    }
    return { siblingTermNames: names, hasSiblings: siblings };
  }, [classFeesData, fee._id]);

  const updateRow = (i, field, val) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const addRow = () => setRows(prev => [...prev, { termName: '', type: '', amount: '', discAmount: '', discReason: '', paidAmount: 0, isNew: true, custom: true }]);
  const removeRow = (i) => {
    const row = rows[i];
    if (!row.isNew) setDeletedTerms(prev => [...prev, row.termName]);
    setRows(prev => prev.filter((_, idx) => idx !== i));
  };
  const overallTotal = rows.reduce((s, r) => s + Math.max(0, (Number(r.amount) || 0) - (Number(r.discAmount) || 0)), 0);

  const handleSave = async () => {
    if (rows.length === 0) return toast.error('At least one fee category is required');
    if (rows.some(r => !r.type.trim())) return toast.error('All categories need a name');
    const badRow = rows.find(r => !r.isNew && Number(r.amount) > 0 && Number(r.amount) < r.paidAmount);
    if (badRow) return toast.error(`${badRow.type}: amount can't be less than already paid ₹${badRow.paidAmount.toLocaleString('en-IN')}`);
    setLoading(true);
    try {
      for (const termName of deletedTerms) {
        // termName in the query string — DELETE request bodies are unreliable
        // through some production proxies.
        await api.delete(`/fees/${fee._id}/term?termName=${encodeURIComponent(termName)}`, { data: { termName } });
      }
      for (const r of rows) {
        const nameToUse = r.isNew ? r.type : r.termName;
        const rowCustom = r.isNew || r.custom || (hasSiblings && !!r.termName && !siblingTermNames.has(r.termName));
        await api.put(`/fees/${fee._id}`, {
          termName: nameToUse,
          feeBreakdown: [{ type: r.type, amount: Number(r.amount) || 0 }],
          discount: { amount: Number(r.discAmount) || 0, reason: r.discReason },
          custom: rowCustom
        });
      }
      toast.success('Fee updated!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit Fee Structure"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </>}>
      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
        <div className="text-14-semibold">{fee.student?.name}</div>
        <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{fee.academicYear}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r, i) => {
          const net = Math.max(0, (Number(r.amount) || 0) - (Number(r.discAmount) || 0));
          // Per-student custom categories (added just for this student) stay editable
          // and deletable; class-wide categories are managed from "Add / Edit Fee Record".
          // isNew = added this session, custom = persisted flag, sibling check = legacy fallback.
          const isCustom = r.isNew || r.custom || (hasSiblings && !!r.termName && !siblingTermNames.has(r.termName));
          const tooLow = !isCustom && Number(r.amount) > 0 && Number(r.amount) < r.paidAmount;
          return (
            <div key={i} style={{ border: `1px solid ${isCustom ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '7px 14px', background: isCustom ? '#eff6ff' : '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                {r.isNew ? (
                  <input
                    className="form-control"
                    value={r.type}
                    onChange={e => updateRow(i, 'type', e.target.value)}
                    placeholder="New category name (e.g. Exam Fee)"
                    style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
                    autoFocus
                  />
                ) : (
                  <span className="text-14-semibold">{r.type}</span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {r.paidAmount > 0 && (
                    <span style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                      Paid ₹{r.paidAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                  {isCustom && r.paidAmount === 0 && (
                    <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeRow(i)} title="Remove category">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Amount (₹)</label>
                  <input className="form-control" type="number" min={0} value={r.amount} readOnly={!isCustom}
                    onChange={e => updateRow(i, 'amount', e.target.value)}
                    style={!isCustom ? { background: '#f8fafc', color: 'var(--text-secondary)' } : undefined} />
                  {isCustom
                    ? <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Added for this student only — editable and removable here.</p>
                    : <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Class-wide fee — change it for the whole class from “Add / Edit Fee Record”. Apply discounts when collecting.</p>}
                  {tooLow && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Can't be less than paid ₹{r.paidAmount.toLocaleString('en-IN')}</p>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                  Net: <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>₹{net.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          <Plus size={13} /> Add Category
        </button>
        <div style={{ padding: '8px 14px', background: '#eff6ff', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-13-regular" style={{ color: 'var(--primary)' }}>Total Net:</span>
          <span className="text-15-bold" style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{overallTotal.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </Modal>
  );
}
