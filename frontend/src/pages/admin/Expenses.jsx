import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, DollarSign, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, StatusBadge, PageLoader, EmptyState, StatCard, FormRow, ColumnSelector, useColumnSelector } from '../../components/ui';
import { format } from 'date-fns';

const EXPENSE_COLS = [
  { key: 'category', label: 'Category' },
  { key: 'vendor',   label: 'Vendor' },
  { key: 'date',     label: 'Date' },
  { key: 'amount',   label: 'Amount' },
  { key: 'method',   label: 'Payment Method' },
];

export default function Expenses() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', month, year, category],
    queryFn: () => api.get(`/expenses?month=${month}&year=${year}&category=${category}`)
  });
  const expenses = data?.expenses || [];
  const total = data?.total || 0;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const categories = ['furniture','electronics','maintenance','stationery','transport','utilities','events','other'];

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/expenses', d),
    onSuccess: () => { qc.invalidateQueries(['expenses']); toast.success('Expense recorded!'); setShowModal(false); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries(['expenses']); toast.success('Expense deleted'); }
  });

  const [visibleCols, setVisibleCols] = useColumnSelector('expenses', EXPENSE_COLS);
  const col = (key) => visibleCols.has(key);

  // Category totals
  const byCategory = categories.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track school expenditures</p>
        </div>
        <button className="btn btn-primary" onClick={() => { reset(); setShowModal(true); }}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y}>{y}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <ColumnSelector storageKey="expenses" cols={EXPENSE_COLS} visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total This Month" value={`₹${total.toLocaleString('en-IN')}`} icon={TrendingDown} color="#ef4444" bg="#fef2f2" sub={`${months[month - 1]} ${year}`} />
        {byCategory.slice(0, 3).map(({ cat, total: t }) => (
          <StatCard key={cat} title={cat.charAt(0).toUpperCase() + cat.slice(1)} value={`₹${t.toLocaleString('en-IN')}`} icon={DollarSign} color="#f59e0b" bg="#fffbeb" />
        ))}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  {col('category') && <th>Category</th>}
                  {col('vendor')   && <th>Vendor</th>}
                  {col('date')     && <th>Date</th>}
                  {col('amount')   && <th>Amount</th>}
                  {col('method')   && <th>Payment Method</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={2 + EXPENSE_COLS.filter(c => visibleCols.has(c.key)).length}><EmptyState icon={DollarSign} message="No expenses recorded this month." /></td></tr>
                )}
                {expenses.map(exp => (
                  <tr key={exp._id}>
                    <td className="text-14-medium">{exp.title}</td>
                    {col('category') && <td><span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{exp.category}</span></td>}
                    {col('vendor')   && <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{exp.vendor || '—'}</td>}
                    {col('date')     && <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{format(new Date(exp.date), 'dd MMM yyyy')}</td>}
                    {col('amount')   && <td className="text-14-bold" style={{ color: '#ef4444' }}>₹{exp.amount.toLocaleString('en-IN')}</td>}
                    {col('method')   && <td className="text-14-regular" style={{ textTransform: 'capitalize' }}>{exp.paymentMethod?.replace('_', ' ') || '—'}</td>}
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(exp._id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {expenses.length > 0 && (
                  <tr className="text-14-bold" style={{ background: '#f8fafc' }}>
                    <td colSpan={1 + [col('category'), col('vendor'), col('date')].filter(Boolean).length} style={{ padding: '12px 16px' }}>Total</td>
                    <td style={{ color: '#ef4444' }}>₹{total.toLocaleString('en-IN')}</td>
                    <td colSpan={[col('method')].filter(Boolean).length + 1}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Expense"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => createMutation.mutate(d))}>
            {createMutation.isLoading ? 'Saving...' : 'Add Expense'}
          </button>
        </>}>
        <form>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-control" {...register('title', { required: 'Required' })} placeholder="e.g. Whiteboard repair" />
            {errors.title && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.title.message}</p>}
          </div>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-control" {...register('category', { required: 'Required' })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              {errors.category && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.category.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input className="form-control" type="number" {...register('amount', { required: 'Required', min: 1 })} />
              {errors.amount && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.amount.message}</p>}
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-control" type="date" {...register('date', { required: 'Required' })} defaultValue={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor / Supplier</label>
              <input className="form-control" {...register('vendor')} placeholder="e.g. ABC Traders" />
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-control" {...register('paymentMethod')}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bill Number</label>
              <input className="form-control" {...register('billNumber')} placeholder="Invoice / Bill No." />
            </div>
          </FormRow>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" {...register('description')} rows={2} placeholder="Additional notes..." />
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Delete Expense" message="This will permanently delete this expense record." danger />
    </div>
  );
}
