import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2, Edit2, Download, DollarSign, TrendingDown, Tag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useYear } from '../../store/YearContext';
import { Modal, ConfirmDialog, StatusBadge, PageLoader, EmptyState, StatCard, FormRow, SearchInput, ColumnSelector, useColumnSelector } from '../../components/ui';
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
  const { selectedYear, isCurrent, range } = useYear();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  // Global year scoping: a past academic year scopes expenses to that year's
  // date range; the current (default) year shows all records (the manual
  // From/To picker can still narrow either way).
  useEffect(() => {
    if (isCurrent) {
      setStartDate('');
      setEndDate('');
    } else {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', startDate, endDate, category],
    queryFn: () => {
      const params = new URLSearchParams({ category });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return api.get(`/expenses?${params}`);
    }
  });
  const expenses = data?.expenses || [];
  const total = data?.total || 0;

  // Client-side search over the fetched list (title, vendor or category)
  const displayExpenses = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.vendor?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q));
  })();
  const displayTotal = displayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });

  const DEFAULT_CATEGORIES = ['furniture','electronics','maintenance','stationery','transport','utilities','salary','events','other'];
  const customCategories = schoolData?.school?.expenseCategories || [];
  const categories = [...DEFAULT_CATEGORIES, ...customCategories.filter(c => !DEFAULT_CATEGORIES.includes(c.toLowerCase()))];

  // Payment methods = built-ins + the school's custom fee payment categories,
  // so an expense is deducted from the same running balance.
  const paymentMethods = [
    { value: 'cash',          label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque',        label: 'Cheque' },
    { value: 'online',        label: 'Online (UPI/NEFT)' },
    ...(schoolData?.school?.paymentMethods || []).filter(Boolean).map(m => ({ value: m, label: m })),
  ];

  // Invoice upload for the Add modal.
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const uploadInvoice = async (file) => {
    if (!file) return;
    setUploadingInvoice(true);
    try {
      const fd = new FormData();
      fd.append('invoice', file);
      const res = await api.post('/expenses/upload-invoice', fd, { headers: { 'Content-Type': undefined } });
      setInvoiceUrl(res.url);
      toast.success('Invoice attached');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/expenses', { ...d, billDocument: invoiceUrl || undefined }),
    onSuccess: () => { qc.invalidateQueries(['expenses']); qc.invalidateQueries(['fees-method-balances']); toast.success('Expense recorded!'); setShowModal(false); reset(); setInvoiceUrl(''); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: () => Promise.all(selected.map(id => api.delete(`/expenses/${id}`))),
    onSuccess: () => {
      qc.invalidateQueries(['expenses']);
      qc.invalidateQueries(['fees-method-balances']);
      toast.success(`${selected.length} expense${selected.length > 1 ? 's' : ''} deleted`);
      setSelected([]);
      setConfirmDelete(false);
    },
    onError: () => { toast.error('Failed to delete'); setConfirmDelete(false); }
  });

  const [visibleCols, setVisibleCols] = useColumnSelector('expenses', EXPENSE_COLS);
  const col = (key) => visibleCols.has(key);

  const allSelected = displayExpenses.length > 0 && displayExpenses.every(e => selected.includes(e._id));
  const toggleAll = (checked) => setSelected(checked ? displayExpenses.map(e => e._id) : []);
  const toggleOne = (id, checked) => setSelected(p => checked ? [...p, id] : p.filter(i => i !== id));

  // Category totals
  const byCategory = categories.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const visibleColCount = EXPENSE_COLS.filter(c => visibleCols.has(c.key)).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track school expenditures</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowReport(true)}>
            <Download size={16} /> Download Report
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCatModal(true)}>
            <Tag size={16} /> Add Category
          </button>
          <button className="btn btn-primary" onClick={() => { reset({ date: format(new Date(), 'yyyy-MM-dd') }); setShowModal(true); }}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title, vendor or category..." />
        <AntSelect
          style={{ minWidth: 160 }}
          value={category || undefined}
          placeholder="All Categories"
          allowClear
          onChange={val => setCategory(val ?? '')}
          options={categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
        />
        <ColumnSelector storageKey="expenses" cols={EXPENSE_COLS} visible={visibleCols} onChange={setVisibleCols} />
        {/* Date range pushed to the end of the bar */}
        <DatePicker.RangePicker
          style={{ width: 280, marginLeft: 'auto' }}
          format="DD MMM YYYY"
          value={[startDate ? dayjs(startDate) : null, endDate ? dayjs(endDate) : null]}
          onChange={(range) => {
            setStartDate(range?.[0] ? range[0].format('YYYY-MM-DD') : '');
            setEndDate(range?.[1] ? range[1].format('YYYY-MM-DD') : '');
          }}
          getPopupContainer={() => document.body}
        />
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ minWidth: 260 }}>
          <StatCard
            title={startDate || endDate ? 'Total for Selected Range' : 'Total (All Time)'}
            value={`₹${total.toLocaleString('en-IN')}`}
            icon={TrendingDown} color="#ef4444" bg="#fef2f2"
            sub={startDate && endDate
              ? `${format(new Date(startDate + 'T00:00'), 'dd MMM yyyy')} – ${format(new Date(endDate + 'T00:00'), 'dd MMM yyyy')}`
              : startDate ? `From ${format(new Date(startDate + 'T00:00'), 'dd MMM yyyy')}`
              : endDate   ? `Until ${format(new Date(endDate + 'T00:00'), 'dd MMM yyyy')}`
              : 'All records'}
          />
        </div>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} /></th>
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
                {displayExpenses.length === 0 && (
                  <tr><td colSpan={3 + visibleColCount}><EmptyState icon={DollarSign} message="No expenses recorded." /></td></tr>
                )}
                {displayExpenses.map(exp => (
                  <tr key={exp._id} style={{ cursor: 'pointer' }} onClick={() => setViewExpense(exp)}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(exp._id)} onChange={e => toggleOne(exp._id, e.target.checked)} /></td>
                    <td className="text-14-medium">{exp.title}</td>
                    {col('category') && <td><span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{exp.category}</span></td>}
                    {col('vendor')   && <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{exp.vendor || '—'}</td>}
                    {col('date')     && <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{format(new Date(exp.date), 'dd MMM yyyy')}</td>}
                    {col('amount')   && <td className="text-14-bold" style={{ color: '#ef4444' }}>₹{exp.amount.toLocaleString('en-IN')}</td>}
                    {col('method')   && <td className="text-14-regular" style={{ textTransform: 'capitalize' }}>{exp.paymentMethod?.replace('_', ' ') || '—'}</td>}
                    <td onClick={e => e.stopPropagation()}>
                      {!exp.billNumber && (
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditExpense(exp)} title="Edit expense">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {displayExpenses.length > 0 && (
                  <tr className="text-14-bold" style={{ background: '#f8fafc' }}>
                    <td></td>
                    <td colSpan={1 + [col('category'), col('vendor'), col('date')].filter(Boolean).length} style={{ padding: '12px 16px' }}>Total</td>
                    <td style={{ color: '#ef4444' }}>₹{displayTotal.toLocaleString('en-IN')}</td>
                    <td colSpan={[col('method')].filter(Boolean).length + 1}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setInvoiceUrl(''); }} title="Add Expense"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setInvoiceUrl(''); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => createMutation.mutate(d))}>
            {createMutation.isPending ? 'Saving...' : 'Add Expense'}
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
              <Controller name="category" control={control} rules={{ required: 'Required' }} render={({ field }) => (
                <AntSelect
                  {...field}
                  style={{ width: '100%' }}
                  placeholder="Select category"
                  options={categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
                />
              )} />
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
              <Controller name="date" control={control} rules={{ required: 'Required' }}
                render={({ field }) => (
                  <DatePicker
                    style={{ width: '100%' }}
                    format="DD MMM YYYY"
                    placeholder="Select date"
                    status={errors.date ? 'error' : ''}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                    getPopupContainer={() => document.body}
                  />
                )}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor / Supplier</label>
              <input className="form-control" {...register('vendor')} placeholder="e.g. ABC Traders" />
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <Controller name="paymentMethod" control={control} render={({ field }) => (
                <AntSelect
                  {...field}
                  style={{ width: '100%' }}
                  options={paymentMethods}
                />
              )} />
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
          <div className="form-group">
            <label className="form-label">Invoice (image / PDF)</label>
            {invoiceUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <a href={invoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, flex: 1 }}>Invoice attached — view</a>
                <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => setInvoiceUrl('')} title="Remove"><X size={14} /></button>
              </div>
            ) : (
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <Plus size={14} /> {uploadingInvoice ? 'Uploading…' : 'Upload Invoice'}
                <input type="file" accept="image/*,application/pdf" hidden disabled={uploadingInvoice}
                  onChange={e => { uploadInvoice(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </form>
      </Modal>

      {/* Edit Expense Modal */}
      {editExpense && (
        <EditExpenseModal
          expense={editExpense}
          categories={categories}
          paymentMethods={paymentMethods}
          onClose={() => setEditExpense(null)}
          onSuccess={() => { qc.invalidateQueries(['expenses']); qc.invalidateQueries(['fees-method-balances']); setEditExpense(null); }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Expenses"
        message={`This will permanently delete ${selected.length} expense record${selected.length > 1 ? 's' : ''}. This cannot be undone.`}
        danger
      />

      {viewExpense && (
        <ExpenseDetailModal expense={viewExpense} onClose={() => setViewExpense(null)} onEdit={() => { setEditExpense(viewExpense); setViewExpense(null); }} />
      )}

      {showReport && (
        <ExpenseReportModal categories={categories} onClose={() => setShowReport(false)} />
      )}

      {showCatModal && (
        <CategoryModal
          defaultCategories={DEFAULT_CATEGORIES}
          customCategories={customCategories}
          onClose={() => setShowCatModal(false)}
          onSaved={() => { qc.invalidateQueries(['school']); setShowCatModal(false); }}
        />
      )}
    </div>
  );
}

function ExpenseDetailModal({ expense: exp, onClose, onEdit }) {
  const fields = [
    { label: 'Title',          value: exp.title },
    { label: 'Category',       value: exp.category ? exp.category.charAt(0).toUpperCase() + exp.category.slice(1) : '—' },
    { label: 'Amount',         value: `₹${exp.amount?.toLocaleString('en-IN')}`, highlight: true },
    { label: 'Date',           value: exp.date ? format(new Date(exp.date), 'dd MMM yyyy') : '—' },
    { label: 'Vendor / Supplier', value: exp.vendor || '—' },
    { label: 'Payment Method', value: exp.paymentMethod ? exp.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—' },
    { label: 'Bill / Invoice No.', value: exp.billNumber || '—' },
    { label: 'Description',    value: exp.description || '—', full: true },
  ];

  return (
    <Modal open onClose={onClose} title="Expense Details"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {!exp.billNumber && (
          <button className="btn btn-primary" onClick={onEdit}>Edit</button>
        )}
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
        {fields.map(({ label, value, highlight, full }) => (
          <div key={label} style={full ? { gridColumn: '1 / -1' } : {}}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 500 }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: highlight ? 700 : 500, color: highlight ? '#ef4444' : 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>{value}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ExpenseReportModal({ categories, onClose }) {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  const presets = [
    { label: 'Today',        start: fmt(now),                                          end: fmt(now) },
    { label: 'Last 7 Days',  start: fmt(new Date(now - 6 * 86400000)),                end: fmt(now) },
    { label: 'Last 10 Days', start: fmt(new Date(now - 9 * 86400000)),                end: fmt(now) },
    { label: 'This Month',   start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) },
    { label: 'Last Month',   start: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                             end: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) },
  ];

  const [activePreset, setActivePreset] = useState(presets[3].label);
  const [startDate, setStartDate] = useState(presets[3].start);
  const [endDate, setEndDate]     = useState(presets[3].end);
  const [category, setCategory]   = useState('');
  const [loading, setLoading]     = useState(false);

  const applyPreset = (p) => {
    setActivePreset(p.label);
    setStartDate(p.start);
    setEndDate(p.end);
  };

  const handleStartChange = (v) => { setStartDate(v); setActivePreset('Custom'); };
  const handleEndChange   = (v) => { setEndDate(v);   setActivePreset('Custom'); };

  const download = async () => {
    if (!startDate || !endDate) { toast.error('Select a date range'); return; }
    if (new Date(startDate) > new Date(endDate)) { toast.error('Start date must be before end date'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (category) params.set('category', category);
      const res = await api.get(`/expenses/report?${params}`, { responseType: 'blob' });
      const blob = new Blob([res], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `expenses_report_${startDate}_to_${endDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
      onClose();
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Download Expense Report"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={download} disabled={loading}>
          {loading ? 'Generating...' : 'Download PDF'}
        </button>
      </>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {presets.map(p => (
          <button key={p.label}
            onClick={() => applyPreset(p)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1.5px solid',
              borderColor: activePreset === p.label ? 'var(--primary)' : '#e2e8f0',
              background:  activePreset === p.label ? 'var(--primary)' : '#fff',
              color:       activePreset === p.label ? '#fff' : 'var(--text-primary)',
              fontWeight: activePreset === p.label ? 600 : 400,
            }}>
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setActivePreset('Custom')}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1.5px solid',
            borderColor: activePreset === 'Custom' ? 'var(--primary)' : '#e2e8f0',
            background:  activePreset === 'Custom' ? 'var(--primary)' : '#fff',
            color:       activePreset === 'Custom' ? '#fff' : 'var(--text-primary)',
            fontWeight: activePreset === 'Custom' ? 600 : 400,
          }}>
          Custom
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <DatePicker
            style={{ width: '100%' }}
            format="DD MMM YYYY"
            placeholder="Start date"
            value={startDate ? dayjs(startDate) : null}
            onChange={(d) => handleStartChange(d ? d.format('YYYY-MM-DD') : '')}
            getPopupContainer={() => document.body}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <DatePicker
            style={{ width: '100%' }}
            format="DD MMM YYYY"
            placeholder="End date"
            value={endDate ? dayjs(endDate) : null}
            onChange={(d) => handleEndChange(d ? d.format('YYYY-MM-DD') : '')}
            getPopupContainer={() => document.body}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Category (optional)</label>
        <AntSelect
          style={{ width: '100%' }}
          value={category || undefined}
          placeholder="All Categories"
          allowClear
          onChange={val => setCategory(val ?? '')}
          options={categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
        />
      </div>

      {startDate && endDate && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
          Report will include{category ? ` "${category}"` : ''} expenses from{' '}
          <strong>{format(new Date(startDate + 'T00:00:00'), 'dd MMM yyyy')}</strong> to{' '}
          <strong>{format(new Date(endDate + 'T00:00:00'), 'dd MMM yyyy')}</strong>.
        </p>
      )}
    </Modal>
  );
}

function CategoryModal({ defaultCategories, customCategories, onClose, onSaved }) {
  const [newCat, setNewCat] = useState('');
  const [list, setList] = useState([...customCategories]);
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    const trimmed = newCat.trim().toLowerCase();
    if (!trimmed) return;
    if (defaultCategories.includes(trimmed) || list.includes(trimmed)) {
      toast.error('Category already exists');
      return;
    }
    setList(prev => [...prev, trimmed]);
    setNewCat('');
  };

  const handleRemove = (cat) => setList(prev => prev.filter(c => c !== cat));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/school/expense-categories', { categories: list });
      toast.success('Categories saved');
      onSaved();
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Manage Expense Categories"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Categories'}
        </button>
      </>}
    >
      <div className="form-group">
        <label className="form-label">Default Categories</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {defaultCategories.map(c => (
            <span key={c} style={{ padding: '4px 12px', borderRadius: 20, background: '#f1f5f9', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Custom Categories</label>
        {list.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No custom categories yet.</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {list.map(c => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 13, color: '#1d4ed8', textTransform: 'capitalize' }}>
              {c}
              <button onClick={() => handleRemove(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#1d4ed8' }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-control"
            placeholder="e.g. infrastructure, sports..."
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn-secondary" onClick={handleAdd} disabled={!newCat.trim()}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditExpenseModal({ expense, categories, paymentMethods = [], onClose, onSuccess }) {
  const { register, handleSubmit, control: controlEdit, formState: { errors } } = useForm({
    defaultValues: {
      title: expense.title || '',
      category: expense.category || '',
      amount: expense.amount || '',
      date: expense.date ? format(new Date(expense.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      vendor: expense.vendor || '',
      paymentMethod: expense.paymentMethod || 'cash',
      description: expense.description || '',
    }
  });

  const updateMutation = useMutation({
    mutationFn: (d) => api.put(`/expenses/${expense._id}`, d),
    onSuccess: () => { toast.success('Expense updated!'); onSuccess(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  return (
    <Modal open onClose={onClose} title="Edit Expense"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit(d => updateMutation.mutate(d))} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </>}>
      <form>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-control" {...register('title', { required: 'Required' })} />
          {errors.title && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.title.message}</p>}
        </div>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Category *</label>
            <Controller name="category" control={controlEdit} rules={{ required: 'Required' }} render={({ field }) => (
              <AntSelect
                {...field}
                style={{ width: '100%' }}
                placeholder="Select category"
                options={categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
              />
            )} />
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
            <Controller name="date" control={controlEdit} rules={{ required: 'Required' }}
              render={({ field }) => (
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD MMM YYYY"
                  placeholder="Select date"
                  status={errors.date ? 'error' : ''}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                  getPopupContainer={() => document.body}
                />
              )}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vendor / Supplier</label>
            <input className="form-control" {...register('vendor')} placeholder="e.g. ABC Traders" />
          </div>
        </FormRow>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <Controller name="paymentMethod" control={controlEdit} render={({ field }) => (
              <AntSelect
                {...field}
                style={{ width: '100%' }}
                options={paymentMethods}
              />
            )} />
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
  );
}
