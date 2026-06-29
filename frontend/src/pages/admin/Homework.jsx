import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Plus, Edit2, Bell, Calendar, Users, CheckCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { format } from 'date-fns';
import api from '../../utils/api';
import { PageLoader, EmptyState, Modal, FormRow, StatCard, SearchInput } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';
import { useYear } from '../../store/YearContext';

const STATUS_BADGE = { completed: 'badge-success', cancelled: 'badge-danger' };
const STATUS_STYLE = {
  active: { background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' },
};

const SUB_STATUS = [
  { value: 'pending',     label: 'Pending',     color: '#dc2626', bg: '#fef2f2' },
  { value: 'in_progress', label: 'In Progress', color: '#d97706', bg: '#fef3c7' },
  { value: 'completed',   label: 'Completed',   color: '#16a34a', bg: '#dcfce7' },
];
const getSubStatus = v => SUB_STATUS.find(s => s.value === v) || SUB_STATUS[0];

export default function Homework() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { selectedYear, range } = useYear();
  const [activeClass, setActiveClass] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editHw, setEditHw] = useState(null);
  const [viewHwId, setViewHwId] = useState(null);

  const canManage = ['admin', 'correspondent', 'principal', 'teacher'].includes(user?.role);
  const today = new Date().toISOString().split('T')[0];

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: allHwData } = useQuery({
    queryKey: ['homework-all', selectedYear],
    queryFn: () => api.get(`/homework?startDate=${range.startDate}&endDate=${range.endDate}`),
  });
  const allHw = allHwData?.homework || [];

  const { data: countData } = useQuery({
    queryKey: ['homework-counts', selectedYear, dateFilter, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (dateFilter) p.set('date', dateFilter);
      else { p.set('startDate', range.startDate); p.set('endDate', range.endDate); }
      if (statusFilter) p.set('status', statusFilter);
      return api.get(`/homework?${p}`);
    },
  });
  const filteredAll = countData?.homework || [];

  const { data: hwData, isLoading } = useQuery({
    queryKey: ['homework', selectedYear, activeClass, dateFilter, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (activeClass !== 'all') p.set('classId', activeClass);
      if (dateFilter) p.set('date', dateFilter);
      else { p.set('startDate', range.startDate); p.set('endDate', range.endDate); }
      if (statusFilter) p.set('status', statusFilter);
      return api.get(`/homework?${p}`);
    },
  });
  const homework = hwData?.homework || [];

  // Client-side search over the fetched list (title or subject)
  const displayHw = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return homework;
    return homework.filter(hw =>
      hw.title?.toLowerCase().includes(q) || hw.subject?.name?.toLowerCase().includes(q));
  }, [homework, search]);

  const stepDate = (delta) => setDateFilter(dayjs(dateFilter || undefined).add(delta, 'day').format('YYYY-MM-DD'));

  const classCounts = useMemo(() => {
    const map = {};
    filteredAll.forEach(hw => { const id = hw.class?._id; if (id) map[id] = (map[id] || 0) + 1; });
    return map;
  }, [filteredAll]);

  const statsActive = allHw.filter(h => h.status === 'active').length;
  const statsDueToday = allHw.filter(h => new Date(h.dueDate).toISOString().split('T')[0] === today && h.status === 'active').length;

  const hasFilters = statusFilter || dateFilter;

  const invalidateAll = () => {
    qc.invalidateQueries(['homework']);
    qc.invalidateQueries(['homework-all']);
    qc.invalidateQueries(['homework-counts']);
  };

  // Show full-page detail when a homework is selected
  if (viewHwId) {
    return (
      <HomeworkDetail
        hwId={viewHwId}
        classes={classes}
        canManage={canManage}
        onBack={() => { setViewHwId(null); invalidateAll(); }}
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Homework</h1>
          <p className="page-subtitle">Assign and track homework for each class</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Add Homework
          </button>
        )}
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <StatCard title="Total Assignments" value={allHw.length} icon={BookMarked} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Active" value={statsActive} icon={CheckCircle} color="#16a34a" bg="#dcfce7" />
        <StatCard title="Due Today" value={statsDueToday} icon={Bell} color="#d97706" bg="#fef3c7" />
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search homework by title or subject..." />
        <AntSelect
          style={{ width: 160 }}
          value={statusFilter || undefined}
          placeholder="All Status"
          allowClear
          onChange={val => setStatusFilter(val ?? '')}
          options={[
            { value: 'active',    label: 'Active' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        {/* Date navigator pushed to the end of the bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-secondary btn-sm btn-icon" title="Previous day" onClick={() => stepDate(-1)}>
            <ChevronLeft size={16} />
          </button>
          <DatePicker
            style={{ width: 170 }}
            format="DD MMM YYYY"
            placeholder="All dates"
            value={dateFilter ? dayjs(dateFilter) : null}
            onChange={(d) => setDateFilter(d ? d.format('YYYY-MM-DD') : '')}
            getPopupContainer={() => document.body}
          />
          <button className="btn btn-secondary btn-sm btn-icon" title="Next day" onClick={() => stepDate(1)}>
            <ChevronRight size={16} />
          </button>
          {dateFilter && (
            <button className="btn btn-secondary btn-sm" onClick={() => setDateFilter('')}>Clear</button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeClass === 'all' ? 'active' : ''}`} onClick={() => setActiveClass('all')}>
          All
          <span style={{ marginLeft: 6, background: activeClass === 'all' ? 'var(--primary)' : '#e2e8f0', color: activeClass === 'all' ? '#fff' : 'var(--text-secondary)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
            {filteredAll.length}
          </span>
        </button>
        {classes.map(cls => (
          <button key={cls._id} className={`tab ${activeClass === cls._id ? 'active' : ''}`}
            onClick={() => setActiveClass(cls._id)}>
            {cls.name} {cls.section}
            {classCounts[cls._id] > 0 && (
              <span style={{ marginLeft: 6, background: activeClass === cls._id ? 'var(--primary)' : '#e2e8f0', color: activeClass === cls._id ? '#fff' : 'var(--text-secondary)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                {classCounts[cls._id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, marginTop: 20 }}>
        {isLoading ? (
          <div style={{ padding: 48 }}><PageLoader /></div>
        ) : displayHw.length === 0 ? (
          <EmptyState icon={BookMarked} message={allHw.length === 0 ? 'No homework assigned yet' : 'No homework matches the current filters'} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Assigned Date</th>
                  <th>Due Date</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  {canManage && <th style={{ width: 48 }} />}
                </tr>
              </thead>
              <tbody>
                {displayHw.map(hw => {
                  const isOverdue = new Date(hw.dueDate) < new Date() && hw.status === 'active';
                  return (
                    <tr key={hw._id} onClick={() => setViewHwId(hw._id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{hw.title}</div>
                        {hw.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {hw.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {hw.subject ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            {hw.subject.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: hw.subject.color, flexShrink: 0 }} />}
                            {hw.subject.name}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>{hw.class?.name} {hw.class?.section}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {hw.assignedDate ? format(new Date(hw.assignedDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: isOverdue ? 700 : 400, color: isOverdue ? '#dc2626' : 'var(--text-primary)' }}>
                          {format(new Date(hw.dueDate), 'dd MMM yyyy')}
                        </span>
                        {isOverdue && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>OVERDUE</div>}
                      </td>
                      <td>
                        <span className={`badge ${hw.assignedTo === 'all' ? 'badge-info' : 'badge-secondary'}`}>
                          {hw.assignedTo === 'all' ? 'All Students' : `${hw.students?.length || 0} Students`}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[hw.status] || 'badge-secondary'}`} style={{ textTransform: 'capitalize', ...(STATUS_STYLE[hw.status] || {}) }}>
                          {hw.status}
                        </span>
                      </td>
                      {canManage && (
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-secondary btn-sm btn-icon" title="Edit"
                            onClick={() => setEditHw(hw)}>
                            <Edit2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <AddEditModal
          hw={null}
          classes={classes}
          onClose={() => setAddOpen(false)}
          onSaved={() => { invalidateAll(); setAddOpen(false); }}
        />
      )}
      {editHw && (
        <AddEditModal
          hw={editHw}
          classes={classes}
          onClose={() => setEditHw(null)}
          onSaved={() => { invalidateAll(); setEditHw(null); }}
        />
      )}
    </div>
  );
}

// ─── Full-page Homework Detail ─────────────────────────────────────────────────
function HomeworkDetail({ hwId, classes, canManage, onBack }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [localStatuses, setLocalStatuses] = useState({});
  const [uploadingFor, setUploadingFor] = useState(null);

  const { data: hwData, isLoading: hwLoading } = useQuery({
    queryKey: ['homework-detail', hwId],
    queryFn: () => api.get(`/homework/${hwId}`),
  });
  const hw = hwData?.homework;

  const classId = hw?.class?._id;
  const { data: studentData } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => api.get(`/students?classId=${classId}&limit=300`),
    enabled: !!classId && hw?.assignedTo === 'all',
  });

  const students = hw?.assignedTo === 'all'
    ? (studentData?.students || [])
    : (hw?.students || []);

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['hw-submissions', hwId],
    queryFn: () => api.get(`/homework/${hwId}/submissions`),
    enabled: !!hwId,
  });
  const submissions = subData?.submissions || [];

  const getSub = studentId => submissions.find(s =>
    (s.student?._id || s.student)?.toString() === studentId?.toString()
  );

  const updateStatus = useMutation({
    mutationFn: ({ studentId, status }) =>
      api.put(`/homework/${hwId}/submissions/${studentId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries(['hw-submissions', hwId]);
      qc.invalidateQueries(['homework-detail', hwId]);
    },
    onError: () => toast.error('Failed to update'),
  });

  const markAllCompleted = async () => {
    const uncompleted = students.filter(s => getSub(s._id)?.status !== 'completed');
    if (uncompleted.length === 0) return toast('All students already completed');
    try {
      await Promise.all(uncompleted.map(s => updateStatus.mutateAsync({ studentId: s._id, status: 'completed' })));
      toast.success(`${uncompleted.length} students marked as completed`);
    } catch { toast.error('Some updates failed'); }
  };

  const enterEditMode = () => {
    const map = {};
    students.forEach(s => { map[s._id] = getSub(s._id)?.status || 'pending'; });
    setLocalStatuses(map);
    setEditStatusMode(true);
  };

  const markAll = status => {
    const map = {};
    students.forEach(s => { map[s._id] = status; });
    setLocalStatuses(map);
  };

  const saveStatuses = async () => {
    try {
      await Promise.all(
        students.map(s => updateStatus.mutateAsync({ studentId: s._id, status: localStatuses[s._id] || 'pending' }))
      );
      toast.success('Statuses updated!');
      setEditStatusMode(false);
    } catch { toast.error('Some updates failed'); }
  };

  const handleUpload = async (studentId, file) => {
    setUploadingFor(studentId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/homework/${hwId}/submissions/${studentId}/attachment`, formData, {
        headers: { 'Content-Type': undefined },
      });
      qc.invalidateQueries(['hw-submissions', hwId]);
      toast.success('File uploaded!');
    } catch { toast.error('Upload failed'); }
    finally { setUploadingFor(null); }
  };

  const handleDeleteAttachment = async (studentId, attachmentId) => {
    try {
      await api.delete(`/homework/${hwId}/submissions/${studentId}/attachment/${attachmentId}`);
      qc.invalidateQueries(['hw-submissions', hwId]);
      toast.success('Attachment removed');
    } catch { toast.error('Failed to remove attachment'); }
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/homework/${hwId}`),
    onSuccess: () => { toast.success('Deleted'); onBack(); },
    onError: () => toast.error('Failed to delete'),
  });

  const notifyMutation = useMutation({
    mutationFn: () => api.post(`/homework/${hwId}/notify`),
    onSuccess: res => toast.success(res.message || 'Notified!'),
    onError: err => toast.error(err.message || 'Failed'),
  });

  if (hwLoading) return <div style={{ padding: 60 }}><PageLoader /></div>;
  if (!hw) return <div className="card"><EmptyState icon={BookMarked} message="Homework not found" /></div>;

  const isOverdue = new Date(hw.dueDate) < new Date() && hw.status === 'active';
  const completedCount = students.filter(s => getSub(s._id)?.status === 'completed').length;
  const inProgressCount = students.filter(s => getSub(s._id)?.status === 'in_progress').length;
  const pendingCount = students.length - completedCount - inProgressCount;

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexShrink: 0 }}>
          <ChevronLeft size={15} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{hw.title}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`badge ${STATUS_BADGE[hw.status] || 'badge-secondary'}`} style={{ textTransform: 'capitalize', ...(STATUS_STYLE[hw.status] || {}) }}>{hw.status}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{hw.class?.name} {hw.class?.section}</span>
            {hw.subject && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                {hw.subject.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: hw.subject.color }} />}
                {hw.subject.name}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => notifyMutation.mutate()}
              disabled={notifyMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={14} /> {notifyMutation.isPending ? 'Sending...' : 'Notify Parents'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit2 size={14} /> Edit
            </button>
            <button className="btn btn-danger btn-sm"
              onClick={() => { if (window.confirm('Delete this homework?')) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div className="grid-2" style={{ marginBottom: hw.description ? 16 : 0 }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Assigned Date</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{hw.assignedDate ? format(new Date(hw.assignedDate), 'dd MMM yyyy') : '—'}</div>
          </div>
          <div style={{ background: isOverdue ? '#fef2f2' : '#f8fafc', borderRadius: 10, padding: '12px 16px', border: `1px solid ${isOverdue ? '#fecaca' : 'var(--border)'}` }}>
            <div style={{ fontSize: 11, color: isOverdue ? '#dc2626' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Due Date{isOverdue ? ' · OVERDUE' : ''}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isOverdue ? '#dc2626' : 'var(--text-primary)' }}>
              {format(new Date(hw.dueDate), 'dd MMM yyyy')}
            </div>
          </div>
        </div>
        {hw.description && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', whiteSpace: 'pre-line' }}>
              {hw.description}
            </div>
          </div>
        )}
        {hw.createdBy && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Created by <strong style={{ color: 'var(--text-secondary)' }}>{hw.createdBy.name}</strong></span>
            <span>{format(new Date(hw.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
            {hw.notifiedAt && (
              <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Bell size={11} /> Parents notified {format(new Date(hw.notifiedAt), 'dd MMM yyyy')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Students list */}
      <div className="card" style={{ padding: 0 }}>
        {/* Card header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Students &nbsp;<span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>({students.length})</span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                {completedCount} Completed
              </span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#d97706', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
                {inProgressCount} In Progress
              </span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#dc2626', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                {pendingCount} Pending
              </span>
            </div>
          </div>
          {canManage && students.length > 0 && (
            editStatusMode ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => markAll('completed')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> Mark All Completed
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => markAll('pending')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Mark All Uncompleted
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveStatuses}
                  disabled={updateStatus.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {updateStatus.isPending ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditStatusMode(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={enterEditMode}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit2 size={14} /> Edit Homework
              </button>
            )
          )}
        </div>

        {subLoading || (hw.assignedTo === 'all' && !studentData) ? (
          <div style={{ padding: 32 }}><PageLoader /></div>
        ) : students.length === 0 ? (
          <EmptyState icon={Users} message="No students assigned" />
        ) : (
          <div className="table-container" style={{ borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Student</th>
                  <th>Admission No.</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const sub = getSub(student._id);
                  const statusVal = sub?.status || 'pending';
                  const st = getSubStatus(statusVal);
                  return (
                    <tr key={student._id}>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{student.name}</div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{student.admissionNumber || '—'}</td>
                      <td>
                        {editStatusMode ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {SUB_STATUS.map(opt => {
                              const current = localStatuses[student._id] || 'pending';
                              return (
                                <button key={opt.value}
                                  onClick={() => setLocalStatuses(prev => ({ ...prev, [student._id]: opt.value }))}
                                  style={{
                                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                    border: `1.5px solid ${current === opt.value ? opt.color : 'var(--border)'}`,
                                    background: current === opt.value ? opt.bg : 'white',
                                    color: current === opt.value ? opt.color : 'var(--text-muted)',
                                    transition: 'all 0.15s',
                                  }}>
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />
                            {statusVal === 'in_progress' ? 'In Progress' : statusVal.charAt(0).toUpperCase() + statusVal.slice(1)}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {sub?.submittedAt ? format(new Date(sub.submittedAt), 'dd MMM, hh:mm a') : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {sub?.attachments?.map((att, i) => (
                            <div key={att._id || i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <a href={att.url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>
                                [{att.fileType === 'image' ? 'IMG' : 'PDF'}] {att.name || `File ${i + 1}`}
                              </a>
                              {editStatusMode && (
                                <button onClick={() => handleDeleteAttachment(student._id, att._id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                                  title="Remove attachment">
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          {editStatusMode ? (
                            <>
                              <input type="file" id={`hw-att-${student._id}`} style={{ display: 'none' }}
                                accept="image/*,.pdf"
                                onChange={e => { const f = e.target.files[0]; if (f) { handleUpload(student._id, f); e.target.value = ''; } }} />
                              <label htmlFor={`hw-att-${student._id}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: uploadingFor === student._id ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600,
                                  padding: '3px 10px', borderRadius: 6, border: '1.5px dashed var(--border)', color: 'var(--text-secondary)', background: 'white', width: 'fit-content' }}>
                                {uploadingFor === student._id ? 'Uploading...' : '+ Upload'}
                              </label>
                            </>
                          ) : (
                            !sub?.attachments?.length && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {students.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {completedCount}/{students.length} students completed this homework
            </span>
          </div>
        )}
      </div>

      {editOpen && (
        <AddEditModal
          hw={hw}
          classes={classes}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            qc.invalidateQueries(['homework-detail', hwId]);
          }}
        />
      )}
    </div>
  );
}

// ─── Add / Edit Modal ──────────────────────────────────────────────────────────
function AddEditModal({ hw, classes, onClose, onSaved }) {
  const isEdit = !!hw;
  const [classId, setClassId] = useState(hw?.class?._id || hw?.class || '');
  const [subjectId, setSubjectId] = useState(hw?.subject?._id || hw?.subject || '');
  const [title, setTitle] = useState(hw?.title || '');
  const [description, setDescription] = useState(hw?.description || '');
  const [assignedDate, setAssignedDate] = useState(
    hw?.assignedDate ? new Date(hw.assignedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(hw?.dueDate ? new Date(hw.dueDate).toISOString().split('T')[0] : '');
  const [assignedTo, setAssignedTo] = useState(hw?.assignedTo || 'all');
  const [selectedStudents, setSelectedStudents] = useState((hw?.students || []).map(s => s._id || s));
  const [status, setStatus] = useState(hw?.status || 'active');
  const [saving, setSaving] = useState(false);

  const { data: subjectData } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/subjects') });
  const subjects = subjectData?.subjects || [];

  const { data: studentData } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => api.get(`/students?classId=${classId}&limit=200`),
    enabled: !!classId && assignedTo === 'selected',
  });
  const students = studentData?.students || [];

  const allSelected = selectedStudents.length === students.length && students.length > 0;
  const toggleStudent = id => setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedStudents(allSelected ? [] : students.map(s => s._id));

  const save = async () => {
    if (!classId) return toast.error('Select a class');
    if (!title.trim()) return toast.error('Enter a title');
    if (!dueDate) return toast.error('Select a due date');
    setSaving(true);
    try {
      const payload = { class: classId, subject: subjectId || null, title: title.trim(), description: description.trim(), assignedDate, dueDate, assignedTo, students: assignedTo === 'selected' ? selectedStudents : [], status };
      if (isEdit) await api.put(`/homework/${hw._id}`, payload);
      else await api.post('/homework', payload);
      toast.success(isEdit ? 'Homework updated!' : 'Homework added!');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Homework' : 'Add Homework'} size="md"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Homework'}
        </button>
      </>}>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Class *</label>
          <AntSelect
            style={{ width: '100%' }}
            value={classId || undefined}
            placeholder="Select class"
            showSearch
            optionFilterProp="label"
            onChange={val => { setClassId(val ?? ''); setSelectedStudents([]); }}
            options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <AntSelect
            style={{ width: '100%' }}
            value={subjectId || undefined}
            placeholder="Select subject"
            allowClear
            showSearch
            optionFilterProp="label"
            onChange={val => setSubjectId(val ?? '')}
            options={subjects.map(s => ({ value: s._id, label: s.name }))}
          />
        </div>
      </FormRow>

      <div className="form-group">
        <label className="form-label">Title *</label>
        <input className="form-control" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Chapter 5 — Exercise 1 to 10" />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={3} value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Additional instructions, page numbers, notes..." style={{ resize: 'vertical' }} />
      </div>

      <FormRow>
        <div className="form-group">
          <label className="form-label">Assigned Date</label>
          <DatePicker
            style={{ width: '100%' }}
            format="DD MMM YYYY"
            placeholder="Select assigned date"
            value={assignedDate ? dayjs(assignedDate) : null}
            onChange={(d) => setAssignedDate(d ? d.format('YYYY-MM-DD') : '')}
            getPopupContainer={() => document.body}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Due Date *</label>
          <DatePicker
            style={{ width: '100%' }}
            format="DD MMM YYYY"
            placeholder="Select due date"
            value={dueDate ? dayjs(dueDate) : null}
            onChange={(d) => setDueDate(d ? d.format('YYYY-MM-DD') : '')}
            disabledDate={(d) => assignedDate && d && d < dayjs(assignedDate).startOf('day')}
            getPopupContainer={() => document.body}
          />
        </div>
      </FormRow>

      {isEdit && (
        <div className="form-group">
          <label className="form-label">Status</label>
          <AntSelect
            style={{ width: '100%' }}
            value={status}
            onChange={val => setStatus(val)}
            options={[
              { value: 'active',    label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Assign To</label>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['all', 'All Students'], ['selected', 'Select Students']].map(([val, label]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" name="assignedTo" value={val} checked={assignedTo === val}
                onChange={() => { setAssignedTo(val); setSelectedStudents([]); }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {assignedTo === 'selected' && classId && (
        <div className="form-group">
          <label className="form-label">
            Select Students
            {selectedStudents.length > 0 && <span style={{ color: 'var(--primary)', marginLeft: 6 }}>({selectedStudents.length} selected)</span>}
          </label>
          {students.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No students in this class</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                Select All ({students.length})
              </label>
              {students.map(s => (
                <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13, background: selectedStudents.includes(s._id) ? '#eff6ff' : 'white' }}>
                  <input type="checkbox" checked={selectedStudents.includes(s._id)} onChange={() => toggleStudent(s._id)} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.admissionNumber}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {assignedTo === 'selected' && !classId && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 12 }}>Select a class first to pick students</div>
      )}
    </Modal>
  );
}
