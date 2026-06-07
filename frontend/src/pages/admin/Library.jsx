import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, RefreshCw, AlertTriangle, CheckCircle, BookMarked, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../utils/api';
import {
  Modal, ConfirmDialog, StatusBadge, PageLoader, EmptyState,
  StatCard, FormRow, Avatar, SearchInput,
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
  const [tab, setTab] = useState('books');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-subtitle">Manage books, issues, returns and renewals</p>
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

      {tab === 'books'    && <BooksTab />}
      {tab === 'issued'   && <IssuedTab />}
      {tab === 'overdue'  && <OverdueTab />}
      {tab === 'renewals' && <RenewalsTab />}
      {tab === 'reports'  && <ReportsTab />}
    </div>
  );
}

// ─── Books Tab ─────────────────────────────────────────────────────────────────

function BooksTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [deleteBook, setDeleteBook] = useState(null);
  const [deleteError, setDeleteError] = useState('');

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

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/library/books/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['library-books']);
      toast.success('Book deleted');
      setDeleteBook(null);
      setDeleteError('');
    },
    onError: (err) => {
      setDeleteError(err?.message || 'Cannot delete this book');
    },
  });

  const handleDelete = (book) => {
    setDeleteError('');
    setDeleteBook(book);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => { setEditBook(null); setShowModal(true); }}>
          <Plus size={16} /> Add Book
        </button>
      </div>
      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title, author, ISBN..." />
        <select className="form-control" style={{ width: 'auto' }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {BOOK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title / Author</th>
                  <th>ISBN</th>
                  <th>Category</th>
                  <th>Total / Available</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={BookOpen} message="No books found. Add your first book to get started." />
                    </td>
                  </tr>
                )}
                {books.map(book => (
                  <tr key={book._id}>
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditBook(book); setShowModal(true); }}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(book)}>
                          Delete
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

      {showModal && (
        <BookModal
          book={editBook}
          onClose={() => { setShowModal(false); setEditBook(null); }}
          onSuccess={() => { qc.invalidateQueries(['library-books']); setShowModal(false); setEditBook(null); }}
        />
      )}

      {deleteBook && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
              <h3 style={{ marginBottom: 8 }}>Delete Book</h3>
              <p className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>{deleteBook.title}</strong>?
              </p>
              {deleteError && (
                <p className="text-13-regular" style={{ color: '#ef4444', marginTop: 12 }}>{deleteError}</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeleteBook(null); setDeleteError(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => deleteMutation.mutate(deleteBook._id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
          <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Select category</option>
            {BOOK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
          <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </FormRow>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description..." />
      </div>
    </Modal>
  );
}

// ─── Issued Tab ───────────────────────────────────────────────────────────────

function IssuedTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [returnIssue, setReturnIssue] = useState(null);
  const [statusIssue, setStatusIssue] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['library-issues', statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowIssueModal(true)}>
          <Plus size={16} /> Issue Book
        </button>
      </div>
      <div className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="issued">Issued</option>
          <option value="returned">Returned</option>
          <option value="lost">Lost</option>
          <option value="damaged">Damaged</option>
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Borrowers</option>
          <option value="student">Student</option>
          <option value="employee">Employee</option>
        </select>
      </div>

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
                  <th>Return Date</th>
                  <th>Status</th>
                  <th>Fine</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={BookMarked} message="No issue records found." />
                    </td>
                  </tr>
                )}
                {issues.map(issue => (
                  <tr key={issue._id}>
                    <td>
                      <div className="text-14-medium">{issue.book?.title || '—'}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>{issue.book?.author}</div>
                    </td>
                    <td>
                      <div className="text-14-regular">{borrowerName(issue)}</div>
                      <span className="badge badge-secondary" style={{ fontSize: 11 }}>{issue.borrowerType}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
      <div className="form-group">
        <label className="form-label">Select Book *</label>
        <select className="form-control" value={bookId} onChange={e => setBookId(e.target.value)}>
          <option value="">Choose a book...</option>
          {availableBooks.map(b => (
            <option key={b._id} value={b._id}>
              {b.title} — {b.author} ({b.availableCopies} available)
            </option>
          ))}
        </select>
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
          <select className="form-control" value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Choose student...</option>
            {students.map(s => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.admissionNumber})
              </option>
            ))}
          </select>
        </div>
      )}

      {borrowerType === 'employee' && (
        <div className="form-group">
          <label className="form-label">Select Employee *</label>
          <select className="form-control" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">Choose employee...</option>
            {employees.map(e => (
              <option key={e._id} value={e._id}>
                {e.name} ({e.employeeId})
              </option>
            ))}
          </select>
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
                  <th>Fine (₹2/day)</th>
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

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['library-reports'],
    queryFn: () => api.get('/library/reports'),
  });
  const report = data?.report || {};

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total Books" value={report.totalBooks ?? 0} icon={BookOpen} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Total Copies" value={report.totalCopies ?? 0} icon={BookOpen} color="#8b5cf6" bg="#faf5ff" />
        <StatCard title="Available Copies" value={report.availableCopies ?? 0} icon={CheckCircle} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Currently Issued" value={report.issuedCount ?? 0} icon={BookMarked} color="#f97316" bg="#fff7ed" />
      </div>
      <div className="grid-4">
        <StatCard title="Overdue" value={report.overdueCount ?? 0} icon={AlertTriangle} color="#ef4444" bg="#fef2f2" />
        <StatCard title="Returned" value={report.returnedCount ?? 0} icon={RefreshCw} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Total Fines" value={`₹${(report.totalFines ?? 0).toLocaleString('en-IN')}`} icon={AlertTriangle} color="#f59e0b" bg="#fffbeb" />
        <StatCard title="Fines Collected" value={`₹${(report.collectedFines ?? 0).toLocaleString('en-IN')}`} icon={CheckCircle} color="#10b981" bg="#f0fdf4" />
      </div>
    </div>
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
