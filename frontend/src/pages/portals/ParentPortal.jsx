import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../store/AuthContext';
import api from '../../utils/api';
import { PageLoader, EmptyState, StatusBadge, Avatar } from '../../components/ui';
import { GraduationCap, CalendarCheck, BookMarked, Clock, ClipboardList, ChevronLeft, ChevronRight, Upload, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ATT_COLOR = { present: '#10b981', absent: '#ef4444', late: '#f59e0b', excused: '#6366f1', half_day: '#f97316', leave: '#94a3b8' };
const ATT_LABEL = { present: 'P', absent: 'A', late: 'L', excused: 'E', half_day: 'H', leave: 'Leave' };

// ─── Main Parent Dashboard ────────────────────────────────────────────────────

export function ParentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: () => api.get('/parent/my-children'),
  });
  const children = data?.students || [];

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const perms = schoolData?.school?.parentPermissions || {};

  const [activeChildId, setActiveChildId] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (children.length > 0 && !activeChildId) setActiveChildId(children[0]._id);
  }, [children, activeChildId]);

  const selectedChild = children.find(c => c._id === activeChildId);

  const sections = [
    { id: 'overview',    label: 'Overview',       icon: GraduationCap },
    perms.viewAttendance     !== false && { id: 'attendance',  label: 'Attendance',     icon: CalendarCheck },
    perms.viewHomework       !== false && { id: 'homework',    label: 'Homework',        icon: BookMarked },
    perms.viewTimetable      !== false && { id: 'timetable',   label: 'Timetable',       icon: Clock },
    perms.submitLeaveRequest !== false && { id: 'leave',       label: 'Leave Request',   icon: ClipboardList },
  ].filter(Boolean);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Children</h1>
          <p className="page-subtitle">
            {children.length === 0 ? 'No children linked yet' : `${children.length} child${children.length !== 1 ? 'ren' : ''} enrolled`}
          </p>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="card">
          <EmptyState icon={GraduationCap} message="No children linked to your account. Contact the school admin." />
        </div>
      ) : (
        <>
          {/* Student tabs — only if multiple children */}
          {children.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {children.map(child => (
                <button
                  key={child._id}
                  onClick={() => { setActiveChildId(child._id); setActiveSection('overview'); }}
                  style={{
                    padding: '8px 18px', borderRadius: 20, border: '1.5px solid',
                    borderColor: activeChildId === child._id ? 'var(--primary)' : 'var(--border)',
                    background: activeChildId === child._id ? '#eff6ff' : 'white',
                    color: activeChildId === child._id ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: activeChildId === child._id ? 700 : 500,
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {child.name}
                  {child.currentClass && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      · {child.currentClass.name}{child.currentClass.section ? ` ${child.currentClass.section}` : ''}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedChild && (
            <>
              {/* Section navigation */}
              <div className="tabs" style={{ marginBottom: 20 }}>
                {sections.map(sec => {
                  const Icon = sec.icon;
                  return (
                    <button key={sec.id} className={`tab ${activeSection === sec.id ? 'active' : ''}`} onClick={() => setActiveSection(sec.id)}>
                      <Icon size={14} style={{ marginRight: 6 }} />
                      {sec.label}
                    </button>
                  );
                })}
              </div>

              {/* Section content */}
              {activeSection === 'overview'   && <OverviewSection   student={selectedChild} perms={perms} />}
              {activeSection === 'attendance' && <AttendanceSection student={selectedChild} />}
              {activeSection === 'homework'   && <HomeworkSection   student={selectedChild} perms={perms} />}
              {activeSection === 'timetable'  && <TimetableSection  student={selectedChild} />}
              {activeSection === 'leave'      && <LeaveSection      student={selectedChild} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function StudentCard({ student }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
      <Avatar name={student.name} size={72} src={student.photo} />
      <div style={{ flex: 1 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{student.name}</h2>
        {student.currentClass && (
          <div style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
            {student.currentClass.name}{student.currentClass.section ? ` - ${student.currentClass.section}` : ''}
          </div>
        )}
        <div style={{ margin: '6px 0 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Adm. No: {student.admissionNumber}</span>
          {student.gender && <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{student.gender}</span>}
          {student.bloodGroup && <span style={{ fontSize: 12, background: '#fee2e2', color: '#b91c1c', padding: '1px 8px', borderRadius: 20 }}>{student.bloodGroup}</span>}
        </div>
      </div>
      <StatusBadge status={student.status} />
    </div>
  );
}

function OverviewSection({ student, perms }) {
  const { data: attData } = useQuery({
    queryKey: ['parent-att-summary', student._id],
    queryFn: async () => {
      const res = await api.get(`/attendance/student-records?studentId=${student._id}`);
      const recs = res?.records || [];
      const present = recs.filter(r => r.status === 'present').length;
      const absent  = recs.filter(r => r.status === 'absent').length;
      const total   = recs.length;
      return { present, absent, total, pct: total ? Math.round((present / total) * 100) : 0 };
    },
    enabled: perms?.viewAttendance !== false,
  });

  const { data: feesData } = useQuery({
    queryKey: ['parent-fees', student._id],
    queryFn: () => api.get(`/fees?studentId=${student._id}`),
    enabled: perms?.viewFees !== false,
  });
  const fees = feesData?.fees || [];
  const pendingFees = fees.filter(f => f.status !== 'paid');

  const { data: hwData } = useQuery({
    queryKey: ['parent-hw-summary', student._id],
    queryFn: () => api.get(`/homework/student-summary?studentId=${student._id}`),
    enabled: perms?.viewHomework !== false,
  });
  const pendingHw = (hwData?.homework || []).filter(h => !h.submission || h.submission.status !== 'completed');

  const { data: examData } = useQuery({
    queryKey: ['parent-exams', student._id],
    queryFn: () => api.get(`/exams/results?studentId=${student._id}`),
    enabled: perms?.viewExamResults !== false,
  });
  const results = examData?.results || [];

  return (
    <div>
      <StudentCard student={student} />

      {/* Quick stats */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {perms?.viewAttendance !== false && attData && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: (attData.pct || 0) >= 75 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
              {attData.pct || 0}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Attendance · {attData.present}/{attData.total} days
            </div>
          </div>
        )}
        {perms?.viewFees !== false && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: pendingFees.length > 0 ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>
              {pendingFees.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Pending Fees</div>
          </div>
        )}
        {perms?.viewHomework !== false && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: pendingHw.length > 0 ? '#f59e0b' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>
              {pendingHw.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Pending Homework</div>
          </div>
        )}
      </div>

      {/* Fees table */}
      {perms?.viewFees !== false && fees.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Fee Records</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Description</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {fees.slice(0, 5).map(fee => (
                  <tr key={fee._id}>
                    <td style={{ fontSize: 13 }}>{fee.description || fee.feeType || 'Fee'}</td>
                    <td style={{ fontSize: 13 }}>₹{fee.totalAmount?.toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 13, color: '#10b981' }}>₹{fee.paidAmount?.toLocaleString('en-IN') || 0}</td>
                    <td style={{ fontSize: 13, color: '#ef4444' }}>₹{((fee.totalAmount || 0) - (fee.paidAmount || 0)).toLocaleString('en-IN')}</td>
                    <td><StatusBadge status={fee.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent exam results */}
      {perms?.viewExamResults !== false && results.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Exam Results</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Grade</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {results.slice(0, 6).map(r => (
                  r.marks?.map((m, i) => (
                    <tr key={`${r._id}-${i}`}>
                      <td style={{ fontSize: 13 }}>{r.exam?.title || '—'}</td>
                      <td style={{ fontSize: 13 }}>{m.subject?.name || '—'}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{m.marksObtained ?? '—'}/{m.maxMarks ?? '—'}</td>
                      <td>
                        {m.grade && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8' }}>
                            {m.grade}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.remarks || '—'}</td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attendance ───────────────────────────────────────────────────────────────

function AttendanceSection({ student }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['parent-att-records', student._id, month, year],
    queryFn: () => api.get(`/attendance/student-records?studentId=${student._id}&month=${month}&year=${year}`),
  });
  const records = data?.records || [];

  const byDate = {};
  records.forEach(r => {
    const key = new Date(r.date).toDateString();
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount  = records.filter(r => r.status === 'absent').length;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={prev} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{MONTHS[month - 1]} {year}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Present: {presentCount} · Absent: {absentCount}
              {presentCount + absentCount > 0 && ` · ${Math.round((presentCount / (presentCount + absentCount)) * 100)}%`}
            </div>
          </div>
          <button onClick={next} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 4 }}>{d}</div>
            ))}
            {/* Offset for first day */}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => (
              <div key={`offset-${i}`} />
            ))}
            {days.map(day => {
              const key = new Date(year, month - 1, day).toDateString();
              const dayRecs = byDate[key] || [];
              const stat = dayRecs[0]?.status || null;
              const bg = stat ? (ATT_COLOR[stat] + '22') : '#f8fafc';
              const color = stat ? ATT_COLOR[stat] : 'var(--text-muted)';
              return (
                <div key={day} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: bg, position: 'relative' }}>
                  <div style={{ fontSize: 13, fontWeight: stat ? 700 : 400, color }}>{day}</div>
                  {stat && <div style={{ fontSize: 9, fontWeight: 700, color, marginTop: 2 }}>{ATT_LABEL[stat] || stat}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          {Object.entries(ATT_LABEL).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: ATT_COLOR[key] }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label} = {key.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Record list */}
      {records.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Date</th><th>Period</th><th>Subject</th><th>Status</th></tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r._id}>
                    <td style={{ fontSize: 13 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontSize: 13 }}>{r.period ? `P${r.period}` : '—'}</td>
                    <td style={{ fontSize: 13 }}>{r.subject?.name || '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: (ATT_COLOR[r.status] || '#e2e8f0') + '22', color: ATT_COLOR[r.status] || 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Homework ─────────────────────────────────────────────────────────────────

function HomeworkSection({ student, perms }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['parent-homework', student._id],
    queryFn: () => api.get(`/homework/student-summary?studentId=${student._id}`),
  });
  const homework = data?.homework || [];

  const submitMutation = useMutation({
    mutationFn: ({ hwId, status }) => api.post(`/homework/${hwId}/submit`, { studentId: student._id, status }),
    onSuccess: () => { qc.invalidateQueries(['parent-homework', student._id]); toast.success('Updated!'); },
    onError: () => toast.error('Failed to update'),
  });

  const uploadAttachment = async (hwId, file) => {
    setUploading(hwId);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/homework/${hwId}/submissions/${student._id}/attachment`, form, { headers: { 'Content-Type': undefined } });
      qc.invalidateQueries(['parent-homework', student._id]);
      toast.success('File uploaded!');
    } catch {
      toast.error('Upload failed');
    }
    setUploading(null);
  };

  if (isLoading) return <PageLoader />;

  if (homework.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={BookMarked} message="No homework assigned yet." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {homework.map(hw => {
        const sub = hw.submission;
        const isCompleted = sub?.status === 'completed';
        const isPending   = !isCompleted;
        const isOverdue   = !isCompleted && hw.dueDate && new Date(hw.dueDate) < new Date();

        return (
          <div key={hw._id} className="card" style={{ borderLeft: `4px solid ${isCompleted ? '#10b981' : isOverdue ? '#ef4444' : '#1a56e8'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{hw.title}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  {hw.subject && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: (hw.subject.color || '#1a56e8') + '22', color: hw.subject.color || '#1a56e8', fontWeight: 600 }}>
                      {hw.subject.name}
                    </span>
                  )}
                  {hw.class && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {hw.class.name} {hw.class.section}
                    </span>
                  )}
                  {hw.dueDate && (
                    <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                      Due: {new Date(hw.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {isOverdue && ' (Overdue)'}
                    </span>
                  )}
                </div>
                {hw.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{hw.description}</p>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isCompleted ? '#d1fae5' : '#fef3c7', color: isCompleted ? '#059669' : '#d97706' }}>
                  {isCompleted ? '✓ Completed' : 'Pending'}
                </span>

                {perms?.submitHomework !== false && isPending && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => submitMutation.mutate({ hwId: hw._id, status: 'completed' })}
                    disabled={submitMutation.isPending}
                  >
                    <Check size={12} style={{ marginRight: 4 }} />
                    Mark Complete
                  </button>
                )}

                {perms?.submitHomework !== false && (
                  <label style={{ cursor: 'pointer' }}>
                    <span className="btn btn-secondary btn-sm">
                      {uploading === hw._id ? 'Uploading...' : <><Upload size={12} style={{ marginRight: 4 }} />Upload</>}
                    </span>
                    <input type="file" style={{ display: 'none' }} accept="image/*,.pdf"
                      onChange={e => { if (e.target.files[0]) uploadAttachment(hw._id, e.target.files[0]); }}
                      disabled={uploading === hw._id}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Attachments */}
            {sub?.attachments?.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sub.attachments.map(att => (
                  <a key={att._id} href={att.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}>
                    📎 {att.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Timetable ────────────────────────────────────────────────────────────────

function TimetableSection({ student }) {
  const classId = student.currentClass?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['parent-timetable', classId],
    queryFn: () => api.get(`/timetable?classId=${classId}`),
    enabled: !!classId,
  });
  const timetables = data?.timetables || [];

  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday'];
  const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };

  const maxPeriod = timetables.reduce((m, t) => Math.max(m, t.period || 0), 8);
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  const cellMap = {};
  timetables.forEach(t => { cellMap[`${t.day}-${t.period}`] = t; });

  if (!classId) return (
    <div className="card">
      <EmptyState icon={Clock} message="No class assigned to this student." />
    </div>
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Class Timetable</h3>
        {student.currentClass && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {student.currentClass.name}{student.currentClass.section ? ` - ${student.currentClass.section}` : ''}
          </span>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 70 }}>Period</th>
              {DAYS.map(d => (
                <th key={d} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {DAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                  P{p}
                </td>
                {DAYS.map(d => {
                  const cell = cellMap[`${d}-${p}`];
                  return (
                    <td key={d} style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                      {cell ? (
                        <div style={{ background: (cell.subject?.color || '#1a56e8') + '15', borderRadius: 8, padding: '6px 8px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: cell.subject?.color || '#1a56e8' }}>
                            {cell.isBreak ? cell.breakLabel || 'Break' : (cell.subject?.name || '—')}
                          </div>
                          {cell.teacher && !cell.isBreak && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{cell.teacher?.name || ''}</div>
                          )}
                          {cell.startTime && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cell.startTime}–{cell.endTime}</div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#cbd5e1' }}>—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Leave Request ────────────────────────────────────────────────────────────

function LeaveSection({ student }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['parent-leaves', student._id],
    queryFn: () => api.get(`/parent/student-leave?studentId=${student._id}`),
  });
  const leaves = data?.leaves || [];

  const days = (from, to) => {
    if (!from || !to) return 0;
    const diff = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.floor(diff) + 1);
  };

  const submitMutation = useMutation({
    mutationFn: () => api.post('/parent/student-leave', {
      studentId: student._id,
      fromDate: form.fromDate,
      toDate: form.toDate,
      days: days(form.fromDate, form.toDate),
      reason: form.reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['parent-leaves', student._id]);
      setForm({ fromDate: '', toDate: '', reason: '' });
      toast.success('Leave request submitted!');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to submit'),
  });

  const STATUS_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
  const STATUS_BG    = { pending: '#fef3c7', approved: '#d1fae5', rejected: '#fee2e2' };

  return (
    <div>
      {/* Submit form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>New Leave Request</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input className="form-control" type="date" value={form.fromDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input className="form-control" type="date" value={form.toDate}
              min={form.fromDate || new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
          </div>
        </div>
        {form.fromDate && form.toDate && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Duration: {days(form.fromDate, form.toDate)} day{days(form.fromDate, form.toDate) !== 1 ? 's' : ''}
          </div>
        )}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Reason</label>
          <textarea className="form-control" rows={3} placeholder="Reason for leave..."
            value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => submitMutation.mutate()}
          disabled={!form.fromDate || !form.toDate || !form.reason.trim() || submitMutation.isPending}
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>

      {/* Leave history */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Leave History</h3>
        </div>
        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : leaves.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No leave requests yet.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th></tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l._id}>
                    <td style={{ fontSize: 13 }}>{new Date(l.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontSize: 13 }}>{new Date(l.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{l.days}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200 }}>{l.reason}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: STATUS_BG[l.status], color: STATUS_COLOR[l.status], textTransform: 'capitalize' }}>
                        {l.status}
                      </span>
                      {l.adminNote && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{l.adminNote}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
