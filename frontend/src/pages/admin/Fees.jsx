import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Download, MessageSquare, Eye, CreditCard, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, StatusBadge, Pagination, SearchInput, PageLoader, FormRow, EmptyState, StatCard, ColumnSelector, useColumnSelector } from '../../components/ui';

const FEE_COLS = [
  { key: 'academicYear', label: 'Academic Year' },
  { key: 'total',        label: 'Total (₹)' },
  { key: 'paid',         label: 'Paid (₹)' },
  { key: 'pending',      label: 'Pending (₹)' },
  { key: 'status',       label: 'Status' },
];

export default function Fees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCollect, setShowCollect] = useState(null);
  const [viewFee, setViewFee] = useState(null);
  const [selected, setSelected] = useState([]);

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data, isLoading } = useQuery({
    queryKey: ['fees', page, statusFilter, classFilter],
    queryFn: () => api.get(`/fees?page=${page}&limit=20&status=${statusFilter}&classId=${classFilter}`)
  });
  const fees = data?.fees || [];
  const total = data?.total || 0;

  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: { feeBreakdown: [{ type: 'Tuition Fee', amount: 0 }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'feeBreakdown' });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/fees', d),
    onSuccess: () => { qc.invalidateQueries(['fees']); toast.success('Fee record created!'); setShowCreate(false); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const { data: studentData } = useQuery({ queryKey: ['students-all'], queryFn: () => api.get('/students?limit=500&status=active') });
  const students = studentData?.students || [];

  const downloadReceipt = async (id) => {
    try {
      const res = await fetch(`/api/fees/${id}/receipt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `receipt.pdf`; a.click();
    } catch { toast.error('Failed'); }
  };

  const sendReminders = async () => {
    if (selected.length === 0) return toast.error('Select fee records first');
    try {
      const res = await api.post('/fees/send-reminder', { feeIds: selected });
      toast.success(res.message);
      setSelected([]);
    } catch { toast.error('Failed to send reminders'); }
  };

  const [visibleCols, setVisibleCols] = useColumnSelector('fees', FEE_COLS);
  const col = (key) => visibleCols.has(key);

  // Calculate stats
  const totalPending = fees.reduce((s, f) => s + (f.pendingAmount || 0), 0);
  const totalCollected = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fees</h1>
          <p className="page-subtitle">{total} fee records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-secondary" onClick={sendReminders}>
              <MessageSquare size={16} /> Send Reminder ({selected.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { reset(); setShowCreate(true); }}>
            <Plus size={16} /> Add Fee Record
          </button>
        </div>
      </div>

      {/* Quick stats */}
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
          {['pending','partial','paid','overdue'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
                  {col('academicYear') && <th>Academic Year</th>}
                  {col('total')        && <th>Total (₹)</th>}
                  {col('paid')         && <th>Paid (₹)</th>}
                  {col('pending')      && <th>Pending (₹)</th>}
                  {col('status')       && <th>Status</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fees.length === 0 && (
                  <tr><td colSpan={3 + FEE_COLS.filter(c => visibleCols.has(c.key)).length}><EmptyState icon={CreditCard} message="No fee records." /></td></tr>
                )}
                {fees.map(fee => (
                  <tr key={fee._id}>
                    <td><input type="checkbox" checked={selected.includes(fee._id)} onChange={e => setSelected(p => e.target.checked ? [...p, fee._id] : p.filter(i => i !== fee._id))} /></td>
                    <td className="text-14-medium">
                      <div>{fee.student?.name}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{fee.student?.admissionNumber}</div>
                    </td>
                    {col('academicYear') && <td className="text-14-regular">{fee.academicYear}</td>}
                    {col('total')        && <td className="text-14-semibold">₹{(fee.netAmount || 0).toLocaleString('en-IN')}</td>}
                    {col('paid')         && <td className="text-14-medium" style={{ color: '#10b981' }}>₹{(fee.paidAmount || 0).toLocaleString('en-IN')}</td>}
                    {col('pending')      && <td className="text-14-medium" style={{ color: fee.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>₹{(fee.pendingAmount || 0).toLocaleString('en-IN')}</td>}
                    {col('status')       && <td><StatusBadge status={fee.status} /></td>}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setViewFee(fee)} data-tooltip="View"><Eye size={14} /></button>
                        {fee.pendingAmount > 0 && (
                          <button className="btn btn-success btn-sm text-12-regular" onClick={() => setShowCollect(fee)} style={{ padding: '4px 10px' }}>Collect</button>
                        )}
                        {fee.paidAmount > 0 && (
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadReceipt(fee._id)} data-tooltip="Receipt"><Download size={14} /></button>
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
          <button className="btn btn-primary" onClick={handleSubmit(d => createMutation.mutate(d))}>
            {createMutation.isLoading ? 'Creating...' : 'Create Record'}
          </button>
        </>}>
        <form>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Student *</label>
              <select className="form-control" {...register('studentId', { required: true })}>
                <option value="">Select student</option>
                {students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.admissionNumber})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year *</label>
              <input className="form-control" {...register('academicYear', { required: true })} placeholder="2024-2025" />
            </div>
          </FormRow>
          <div className="form-group">
            <label className="form-label">Term (optional)</label>
            <select className="form-control" {...register('term')}>
              <option value="">Full Year</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Fee Breakdown *</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ type: '', amount: 0 })}>
                <Plus size={14} /> Add Item
              </button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="form-control" {...register(`feeBreakdown.${idx}.type`)} placeholder="Fee type (e.g. Tuition)" />
                <input className="form-control" style={{ width: 140 }} type="number" {...register(`feeBreakdown.${idx}.amount`)} placeholder="Amount" />
                {idx > 0 && <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(idx)}>✕</button>}
              </div>
            ))}
          </div>

          <FormRow>
            <div className="form-group">
              <label className="form-label">Discount (₹)</label>
              <input className="form-control" type="number" {...register('discount.amount')} defaultValue={0} />
            </div>
            <div className="form-group">
              <label className="form-label">Discount Reason</label>
              <input className="form-control" {...register('discount.reason')} placeholder="e.g. Sibling concession" />
            </div>
          </FormRow>
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

      {/* View Fee Modal */}
      {viewFee && (
        <Modal open onClose={() => setViewFee(null)} title="Fee Details">
          <div>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <div className="text-16-bold">{viewFee.student?.name}</div>
              <div className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{viewFee.academicYear} · {viewFee.term || 'Full Year'}</div>
            </div>
            <table style={{ width: '100%', marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'left' }}>Description</th>
                  <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {viewFee.feeBreakdown?.map((f, i) => (
                  <tr key={i}>
                    <td className="text-14-regular" style={{ padding: '8px 12px' }}>{f.type}</td>
                    <td className="text-14-regular" style={{ padding: '8px 12px', textAlign: 'right' }}>₹{f.amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {viewFee.discount?.amount > 0 && (
                  <tr>
                    <td className="text-14-regular" style={{ padding: '8px 12px', color: '#16a34a' }}>Discount ({viewFee.discount.reason})</td>
                    <td className="text-14-regular" style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a' }}>-₹{viewFee.discount.amount.toLocaleString('en-IN')}</td>
                  </tr>
                )}
                <tr style={{ background: '#eff6ff' }}>
                  <td className="text-14-bold" style={{ padding: '10px 12px' }}>Net Amount</td>
                  <td className="text-14-bold" style={{ padding: '10px 12px', textAlign: 'right' }}>₹{viewFee.netAmount?.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: '#f0fdf4', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div className="text-12-regular" style={{ color: '#16a34a' }}>Paid</div>
                <div className="text-16-bold" style={{ color: '#16a34a' }}>₹{viewFee.paidAmount?.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div className="text-12-regular" style={{ color: '#dc2626' }}>Pending</div>
                <div className="text-16-bold" style={{ color: '#dc2626' }}>₹{viewFee.pendingAmount?.toLocaleString('en-IN')}</div>
              </div>
            </div>
            {viewFee.payments?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="text-14-semibold" style={{ marginBottom: 8 }}>Payment History</div>
                {viewFee.payments.map((p, i) => (
                  <div key={i} className="text-14-regular" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, marginBottom: 4 }}>
                    <span>{new Date(p.date).toLocaleDateString('en-IN')} · {p.method}</span>
                    <span className="text-14-semibold">₹{p.amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function CollectPaymentModal({ fee, onClose, onSuccess }) {
  const [amount, setAmount] = useState(fee.pendingAmount || 0);
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    setLoading(true);
    try {
      await api.post('/fees/collect', { feeId: fee._id, amount: Number(amount), method });
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
        <button className="btn btn-primary" onClick={handleCollect} disabled={loading}>
          {loading ? 'Processing...' : '✓ Collect Payment'}
        </button>
      </>}>
      <div style={{ marginBottom: 16 }}>
        <div className="text-14-semibold">{fee.student?.name}</div>
        <div className="text-14-regular" style={{ color: 'var(--text-muted)' }}>Pending: ₹{fee.pendingAmount?.toLocaleString('en-IN')}</div>
      </div>
      <div className="form-group">
        <label className="form-label">Amount (₹) *</label>
        <input className="form-control" type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={fee.pendingAmount} />
      </div>
      <div className="form-group">
        <label className="form-label">Payment Method *</label>
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
