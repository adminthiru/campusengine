import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../store/AuthContext';
import api from '../../utils/api';
import { PageLoader, EmptyState, StatusBadge, Avatar } from '../../components/ui';
import { Clock, BookMarked, FileText, CalendarCheck, ClipboardList, CreditCard, ChevronLeft, ChevronRight, Upload, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ATT_COLOR = { present: '#10b981', absent: '#ef4444', late: '#f59e0b', excused: '#6366f1', half_day: '#f97316' };
const ATT_LABEL = { present: 'P', absent: 'A', late: 'L', excused: 'E', half_day: 'H' };

// ─── Main Student Dashboard ───────────────────────────────────────────────────

export function StudentDashboard() {
  const { user } = useAuth();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['student-my-profile'],
    queryFn: () => api.get('/student/my-profile'),
  });
  const student = profileData?.student;

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const perms = schoolData?.school?.studentPermissions || {};

  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview',    label: 'Overview',      icon: CalendarCheck },
    perms.viewTimetable      !== false && { id: 'timetable',   label: 'Timetable',     icon: Clock },
    perms.viewHomework       !== false && { id: 'homework',    label: 'Homework',      icon: BookMarked },
    perms.viewExams          !== false && { id: 'exams',       label: 'Exams',         icon: FileText },
    perms.viewAttendance     !== false && { id: 'attendance',  label: 'Attendance',    icon: CalendarCheck },
    perms.submitLeaveRequest !== false && { id: 'leave',       label: 'Leave',         icon: ClipboardList },
    perms.viewFees           !== false && { id: 'fees',        label: 'Fees',          icon: CreditCard },
  ].filter(Boolean);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.name?.split(' ')[0]}!</h1>
          <p className="page-subtitle">
            {student?.currentClass
              ? `${student.currentClass.name}${student.currentClass.section ? ` - ${student.currentClass.section}` : ''}`
              : 'Student Portal'}
          </p>
        </div>
      </div>

      {/* Section navigation */}
      <div className="tabs" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
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

      {student ? (
        <>
          {activeSection === 'overview'   && <OverviewSection   student={student} perms={perms} />}
          {activeSection === 'timetable'  && <TimetableSection  student={student} />}
          {activeSection === 'homework'   && <HomeworkSection   student={student} perms={perms} />}
          {activeSection === 'exams'      && <ExamsSection      student={student} perms={perms} />}
          {activeSection === 'attendance' && <AttendanceSection student={student} />}
          {activeSection === 'leave'      && <LeaveSection      student={student} />}
          {activeSection === 'fees'       && <FeesSection       student={student} />}
        </>
      ) : (
        <div className="card">
          <EmptyState icon={CalendarCheck} message="Your student profile is not linked yet. Contact your admin." />
        </div>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection({ student, perms }) {
  const { data: attData } = useQuery({
    queryKey: ['stu-att-overview', student._id],
    queryFn: async () => {
      const res = await api.get(`/attendance/student-records?studentId=${student._id}`);
      const recs = res?.records || [];
      const present = recs.filter(r => r.status === 'present').length;
      const total   = recs.length;
      return { present, total, pct: total ? Math.round((present / total) * 100) : 0 };
    },
    enabled: perms?.viewAttendance !== false,
  });

  const { data: hwData } = useQuery({
    queryKey: ['stu-hw-overview', student._id],
    queryFn: () => api.get(`/homework/student-summary?studentId=${student._id}`),
    enabled: perms?.viewHomework !== false,
  });
  const pendingHw = (hwData?.homework || []).filter(h => !h.submission || h.submission.status !== 'completed').length;

  const { data: examData } = useQuery({
    queryKey: ['stu-exams-overview', student._id],
    queryFn: () => api.get('/exams'),
    enabled: perms?.viewExams !== false,
  });
  const upcomingExams = (examData?.exams || []).filter(e => e.status === 'scheduled' && e.classes?.some(c => c._id === student.currentClass?._id || c === student.currentClass?._id)).length;

  const { data: feesData } = useQuery({
    queryKey: ['stu-fees-overview', student._id],
    queryFn: () => api.get(`/fees?studentId=${student._id}`),
    enabled: perms?.viewFees !== false,
  });
  const pendingFees = (feesData?.fees || []).filter(f => f.status !== 'paid').length;

  return (
    <div>
      {/* Profile card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <Avatar name={student.name} size={72} src={student.photo} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{student.name}</h2>
          {student.currentClass && (
            <div style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
              {student.currentClass.name}{student.currentClass.section ? ` - ${student.currentClass.section}` : ''}
            </div>
          )}
          <div style={{ margin: '6px 0 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Adm: {student.admissionNumber}</span>
            {student.rollNumber && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Roll: {student.rollNumber}</span>}
            {student.bloodGroup && <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', padding: '1px 8px', borderRadius: 20 }}>{student.bloodGroup}</span>}
            <StatusBadge status={student.status} />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid-4" style={{ marginBottom: 0 }}>
        {perms?.viewAttendance !== false && attData && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: (attData.pct || 0) >= 75 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
              {attData.pct || 0}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Attendance · {attData.present}/{attData.total}</div>
          </div>
        )}
        {perms?.viewHomework !== false && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: pendingHw > 0 ? '#f59e0b' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>{pendingHw}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Pending Homework</div>
          </div>
        )}
        {perms?.viewExams !== false && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1a56e8', fontVariantNumeric: 'tabular-nums' }}>{upcomingExams}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Upcoming Exams</div>
          </div>
        )}
        {perms?.viewFees !== false && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: pendingFees > 0 ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>{pendingFees}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Pending Fees</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timetable ────────────────────────────────────────────────────────────────

function TimetableSection({ student }) {
  const classId = student.currentClass?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['stu-timetable', classId],
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

  if (!classId) return <div className="card"><EmptyState icon={Clock} message="No class assigned yet." /></div>;
  if (isLoading) return <PageLoader />;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>My Class Timetable</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {student.currentClass?.name}{student.currentClass?.section ? ` - ${student.currentClass.section}` : ''}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 60 }}>P</th>
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
                <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>P{p}</td>
                {DAYS.map(d => {
                  const cell = cellMap[`${d}-${p}`];
                  return (
                    <td key={d} style={{ padding: '7px 8px', textAlign: 'center' }}>
                      {cell ? (
                        <div style={{ background: (cell.subject?.color || '#1a56e8') + '15', borderRadius: 8, padding: '5px 6px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: cell.subject?.color || '#1a56e8' }}>
                            {cell.isBreak ? (cell.breakLabel || 'Break') : (cell.subject?.name || '—')}
                          </div>
                          {!cell.isBreak && cell.teacher && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{cell.teacher?.name || ''}</div>
                          )}
                          {cell.startTime && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cell.startTime}–{cell.endTime}</div>}
                        </div>
                      ) : <div style={{ fontSize: 11, color: '#cbd5e1' }}>—</div>}
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

// ─── Homework ─────────────────────────────────────────────────────────────────

function HomeworkSection({ student, perms }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stu-homework', student._id],
    queryFn: () => api.get(`/homework/student-summary?studentId=${student._id}`),
  });
  const homework = data?.homework || [];

  const submitMutation = useMutation({
    mutationFn: ({ hwId, status }) => api.post(`/homework/${hwId}/submit`, { studentId: student._id, status }),
    onSuccess: () => { qc.invalidateQueries(['stu-homework', student._id]); toast.success('Homework updated!'); },
    onError: () => toast.error('Failed to update'),
  });

  const uploadAttachment = async (hwId, file) => {
    setUploading(hwId);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/homework/${hwId}/submissions/${student._id}/attachment`, form, { headers: { 'Content-Type': undefined } });
      qc.invalidateQueries(['stu-homework', student._id]);
      toast.success('File uploaded!');
    } catch { toast.error('Upload failed'); }
    setUploading(null);
  };

  if (isLoading) return <PageLoader />;
  if (homework.length === 0) return <div className="card"><EmptyState icon={BookMarked} message="No homework assigned yet." /></div>;

  const pending   = homework.filter(h => !h.submission || h.submission.status !== 'completed');
  const completed = homework.filter(h => h.submission?.status === 'completed');

  const HWCard = ({ hw }) => {
    const sub = hw.submission;
    const isCompleted = sub?.status === 'completed';
    const isOverdue   = !isCompleted && hw.dueDate && new Date(hw.dueDate) < new Date();

    return (
      <div className="card" style={{ borderLeft: `4px solid ${isCompleted ? '#10b981' : isOverdue ? '#ef4444' : '#1a56e8'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{hw.title}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              {hw.subject && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: (hw.subject.color || '#1a56e8') + '22', color: hw.subject.color || '#1a56e8', fontWeight: 600 }}>
                  {hw.subject.name}
                </span>
              )}
              {hw.dueDate && (
                <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                  Due: {new Date(hw.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  {isOverdue && ' · Overdue'}
                </span>
              )}
            </div>
            {hw.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{hw.description}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isCompleted ? '#d1fae5' : '#fef3c7', color: isCompleted ? '#059669' : '#d97706' }}>
              {isCompleted ? '✓ Completed' : 'Pending'}
            </span>
            {perms?.submitHomework !== false && !isCompleted && (
              <button className="btn btn-success btn-sm" onClick={() => submitMutation.mutate({ hwId: hw._id, status: 'completed' })} disabled={submitMutation.isPending}>
                <Check size={12} style={{ marginRight: 4 }} /> Mark Done
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
  };

  return (
    <div>
      {pending.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Pending ({pending.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {pending.map(hw => <HWCard key={hw._id} hw={hw} />)}
          </div>
        </>
      )}
      {completed.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Completed ({completed.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completed.map(hw => <HWCard key={hw._id} hw={hw} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Exams ────────────────────────────────────────────────────────────────────

function ExamsSection({ student, perms }) {
  const classId = student.currentClass?._id;

  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ['stu-exams', classId],
    queryFn: () => api.get('/exams'),
    enabled: !!classId,
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['stu-results', student._id],
    queryFn: () => api.get(`/exams/results?studentId=${student._id}`),
    enabled: perms?.viewExamResults !== false,
  });

  const allExams   = (examsData?.exams || []).filter(e => e.classes?.some(c => (c._id || c) === classId));
  const scheduled  = allExams.filter(e => e.status === 'scheduled');
  const ongoing    = allExams.filter(e => e.status === 'ongoing');
  const results    = resultsData?.results || [];

  if (examsLoading) return <PageLoader />;

  return (
    <div>
      {/* Upcoming exams */}
      {(scheduled.length > 0 || ongoing.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Upcoming & Ongoing Exams</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...ongoing, ...scheduled].map(exam => (
              <div key={exam._id} className="card" style={{ borderLeft: `4px solid ${exam.status === 'ongoing' ? '#f59e0b' : '#1a56e8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{exam.name}</div>
                    {exam.examDate && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {new Date(exam.examDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {/* Subject schedule for this class */}
                    {exam.schedule?.filter(s => (s.class?._id || s.class) === classId).length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {exam.schedule.filter(s => (s.class?._id || s.class) === classId).map((s, i) => (
                          <div key={i} style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 10px', borderRadius: 20 }}>
                            {s.subject?.name || 'Subject'} · {s.maxMarks} marks
                            {s.date ? ` · ${new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: exam.status === 'ongoing' ? '#fef3c7' : '#eff6ff', color: exam.status === 'ongoing' ? '#d97706' : '#1d4ed8', textTransform: 'capitalize' }}>
                    {exam.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published results */}
      {perms?.viewExamResults !== false && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>My Results</h3>
          {resultsLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : results.length === 0 ? (
            <div className="card"><EmptyState icon={FileText} message="No published results yet." /></div>
          ) : (
            results.map(r => (
              <div key={r._id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.exam?.name || 'Exam'}</div>
                  {r.percentage != null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: r.percentage >= 75 ? '#10b981' : r.percentage >= 40 ? '#f59e0b' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                        {r.percentage}%
                      </div>
                      {r.rank && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rank {r.rank}</div>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                  {r.marks?.map((m, i) => (
                    <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.subject?.name || '—'}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                        {m.marksObtained ?? '—'}
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/{m.maxMarks}</span>
                      </div>
                      {m.grade && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8' }}>{m.grade}</span>
                      )}
                      {/* Answer paper link */}
                      {m.answerPaper?.url && (
                        <a href={m.answerPaper.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', fontSize: 10, color: 'var(--primary)', marginTop: 4, textDecoration: 'none' }}>
                          📄 View Answer Paper
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {scheduled.length === 0 && ongoing.length === 0 && results.length === 0 && (
        <div className="card"><EmptyState icon={FileText} message="No exams scheduled yet." /></div>
      )}
    </div>
  );
}

// ─── Attendance ───────────────────────────────────────────────────────────────

function AttendanceSection({ student }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['stu-att-records', student._id, month, year],
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
  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount  = records.filter(r => r.status === 'absent').length;

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={prev} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{MONTHS[month - 1]} {year}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Present: {presentCount} · Absent: {absentCount}
              {(presentCount + absentCount) > 0 && ` · ${Math.round((presentCount / (presentCount + absentCount)) * 100)}%`}
            </div>
          </div>
          <button onClick={next} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 4 }}>{d}</div>
            ))}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => <div key={`o${i}`} />)}
            {days.map(day => {
              const key = new Date(year, month - 1, day).toDateString();
              const dayRecs = byDate[key] || [];
              const stat = dayRecs[0]?.status || null;
              const bg = stat ? (ATT_COLOR[stat] || '#e2e8f0') + '22' : '#f8fafc';
              const color = stat ? (ATT_COLOR[stat] || 'var(--text-muted)') : 'var(--text-muted)';
              return (
                <div key={day} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: bg }}>
                  <div style={{ fontSize: 13, fontWeight: stat ? 700 : 400, color }}>{day}</div>
                  {stat && <div style={{ fontSize: 9, fontWeight: 700, color, marginTop: 1 }}>{ATT_LABEL[stat] || stat}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          {Object.entries(ATT_LABEL).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: ATT_COLOR[key] || '#e2e8f0' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label} = {key.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Leave Request ────────────────────────────────────────────────────────────

function LeaveSection({ student }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['stu-leaves'],
    queryFn: () => api.get('/student/leave'),
  });
  const leaves = data?.leaves || [];

  const days = (from, to) => {
    if (!from || !to) return 0;
    return Math.max(1, Math.floor((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1);
  };

  const submitMutation = useMutation({
    mutationFn: () => api.post('/student/leave', {
      fromDate: form.fromDate, toDate: form.toDate,
      days: days(form.fromDate, form.toDate), reason: form.reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['stu-leaves']);
      setForm({ fromDate: '', toDate: '', reason: '' });
      toast.success('Leave request submitted!');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to submit'),
  });

  const STATUS_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
  const STATUS_BG    = { pending: '#fef3c7', approved: '#d1fae5', rejected: '#fee2e2' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Apply for Leave</h3>
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
        <button className="btn btn-primary"
          onClick={() => submitMutation.mutate()}
          disabled={!form.fromDate || !form.toDate || !form.reason.trim() || submitMutation.isPending}>
          {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>

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
              <thead><tr><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l._id}>
                    <td style={{ fontSize: 13 }}>{new Date(l.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontSize: 13 }}>{new Date(l.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{l.days}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{l.reason}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: STATUS_BG[l.status], color: STATUS_COLOR[l.status], textTransform: 'capitalize' }}>
                        {l.status}
                      </span>
                      {l.adminNote && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{l.adminNote}</div>}
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

// ─── Fees ─────────────────────────────────────────────────────────────────────

function FeesSection({ student }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stu-fees', student._id],
    queryFn: () => api.get(`/fees?studentId=${student._id}`),
  });
  const fees = data?.fees || [];

  if (isLoading) return <PageLoader />;
  if (fees.length === 0) return <div className="card"><EmptyState icon={CreditCard} message="No fee records found." /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fees.map(fee => (
        <div key={fee._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{fee.academicYear} Fee Record</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Total: ₹{fee.totalAmount?.toLocaleString('en-IN')} · Paid: ₹{fee.paidAmount?.toLocaleString('en-IN')} · Balance: ₹{fee.pendingAmount?.toLocaleString('en-IN')}
              </div>
            </div>
            <StatusBadge status={fee.status} />
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Term</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {(fee.terms || []).map((term, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{term.name}</td>
                    <td style={{ fontSize: 13 }}>₹{term.netAmount?.toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 13, color: '#10b981' }}>₹{term.paidAmount?.toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 13, color: term.pendingAmount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                      ₹{term.pendingAmount?.toLocaleString('en-IN')}
                    </td>
                    <td><StatusBadge status={term.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment history */}
          {fee.payments?.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Payment History</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {fee.payments.map((p, i) => (
                  <div key={i} style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 20 }}>
                    ₹{p.amount?.toLocaleString('en-IN')} · {p.method} · {new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {p.receiptNumber && ` · ${p.receiptNumber}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
