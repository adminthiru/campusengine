import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, RefreshCw, AlertTriangle, CheckCircle, BookMarked, RotateCcw, Search, LayoutGrid, List, Barcode, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Select as AntSelect } from 'antd';
import api from '../../utils/api';
import {
  Modal, ConfirmDialog, StatusBadge, PageLoader, EmptyState,
  FormRow, Avatar, SearchInput,
} from '../../components/ui';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const BOOK_CATEGORIES = [
  'Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'History', 'Geography',
  'Literature', 'Reference', 'Textbook', 'Magazine', 'Other',
];

const fmt = (d) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy'); } catch { return '—'; }
};

const calcFine = (dueDate, rate = 2) => {
  if (!dueDate) return 0;
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  if (now <= due) return 0;
  return Math.max(0, Math.ceil((now - due) / 86400000) * rate);
};

const daysDiff = (dueDate) => {
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  return Math.ceil((now - due) / 86400000);
};

const borrowerName = (issue) => {
  if (issue.borrowerType === 'student') return issue.student?.name || '—';
  return issue.employee?.name || '—';
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Library() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('books');
  const [addBookSignal, setAddBookSignal] = useState(0);
  const [showIssueModal, setShowIssueModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-subtitle">Manage books, issues, returns and renewals</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowIssueModal(true)}>
            <BookMarked size={16} /> Issue Book
          </button>
          <button className="btn btn-primary" onClick={() => { setTab('books'); setAddBookSignal(s => s + 1); }}>
            <Plus size={16} /> Add Book
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'books',    label: 'Books' },
          { key: 'issued',   label: 'Issued' },
          { key: 'overdue',  label: 'Overdue' },
          { key: 'renewals', label: 'Renewals' },
          { key: 'reports',  label: 'Reports' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'books'    && <BooksTab addBookSignal={addBookSignal} />}
      {tab === 'issued'   && <IssuedTab />}
      {tab === 'overdue'  && <OverdueTab />}
      {tab === 'renewals' && <RenewalsTab />}
      {tab === 'reports'  && <ReportsTab />}

      {showIssueModal && (
        <IssueBookModal
          onClose={() => setShowIssueModal(false)}
          onSuccess={() => {
            qc.invalidateQueries(['library-issues']);
            qc.invalidateQueries(['library-books']);
            setShowIssueModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Books Tab ─────────────────────────────────────────────────────────────────

function BooksTab({ addBookSignal = 0 }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handledSignalRef = useRef(addBookSignal);
  useEffect(() => {
    if (addBookSignal > handledSignalRef.current) {
      handledSignalRef.current = addBookSignal;
      setEditBook(null);
      setShowModal(true);
    }
  }, [addBookSignal]);

  const { data, isLoading } = useQuery({
    queryKey: ['library-books', search, category, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      return api.get(`/library/books?${params}`);
    },
  });
  const books = data?.books || [];

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all(selected.map(id => api.delete(`/library/books/${id}`)));
      qc.invalidateQueries(['library-books']);
      toast.success(`${selected.length} book(s) deleted`);
      setSelected([]);
      setBulkDeleteConfirm(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to delete some books');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div>
      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title, author, ISBN..." />
        <AntSelect
          style={{ minWidth: 160 }}
          value={category || undefined}
          placeholder="All Categories"
          allowClear
          onChange={val => setCategory(val ?? '')}
          options={BOOK_CATEGORIES.map(c => ({ value: c, label: c }))}
        />
        <AntSelect
          style={{ minWidth: 130 }}
          value={status || undefined}
          placeholder="All Status"
          allowClear
          onChange={val => setStatus(val ?? '')}
          options={[
            { value: 'available', label: 'Available' },
            { value: 'unavailable', label: 'Unavailable' },
          ]}
        />
        {selected.length > 0 && (
          <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setBulkDeleteConfirm(true)}>
            <Trash2 size={15} /> Delete ({selected.length})
          </button>
        )}
        {/* View mode toggle — end of filter bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', height: 36, flexShrink: 0 }}>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 0, border: 'none', width: 36, height: 36, padding: 0 }}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={15} />
          </button>
          <button
            className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid #e2e8f0', width: 36, height: 36, padding: 0 }}
            onClick={() => setViewMode('grid')}
            title="Shelf view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {isLoading ? <PageLoader /> : viewMode === 'grid' ? (
        books.length === 0 ? (
          <EmptyState icon={BookOpen} message="No books found. Add your first book to get started." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 16 }}>
            {books.map(book => (
              <BookShelfCard
                key={book._id}
                book={book}
                onEdit={() => { setEditBook(book); setShowModal(true); }}
              />
            ))}
          </div>
        )
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={books.length > 0 && selected.length === books.length}
                      onChange={e => setSelected(e.target.checked ? books.map(b => b._id) : [])}
                    />
                  </th>
                  <th>Title / Author</th>
                  <th>ISBN</th>
                  <th>Category</th>
                  <th>Total / Available</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={BookOpen} message="No books found. Add your first book to get started." />
                    </td>
                  </tr>
                )}
                {books.map(book => (
                  <tr key={book._id}>
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(book._id)}
                        onChange={e => setSelected(p => e.target.checked ? [...p, book._id] : p.filter(id => id !== book._id))}
                      />
                    </td>
                    <td>
                      <div className="text-14-medium">{book.title}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{book.author}</div>
                    </td>
                    <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{book.isbn || '—'}</td>
                    <td>
                      {book.category && (
                        <span className="badge badge-info" style={{ textTransform: 'none' }}>{book.category}</span>
                      )}
                    </td>
                    <td>
                      <span className="text-14-medium">{book.totalCopies}</span>
                      <span className="text-12-regular" style={{ color: 'var(--text-secondary)' }}> / </span>
                      <span className="text-14-medium" style={{ color: book.availableCopies > 0 ? '#10b981' : '#ef4444' }}>
                        {book.availableCopies}
                      </span>
                    </td>
                    <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{book.location || '—'}</td>
                    <td>
                      <span className={`badge badge-${book.status === 'available' ? 'success' : 'secondary'}`}>
                        {book.status === 'available' ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => { setEditBook(book); setShowModal(true); }}>
                        <Edit size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <BookModal
          book={editBook}
          onClose={() => { setShowModal(false); setEditBook(null); }}
          onSuccess={() => { qc.invalidateQueries(['library-books']); setShowModal(false); setEditBook(null); }}
        />
      )}

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Books"
        message={`This will permanently delete ${selected.length} book(s) and cannot be undone.`}
        danger
        confirmLabel={bulkDeleting ? 'Deleting...' : `Delete (${selected.length})`}
        disabled={bulkDeleting}
      />
    </div>
  );
}

// ─── Book Modal (Add / Edit) ─────────────────────────────────────────────────

function BookModal({ book, onClose, onSuccess }) {
  const isEdit = !!book;
  const [form, setForm] = useState({
    title:       book?.title       || '',
    author:      book?.author      || '',
    isbn:        book?.isbn        || '',
    category:    book?.category    || '',
    publisher:   book?.publisher   || '',
    year:        book?.year        || '',
    totalCopies: book?.totalCopies || 1,
    location:    book?.location    || '',
    description: book?.description || '',
    status:      book?.status      || 'available',
  });
  const [saving, setSaving] = useState(false);
  const [scanIsbn, setScanIsbn] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState(null); // { ok: bool, text: string }
  const scanRef = useRef(null);

  useEffect(() => {
    if (!isEdit) setTimeout(() => scanRef.current?.focus(), 80);
  }, [isEdit]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleIsbnLookup = async (rawIsbn) => {
    const isbn = (rawIsbn || '').trim().replace(/[-\s]/g, '');
    if (!isbn) return;
    setIsLookingUp(true);
    setLookupMsg(null);
    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
      );
      const json = await res.json();
      const bookData = json[`ISBN:${isbn}`];
      if (!bookData) {
        setLookupMsg({ ok: false, text: `ISBN "${rawIsbn.trim()}" not found in Open Library. Fill details manually.` });
        return;
      }
      const yearMatch = bookData.publish_date?.match(/\d{4}/);
      setForm(f => ({
        ...f,
        isbn: rawIsbn.trim(),
        title:       bookData.title                  || f.title,
        author:      bookData.authors?.[0]?.name     || f.author,
        publisher:   bookData.publishers?.[0]?.name  || f.publisher,
        year:        yearMatch?.[0]                  || f.year,
        description: typeof bookData.notes === 'string' ? bookData.notes : f.description,
      }));
      setLookupMsg({ ok: true, text: '✓ Details filled from Open Library. Review and save.' });
    } catch {
      setLookupMsg({ ok: false, text: 'Lookup failed — check internet connection. Fill details manually.' });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('Title and author are required');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/library/books/${book._id}`, form);
        toast.success('Book updated');
      } else {
        await api.post('/library/books', form);
        toast.success('Book added');
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.message || 'Failed to save book');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Book' : 'Add Book'}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Book'}
          </button>
        </>
      }
    >
      {/* ── ISBN Scan / Lookup ─────────────────────────────────────── */}
      {!isEdit && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
          padding: '12px 14px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Barcode size={16} style={{ color: '#0369a1', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>
              Scan Barcode or Enter ISBN
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              ref={scanRef}
              className="form-control"
              style={{ fontSize: 13 }}
              value={scanIsbn}
              onChange={e => setScanIsbn(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleIsbnLookup(scanIsbn)}
              placeholder="Connect USB/BT scanner and scan, or type ISBN..."
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => handleIsbnLookup(scanIsbn)}
              disabled={isLookingUp || !scanIsbn.trim()}
            >
              {isLookingUp
                ? 'Looking up...'
                : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Search size={13} /> Lookup</span>
              }
            </button>
          </div>
          {lookupMsg && (
            <p style={{ fontSize: 12, margin: '4px 0 0', color: lookupMsg.ok ? '#15803d' : '#92400e' }}>
              {lookupMsg.text}
            </p>
          )}
          {!lookupMsg && (
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
              Scans auto-fill title, author, publisher & year from Open Library
            </p>
          )}
        </div>
      )}

      {/* ── Book Details Form ──────────────────────────────────────── */}
      <FormRow>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Book title" />
        </div>
        <div className="form-group">
          <label className="form-label">Author *</label>
          <input className="form-control" value={form.author} onChange={e => set('author', e.target.value)} placeholder="Author name" />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">ISBN</label>
          <input className="form-control" value={form.isbn} onChange={e => set('isbn', e.target.value)} placeholder="e.g. 978-3-16-148410-0" />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <AntSelect
            style={{ width: '100%' }}
            value={form.category || undefined}
            placeholder="Select category"
            onChange={val => set('category', val ?? '')}
            options={BOOK_CATEGORIES.map(c => ({ value: c, label: c }))}
          />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Publisher</label>
          <input className="form-control" value={form.publisher} onChange={e => set('publisher', e.target.value)} placeholder="Publisher name" />
        </div>
        <div className="form-group">
          <label className="form-label">Year</label>
          <input className="form-control" type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2023" />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Total Copies</label>
          <input className="form-control" type="number" min="1" value={form.totalCopies} onChange={e => set('totalCopies', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Location (Shelf/Rack)</label>
          <input className="form-control" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Shelf A-3" />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Status</label>
          <AntSelect
            style={{ width: '100%' }}
            value={form.status}
            onChange={val => set('status', val)}
            options={[
              { value: 'available', label: 'Available' },
              { value: 'unavailable', label: 'Unavailable' },
            ]}
          />
        </div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description..." />
      </div>
    </Modal>
  );
}

// ─── Book Shelf Card (grid view) ──────────────────────────────────────────────

const CAT_COLORS = {
  'Fiction':      '#8b5cf6',
  'Non-Fiction':  '#3b82f6',
  'Science':      '#10b981',
  'Mathematics':  '#f59e0b',
  'History':      '#ef4444',
  'Geography':    '#06b6d4',
  'Literature':   '#ec4899',
  'Reference':    '#6b7280',
  'Textbook':     '#1a56e8',
  'Magazine':     '#f97316',
  'Other':        '#64748b',
};

function BookShelfCard({ book, onEdit }) {
  const color = CAT_COLORS[book.category] || '#1a56e8';
  const availPct = book.totalCopies > 0 ? (book.availableCopies / book.totalCopies) * 100 : 0;
  const availColor = book.availableCopies === 0 ? '#ef4444' : book.availableCopies < book.totalCopies ? '#f59e0b' : '#10b981';

  return (
    <div style={{
      background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Top colour stripe */}
      <div style={{ height: 6, background: color }} />

      {/* Book icon area */}
      <div style={{ background: color + '12', padding: '16px 12px 10px', textAlign: 'center' }}>
        <div style={{
          width: 44, height: 58, margin: '0 auto 8px',
          background: color, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '3px 4px 10px rgba(0,0,0,0.22)',
        }}>
          <BookOpen size={22} style={{ color: 'white' }} />
        </div>
        {book.category && (
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
            color: color, background: color + '22', padding: '2px 8px', borderRadius: 20,
          }}>
            {book.category}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 13px', flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35, marginBottom: 3, color: '#0f172a' }}>
          {book.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          {book.author}
        </div>

        {/* Availability row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Available</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: availColor }}>
            {book.availableCopies}<span style={{ fontWeight: 400, color: '#94a3b8' }}> / {book.totalCopies}</span>
          </span>
        </div>
        {/* Availability bar */}
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${availPct}%`, background: availColor, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>

        {book.location && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {book.location}</div>
        )}
        {book.isbn && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>ISBN: {book.isbn}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 12px' }}>
        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}

// ─── Issued Tab ───────────────────────────────────────────────────────────────

function IssuedTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [returnIssue, setReturnIssue] = useState(null);
  const [statusIssue, setStatusIssue] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['library-issues', search, statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('borrowerType', typeFilter);
      return api.get(`/library/issues?${params}`);
    },
  });
  const issues = data?.issues || [];

  const [returnFine, setReturnFine]         = useState('');
  const [returnFinePaid, setReturnFinePaid] = useState(false);

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const finePerDay = schoolData?.school?.libraryConfig?.finePerDay ?? 2;

  const returnMutation = useMutation({
    mutationFn: ({ id, fine, finePaid }) =>
      api.put(`/library/issues/${id}/return`, { fine: Number(fine) || 0, finePaid }),
    onSuccess: (data) => {
      qc.invalidateQueries(['library-issues']);
      qc.invalidateQueries(['library-books']);
      qc.invalidateQueries(['library-overdue']);
      const fine = data?.issue?.fine;
      toast.success(`Book returned${fine > 0 ? `. Fine: ₹${fine}` : ''}`);
      setReturnIssue(null);
    },
    onError: (err) => toast.error(err?.message || 'Failed'),
  });

  return (
    <div>
      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by book title, author, ISBN, borrower..." />
        <AntSelect
          style={{ minWidth: 140 }}
          value={statusFilter || undefined}
          placeholder="All Status"
          allowClear
          onChange={val => setStatusFilter(val ?? '')}
          options={[
            { value: 'issued', label: 'Issued' },
            { value: 'returned', label: 'Returned' },
            { value: 'lost', label: 'Lost' },
            { value: 'damaged', label: 'Damaged' },
          ]}
        />
        <AntSelect
          style={{ minWidth: 150 }}
          value={typeFilter || undefined}
          placeholder="All Borrowers"
          allowClear
          onChange={val => setTypeFilter(val ?? '')}
          options={[
            { value: 'student', label: 'Student' },
            { value: 'employee', label: 'Employee' },
          ]}
        />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Borrower</th>
                  <th>Class / Emp ID</th>
                  <th>Roll / Designation</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Return Date</th>
                  <th>Status</th>
                  <th>Fine</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState icon={BookMarked} message="No issue records found." />
                    </td>
                  </tr>
                )}
                {issues.map(issue => {
                  const isStu = issue.borrowerType === 'student';
                  const cls = isStu && issue.student?.currentClass
                    ? `${issue.student.currentClass.name} ${issue.student.currentClass.section}`
                    : null;
                  const roll = isStu && issue.student?.rollNumber ? `Roll ${issue.student.rollNumber}` : null;
                  const empId = !isStu ? issue.employee?.employeeId : null;
                  const desig = !isStu ? (issue.employee?.designation || issue.employee?.role) : null;
                  return (
                  <tr key={issue._id}>
                    <td>
                      <div className="text-14-medium">{issue.book?.title || '—'}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{issue.book?.author}</div>
                    </td>
                    <td>
                      <div className="text-14-regular">{borrowerName(issue)}</div>
                      <span className="badge badge-secondary" style={{ fontSize: 11 }}>{issue.borrowerType}</span>
                    </td>
                    <td className="text-13-regular" style={{ color: 'var(--text-secondary)' }}>
                      {cls || empId || '—'}
                    </td>
                    <td className="text-13-regular" style={{ color: 'var(--text-secondary)' }}>
                      {roll || desig || '—'}
                    </td>
                    <td className="text-14-regular">{fmt(issue.issueDate)}</td>
                    <td className="text-14-regular">{fmt(issue.dueDate)}</td>
                    <td className="text-14-regular">{fmt(issue.returnDate)}</td>
                    <td><IssueStatusBadge status={issue.status} /></td>
                    <td className="text-14-medium" style={{ color: issue.fine > 0 ? '#ef4444' : 'inherit' }}>
                      {issue.fine > 0 ? `₹${issue.fine}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {issue.status === 'issued' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => { setReturnIssue(issue); setReturnFine(''); setReturnFinePaid(false); }}>
                              Return
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setStatusIssue(issue)}>
                              Lost/Damaged
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {returnIssue && (() => {
        const autoFine = calcFine(returnIssue.dueDate, finePerDay);
        const daysLate = daysDiff(returnIssue.dueDate);
        return (
          <Modal
            open
            onClose={() => setReturnIssue(null)}
            title="Return Book"
            footer={
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setReturnIssue(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={returnMutation.isPending}
                  onClick={() => returnMutation.mutate({ id: returnIssue._id, fine: returnFine === '' ? autoFine : returnFine, finePaid: returnFinePaid })}
                >
                  {returnMutation.isPending ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            }
          >
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              Returning <strong>"{returnIssue.book?.title}"</strong> borrowed by <strong>{borrowerName(returnIssue)}</strong>.
            </p>

            {/* Fine summary */}
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              background: autoFine > 0 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${autoFine > 0 ? '#fecaca' : '#bbf7d0'}`,
            }}>
              {autoFine > 0 ? (
                <p style={{ margin: 0, color: '#dc2626', fontWeight: 600, fontSize: 14 }}>
                  ⚠ Overdue by {daysLate} day{daysLate !== 1 ? 's' : ''} — auto fine: ₹{autoFine} (₹{finePerDay}/day)
                </p>
              ) : (
                <p style={{ margin: 0, color: '#16a34a', fontWeight: 600, fontSize: 14 }}>
                  ✓ Returned on time — no fine
                </p>
              )}
            </div>

            {/* Fine override */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Fine Amount (₹)
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>
                  leave blank to use auto-calculated ₹{autoFine}
                </span>
              </label>
              <input
                type="number" min={0} className="form-control"
                placeholder={`Auto: ₹${autoFine}`}
                value={returnFine}
                onChange={e => setReturnFine(e.target.value)}
              />
            </div>

            {/* Fine paid toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={returnFinePaid}
                onChange={e => setReturnFinePaid(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span>Fine collected / paid at return</span>
            </label>
          </Modal>
        );
      })()}

      {statusIssue && (
        <MarkLostDamagedModal
          issue={statusIssue}
          onClose={() => setStatusIssue(null)}
          onSuccess={() => {
            qc.invalidateQueries(['library-issues']);
            setStatusIssue(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Issue Book Modal ─────────────────────────────────────────────────────────

function IssueBookModal({ onClose, onSuccess }) {
  const [bookId, setBookId] = useState('');
  const [borrowerType, setBorrowerType] = useState('student');
  const [studentId, setStudentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanIsbn, setScanIsbn] = useState('');
  const [scanMsg, setScanMsg] = useState(null); // { ok, text }
  const scanRef = useRef(null);

  useEffect(() => { setTimeout(() => scanRef.current?.focus(), 80); }, []);

  const { data: booksData } = useQuery({
    queryKey: ['library-books-available'],
    queryFn: () => api.get('/library/books?status=available'),
  });
  const availableBooks = (booksData?.books || []).filter(b => b.availableCopies > 0);

  const { data: studentsData } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => api.get('/students'),
  });
  const students = studentsData?.students || [];

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees'),
  });
  const employees = employeesData?.employees || [];

  const handleIsbnScan = (rawIsbn) => {
    const isbn = (rawIsbn || '').trim().replace(/[-\s]/g, '');
    if (!isbn) return;
    const found = availableBooks.find(b => (b.isbn || '').replace(/[-\s]/g, '') === isbn);
    if (found) {
      setBookId(found._id);
      setScanMsg({ ok: true, text: `✓ "${found.title}" selected (${found.availableCopies} available)` });
    } else {
      setScanMsg({ ok: false, text: `No available book found with ISBN "${rawIsbn.trim()}". Try selecting manually.` });
    }
  };

  const handleSubmit = async () => {
    if (!bookId || !dueDate) { toast.error('Book and due date are required'); return; }
    if (borrowerType === 'student' && !studentId) { toast.error('Please select a student'); return; }
    if (borrowerType === 'employee' && !employeeId) { toast.error('Please select an employee'); return; }
    setSaving(true);
    try {
      await api.post('/library/issues', {
        bookId,
        borrowerType,
        studentId: borrowerType === 'student' ? studentId : undefined,
        employeeId: borrowerType === 'employee' ? employeeId : undefined,
        dueDate,
      });
      toast.success('Book issued successfully');
      onSuccess();
    } catch (err) {
      toast.error(err?.message || 'Failed to issue book');
    } finally {
      setSaving(false);
    }
  };

  const selectedBook = availableBooks.find(b => b._id === bookId);

  return (
    <Modal
      open
      onClose={onClose}
      title="Issue Book"
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Issuing...' : 'Issue Book'}
          </button>
        </>
      }
    >
      {/* ── ISBN Scanner ─────────────────────────────────────────── */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
        padding: '12px 14px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Barcode size={16} style={{ color: '#0369a1', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>Scan Book Barcode</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input
            ref={scanRef}
            className="form-control"
            style={{ fontSize: 13 }}
            value={scanIsbn}
            onChange={e => setScanIsbn(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleIsbnScan(scanIsbn)}
            placeholder="Connect USB/BT scanner and scan, or type ISBN..."
          />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => handleIsbnScan(scanIsbn)}
            disabled={!scanIsbn.trim()}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Search size={13} /> Find</span>
          </button>
        </div>
        {scanMsg && (
          <p style={{ fontSize: 12, margin: '4px 0 0', color: scanMsg.ok ? '#15803d' : '#92400e' }}>
            {scanMsg.text}
          </p>
        )}
        {!scanMsg && (
          <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
            Scan to auto-select the book below
          </p>
        )}
      </div>

      {/* ── Book selector ────────────────────────────────────────── */}
      <div className="form-group">
        <label className="form-label">Select Book *</label>
        <AntSelect
          style={{ width: '100%' }}
          showSearch
          value={bookId || undefined}
          placeholder="Choose a book..."
          filterOption={(input, option) => {
            const q = input.toLowerCase();
            return (
              option.label?.toLowerCase().includes(q) ||
              option.author?.toLowerCase().includes(q) ||
              (option.isbn || '').toLowerCase().includes(q)
            );
          }}
          onChange={(id) => { setBookId(id); setScanMsg(null); }}
          options={availableBooks.map(b => ({ value: b._id, label: b.title, author: b.author, isbn: b.isbn, availableCopies: b.availableCopies }))}
          optionRender={(option) => (
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{option.data.label}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                {option.data.author}
                {option.data.isbn && <span> · {option.data.isbn}</span>}
                <span style={{ marginLeft: 8, fontWeight: 600, color: option.data.availableCopies > 0 ? '#10b981' : '#ef4444' }}>
                  {option.data.availableCopies} available
                </span>
              </div>
            </div>
          )}
          labelRender={({ value: v }) => {
            const book = availableBooks.find(b => b._id === v);
            return book ? `${book.title} — ${book.author}` : '';
          }}
        />
        {selectedBook && (
          <p style={{ fontSize: 12, color: '#15803d', marginTop: 5 }}>
            ✓ <strong>{selectedBook.title}</strong> · {selectedBook.availableCopies} cop{selectedBook.availableCopies === 1 ? 'y' : 'ies'} available
          </p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Borrower Type</label>
        <div style={{ display: 'flex', gap: 12 }}>
          {['student', 'employee'].map(t => (
            <button
              key={t}
              type="button"
              className={`btn btn-sm ${borrowerType === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBorrowerType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {borrowerType === 'student' && (
        <div className="form-group">
          <label className="form-label">Select Student *</label>
          <AntSelect
            style={{ width: '100%' }}
            showSearch
            value={studentId || undefined}
            placeholder="Choose student..."
            optionFilterProp="label"
            onChange={setStudentId}
            options={students.map(s => {
              const cls = s.currentClass ? `${s.currentClass.name} ${s.currentClass.section}` : null;
              const roll = s.rollNumber ? `Roll ${s.rollNumber}` : null;
              const sub = [cls, roll].filter(Boolean).join(' · ') || s.admissionNumber;
              return { value: s._id, label: s.name, sub };
            })}
            optionRender={(option) => (
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{option.data.label}</div>
                {option.data.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{option.data.sub}</div>}
              </div>
            )}
          />
        </div>
      )}

      {borrowerType === 'employee' && (
        <div className="form-group">
          <label className="form-label">Select Employee *</label>
          <AntSelect
            style={{ width: '100%' }}
            showSearch
            value={employeeId || undefined}
            placeholder="Choose employee..."
            optionFilterProp="label"
            onChange={setEmployeeId}
            options={employees.map(e => {
              const sub = [e.designation, e.role, e.employeeId].filter(Boolean).join(' · ');
              return { value: e._id, label: e.name, sub };
            })}
            optionRender={(option) => (
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{option.data.label}</div>
                {option.data.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{option.data.sub}</div>}
              </div>
            )}
          />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Due Date *</label>
        <input
          className="form-control"
          type="date"
          value={dueDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => setDueDate(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// ─── Mark Lost / Damaged Modal ────────────────────────────────────────────────

function MarkLostDamagedModal({ issue, onClose, onSuccess }) {
  const [status, setStatus] = useState('lost');
  const [fine, setFine] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/library/issues/${issue._id}/status`, {
        status,
        fine: fine ? Number(fine) : undefined,
        notes,
      });
      toast.success(`Book marked as ${status}`);
      onSuccess();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark as Lost / Damaged"
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Book</label>
        <div className="text-14-medium">{issue.book?.title}</div>
      </div>
      <div className="form-group">
        <label className="form-label">Status</label>
        <div style={{ display: 'flex', gap: 12 }}>
          {['lost', 'damaged'].map(s => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${status === s ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setStatus(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Fine Amount (₹)</label>
        <input className="form-control" type="number" value={fine} onChange={e => setFine(e.target.value)} placeholder="e.g. 200" />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-control" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
      </div>
    </Modal>
  );
}

// ─── Overdue Tab ──────────────────────────────────────────────────────────────

function OverdueTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['library-overdue'],
    queryFn: () => api.get('/library/overdue'),
  });
  const issues     = data?.issues    || [];
  const finePerDay = data?.finePerDay ?? 2; // from backend response

  const getColor = (days) => {
    if (days >= 7) return '#ef4444';
    return '#f97316';
  };

  return (
    <div>
      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Borrower</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Fine (₹{finePerDay}/day)</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={CheckCircle} message="No overdue books. All issues are within due dates." />
                    </td>
                  </tr>
                )}
                {issues.map(issue => {
                  const days = daysDiff(issue.dueDate);
                  const fine = issue.calculatedFine || calcFine(issue.dueDate, finePerDay);
                  const color = getColor(days);
                  return (
                    <tr key={issue._id} style={{ background: days >= 7 ? '#fef2f2' : '#fff7ed' }}>
                      <td>
                        <div className="text-14-medium">{issue.book?.title || '—'}</div>
                        <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{issue.book?.author}</div>
                      </td>
                      <td>
                        <div className="text-14-regular">{borrowerName(issue)}</div>
                        <span className="badge badge-secondary" style={{ fontSize: 11 }}>{issue.borrowerType}</span>
                      </td>
                      <td className="text-14-regular">{fmt(issue.issueDate)}</td>
                      <td className="text-14-medium" style={{ color }}>{fmt(issue.dueDate)}</td>
                      <td>
                        <span className="text-14-bold" style={{ color }}>{days} days</span>
                      </td>
                      <td className="text-14-bold" style={{ color }}>₹{fine}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Renewals Tab ─────────────────────────────────────────────────────────────

function RenewalsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['library-renewals'],
    queryFn: () => api.get('/library/issues'),
  });

  // Collect all pending renewals across all issues
  const pendingRenewals = [];
  (data?.issues || []).forEach(issue => {
    (issue.renewalRequests || []).forEach(r => {
      if (r.status === 'pending') {
        pendingRenewals.push({ issue, renewal: r });
      }
    });
  });

  const [approveItem, setApproveItem] = useState(null);
  const [rejectItem, setRejectItem] = useState(null);

  return (
    <div>
      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Borrower</th>
                  <th>Current Due</th>
                  <th>Requested New Due</th>
                  <th>Requested At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRenewals.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={RotateCcw} message="No pending renewal requests." />
                    </td>
                  </tr>
                )}
                {pendingRenewals.map(({ issue, renewal }) => (
                  <tr key={renewal._id}>
                    <td>
                      <div className="text-14-medium">{issue.book?.title || '—'}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{issue.book?.author}</div>
                    </td>
                    <td>
                      <div className="text-14-regular">{borrowerName(issue)}</div>
                      <span className="badge badge-secondary" style={{ fontSize: 11 }}>{issue.borrowerType}</span>
                    </td>
                    <td className="text-14-regular">{fmt(issue.dueDate)}</td>
                    <td className="text-14-medium" style={{ color: 'var(--primary)' }}>{fmt(renewal.newDueDate)}</td>
                    <td className="text-14-regular">{fmt(renewal.requestedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => setApproveItem({ issue, renewal })}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setRejectItem({ issue, renewal })}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {approveItem && (
        <ApproveRenewalModal
          issue={approveItem.issue}
          renewal={approveItem.renewal}
          onClose={() => setApproveItem(null)}
          onSuccess={() => { qc.invalidateQueries(['library-renewals']); qc.invalidateQueries(['library-issues']); setApproveItem(null); }}
        />
      )}

      {rejectItem && (
        <RejectRenewalModal
          issue={rejectItem.issue}
          renewal={rejectItem.renewal}
          onClose={() => setRejectItem(null)}
          onSuccess={() => { qc.invalidateQueries(['library-renewals']); qc.invalidateQueries(['library-issues']); setRejectItem(null); }}
        />
      )}
    </div>
  );
}

// ─── Approve Renewal Modal ────────────────────────────────────────────────────

function ApproveRenewalModal({ issue, renewal, onClose, onSuccess }) {
  const [newDueDate, setNewDueDate] = useState(
    renewal.newDueDate ? new Date(renewal.newDueDate).toISOString().split('T')[0] : ''
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!newDueDate) { toast.error('New due date is required'); return; }
    setSaving(true);
    try {
      await api.put(`/library/issues/${issue._id}/renewal/${renewal._id}`, {
        action: 'approve', newDueDate, note,
      });
      toast.success('Renewal approved');
      onSuccess();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Approve Renewal"
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Approving...' : 'Approve'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Book</label>
        <div className="text-14-medium">{issue.book?.title}</div>
      </div>
      <div className="form-group">
        <label className="form-label">New Due Date *</label>
        <input
          className="form-control"
          type="date"
          value={newDueDate}
          onChange={e => setNewDueDate(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Note (optional)</label>
        <input className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note to borrower" />
      </div>
    </Modal>
  );
}

// ─── Reject Renewal Modal ─────────────────────────────────────────────────────

function RejectRenewalModal({ issue, renewal, onClose, onSuccess }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/library/issues/${issue._id}/renewal/${renewal._id}`, {
        action: 'reject', note,
      });
      toast.success('Renewal rejected');
      onSuccess();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Reject Renewal"
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Rejecting...' : 'Reject'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Book</label>
        <div className="text-14-medium">{issue.book?.title}</div>
      </div>
      <div className="form-group">
        <label className="form-label">Reason for Rejection (optional)</label>
        <input className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="Reason..." />
      </div>
    </Modal>
  );
}

// ─── Issue Status Badge ───────────────────────────────────────────────────────

function IssueStatusBadge({ status }) {
  const map = {
    issued:   'info',
    returned: 'success',
    overdue:  'danger',
    lost:     'danger',
    damaged:  'warning',
  };
  return (
    <span className={`badge badge-${map[status] || 'secondary'}`}>
      {status?.toUpperCase()}
    </span>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [detailModal, setDetailModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['library-reports'],
    queryFn: () => api.get('/library/reports'),
  });

  const r = data?.report || {};

  if (isLoading) return <PageLoader />;

  const cards = [
    {
      label: 'Books Available',
      value: `${r.availableCopies ?? 0} / ${r.totalCopies ?? 0}`,
      sub: `${r.totalBooks ?? 0} titles in library`,
      color: '#1a56e8',
      bg: '#eff6ff',
    },
    {
      label: 'Fines Collected',
      value: `₹${r.collectedFines ?? 0}`,
      sub: `Total fines: ₹${r.totalFines ?? 0}`,
      color: '#10b981',
      bg: '#f0fdf4',
      issues: r.finesPaid,
      modalTitle: 'Fines Collected',
      columns: 'fines',
    },
    {
      label: 'Currently Overdue',
      value: r.overdueCount ?? 0,
      sub: 'Books not returned yet',
      color: '#ef4444',
      bg: '#fef2f2',
      issues: r.currentlyOverdue,
      modalTitle: 'Currently Overdue',
      columns: 'overdue',
    },
    {
      label: 'Submitted on Overdue Dates',
      value: r.returnedLateCount ?? 0,
      sub: 'Returned past due date',
      color: '#f97316',
      bg: '#fff7ed',
      issues: r.overdueReturned,
      modalTitle: 'Submitted on Overdue Dates',
      columns: 'returned-late',
    },
    {
      label: 'Books Damaged',
      value: r.damagedCount ?? 0,
      sub: 'Reported as damaged',
      color: '#f59e0b',
      bg: '#fefce8',
      issues: r.damaged,
      modalTitle: 'Books Damaged',
      columns: 'damaged',
    },
    {
      label: 'Books Lost',
      value: r.lostCount ?? 0,
      sub: 'Reported as lost',
      color: '#7c3aed',
      bg: '#f5f3ff',
      issues: r.lost,
      modalTitle: 'Books Lost',
      columns: 'lost',
    },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {cards.map(card => (
          <ReportCard
            key={card.label}
            label={card.label}
            value={card.value}
            sub={card.sub}
            color={card.color}
            bg={card.bg}
            onView={card.issues !== undefined
              ? () => setDetailModal({ title: card.modalTitle, issues: card.issues || [], columns: card.columns })
              : null}
          />
        ))}
      </div>

      {detailModal && (
        <ReportDetailModal
          title={detailModal.title}
          issues={detailModal.issues}
          columns={detailModal.columns}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}

function ReportCard({ label, value, sub, color, bg, onView }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
        </div>
        {onView && (
          <button
            onClick={onView}
            style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color, flexShrink: 0 }}
            title="View details"
          >
            <Eye size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function ReportDetailModal({ title, issues, columns, onClose }) {
  return (
    <Modal open onClose={onClose} title={title} size="lg">
      {issues.length === 0 ? (
        <EmptyState icon={BookOpen} message="No records found." />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Book</th>
                {columns === 'fines' && (
                  <><th>Fine (₹)</th><th>Date</th></>
                )}
                {columns === 'overdue' && (
                  <><th>Due Date</th><th>Days Overdue</th></>
                )}
                {columns === 'returned-late' && (
                  <><th>Due Date</th><th>Return Date</th><th>Fine (₹)</th></>
                )}
                {(columns === 'damaged' || columns === 'lost') && (
                  <><th>Fine (₹)</th><th>Date</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => {
                const name = issue.borrowerType === 'student'
                  ? issue.student?.name
                  : issue.employee?.name;
                return (
                  <tr key={issue._id}>
                    <td>
                      <div className="text-14-medium">{name || '—'}</div>
                      <span className="badge badge-secondary" style={{ fontSize: 11 }}>{issue.borrowerType}</span>
                    </td>
                    <td>
                      <div className="text-14-medium">{issue.book?.title || '—'}</div>
                      {issue.book?.author && (
                        <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{issue.book.author}</div>
                      )}
                    </td>
                    {columns === 'fines' && (
                      <>
                        <td className="text-14-bold" style={{ color: '#10b981' }}>₹{issue.fine}</td>
                        <td className="text-14-regular">{fmt(issue.updatedAt)}</td>
                      </>
                    )}
                    {columns === 'overdue' && (
                      <>
                        <td className="text-14-medium" style={{ color: '#ef4444' }}>{fmt(issue.dueDate)}</td>
                        <td className="text-14-bold" style={{ color: '#ef4444' }}>{daysDiff(issue.dueDate)} days</td>
                      </>
                    )}
                    {columns === 'returned-late' && (
                      <>
                        <td className="text-14-regular">{fmt(issue.dueDate)}</td>
                        <td className="text-14-regular">{fmt(issue.returnDate)}</td>
                        <td className="text-14-regular">{issue.fine ? `₹${issue.fine}` : '—'}</td>
                      </>
                    )}
                    {(columns === 'damaged' || columns === 'lost') && (
                      <>
                        <td className="text-14-regular">{issue.fine ? `₹${issue.fine}` : '—'}</td>
                        <td className="text-14-regular">{fmt(issue.updatedAt)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
