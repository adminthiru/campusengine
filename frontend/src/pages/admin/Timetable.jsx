import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Save, AlertTriangle, BookOpen, Users, UserX, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageLoader, EmptyState, Modal, FormRow } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };
const DAY_FULL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function Timetable() {
  const { user } = useAuth();
  const [view, setView] = useState('class');
  const academicYear = user?.school?.academicYear?.current || '2024-2025';
  const periodsPerDay = user?.school?.periodsPerDay || 8;

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: empData } = useQuery({ queryKey: ['teachers'], queryFn: () => api.get('/employees?role=teacher&limit=100') });
  const teachers = empData?.employees || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">Manage class schedules and teacher assignments</p>
        </div>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 2 }}>
          {[['class', BookOpen, 'Class View'], ['teacher', Users, 'Teacher View']].map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
              background: view === v ? '#fff' : 'transparent',
              color: view === v ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {view === 'class'
        ? <ClassView classes={classes} teachers={teachers} user={user} academicYear={academicYear} periodsPerDay={periodsPerDay} />
        : <TeacherView teachers={teachers} academicYear={academicYear} periodsPerDay={periodsPerDay} />
      }
    </div>
  );
}

// ─── Class View ────────────────────────────────────────────────────────────────
function ClassView({ classes, teachers, user, academicYear, periodsPerDay }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/subjects')
  });
  const subjects = subjectData?.subjects || [];

  const { data: ttData, isLoading } = useQuery({
    queryKey: ['timetable', classId, academicYear],
    enabled: !!classId,
    queryFn: () => api.get(`/timetable?classId=${classId}&academicYear=${academicYear}`)
  });

  useEffect(() => {
    if (!ttData) return;
    if (ttData.timetable) setSchedule(ttData.timetable.schedule || []);
    else initSchedule();
  }, [ttData]);

  const initSchedule = () => {
    const activeDays = DAYS.filter(d => { const wd = user?.school?.workingDays; return !wd || wd[d] !== false; });
    setSchedule(activeDays.map(day => ({
      day,
      periods: Array.from({ length: periodsPerDay }, (_, i) => ({
        periodNumber: i + 1, startTime: '', endTime: '', subject: null, teacher: null, room: '', isBreak: false
      }))
    })));
  };

  const getCell = (day, periodNum) => schedule.find(s => s.day === day)?.periods?.find(p => p.periodNumber === periodNum);

  const updateCell = (day, periodNum, updates) => {
    setSchedule(prev => prev.map(s => s.day !== day ? s : {
      ...s, periods: s.periods.map(p => p.periodNumber === periodNum ? { ...p, ...updates } : p)
    }));
  };

  const saveSchedule = async () => {
    if (!classId) return toast.error('Select a class');
    setSaving(true); setConflict(null);
    try {
      await api.post('/timetable', { classId, academicYear, schedule });
      toast.success('Timetable saved!');
      qc.invalidateQueries(['timetable']);
      setEditMode(false);
    } catch (err) {
      if (err.conflicts) { setConflict(err.conflicts[0]?.message || 'Conflict detected'); toast.error('Timetable conflict detected!'); }
      else toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const getPeriodTimeLabel = (periodNum) => {
    for (const ds of schedule) {
      const p = ds.periods?.find(p => p.periodNumber === periodNum);
      if (p?.startTime && p?.endTime) {
        const fmt = t => { const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
        return `${fmt(p.startTime)} – ${fmt(p.endTime)}`;
      }
    }
    return null;
  };

  const activeDays = schedule.map(s => s.day);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-control" style={{ maxWidth: 220 }} value={classId} onChange={e => { setClassId(e.target.value); setEditMode(false); setConflict(null); }}>
          <option value="">Select Class</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{academicYear}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {classId && !editMode && <button className="btn btn-secondary" onClick={() => { setEditMode(true); if (!schedule.length) initSchedule(); }}><Plus size={16} /> Edit Timetable</button>}
          {editMode && <>
            <button className="btn btn-secondary" onClick={() => { setEditMode(false); qc.invalidateQueries(['timetable']); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveSchedule} disabled={saving}>
              {saving ? 'Saving...' : <><Save size={16} /> Save</>}
            </button>
          </>}
        </div>
      </div>

      {conflict && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div><div style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>Conflict</div><div style={{ color: '#991b1b', fontSize: 13 }}>{conflict}</div></div>
        </div>
      )}

      {!classId ? (
        <div className="card"><EmptyState icon={Clock} message="Select a class to view or edit its timetable" /></div>
      ) : isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                <th style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', width: 110 }}>Period</th>
                {activeDays.map(day => (
                  <th key={day} style={{ padding: '12px 16px', color: 'white', textAlign: 'center', fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>
                    {DAY_LABELS[day] || day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => (
                <tr key={p} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 16px', background: '#f8fafc', color: 'var(--text-secondary)', textAlign: 'center', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>P{p}</div>
                    {getPeriodTimeLabel(p) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{getPeriodTimeLabel(p)}</div>}
                  </td>
                  {activeDays.map(day => {
                    const cell = getCell(day, p);
                    const subj = cell?.subject ? (typeof cell.subject === 'object' ? cell.subject : subjects.find(s => s._id === cell.subject)) : null;
                    const tchr = cell?.teacher ? (typeof cell.teacher === 'object' ? cell.teacher : teachers.find(t => t._id === cell.teacher)) : null;
                    return (
                      <td key={day} style={{ padding: 4, textAlign: 'center', verticalAlign: 'top', minWidth: 110 }}>
                        {cell?.isBreak ? (
                          <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '8px 4px', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>{cell.breakName || 'Break'}</div>
                        ) : editMode ? (
                          <button onClick={() => setEditCell({ day, period: p })} style={{
                            width: '100%', minHeight: 60, border: `2px dashed ${subj ? subj.color || 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: 8, background: subj ? `${subj.color || '#1a56e8'}15` : 'white', cursor: 'pointer', padding: '6px 8px'
                          }}>
                            {subj ? <>
                              <div style={{ fontSize: 12, fontWeight: 700, color: subj.color || 'var(--primary)' }}>{subj.name}</div>
                              {tchr && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tchr.name}</div>}
                            </> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+ Add</span>}
                          </button>
                        ) : (
                          <div style={{ minHeight: 60, borderRadius: 8, padding: 8, background: subj ? `${subj.color || '#1a56e8'}12` : '#f8fafc', border: `1px solid ${subj ? `${subj.color || '#1a56e8'}30` : 'transparent'}` }}>
                            {subj ? <>
                              <div style={{ fontSize: 12, fontWeight: 700, color: subj.color || 'var(--primary)' }}>{subj.name}</div>
                              {tchr && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tchr.name}</div>}
                            </> : <span style={{ fontSize: 12, color: '#e2e8f0' }}>—</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editCell && (
        <EditCellModal
          cell={getCell(editCell.day, editCell.period)}
          day={editCell.day} period={editCell.period}
          subjects={subjects} teachers={teachers}
          onSave={u => { updateCell(editCell.day, editCell.period, u); setEditCell(null); }}
          onClose={() => setEditCell(null)}
          onClear={() => { updateCell(editCell.day, editCell.period, { subject: null, teacher: null, room: '', isBreak: false, breakName: '' }); setEditCell(null); }}
        />
      )}
    </div>
  );
}

// ─── Teacher View ──────────────────────────────────────────────────────────────
function TeacherView({ teachers, academicYear, periodsPerDay }) {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const selectedTeacher = teachers.find(t => t._id === selectedId);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Teacher list */}
      <div style={{ width: 230, flexShrink: 0 }}>
        <input
          className="form-control"
          placeholder="Search teacher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 10, fontSize: 13 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          {filtered.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>No teachers found</div>}
          {filtered.map(t => (
            <button key={t._id} onClick={() => setSelectedId(t._id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, border: `1.5px solid ${selectedId === t._id ? 'var(--primary)' : '#e2e8f0'}`,
              background: selectedId === t._id ? '#eff6ff' : 'white',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
            }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: selectedId === t._id ? 'var(--primary)' : '#e2e8f0', color: selectedId === t._id ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: selectedId === t._id ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                {t.designation && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t.designation}</div>}
              </div>
              {selectedId === t._id && <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--primary)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedId ? (
          <div className="card"><EmptyState icon={Users} message="Select a teacher to view their timetable" /></div>
        ) : (
          <>
            <TeacherScheduleGrid teacherId={selectedId} teacher={selectedTeacher} academicYear={academicYear} periodsPerDay={periodsPerDay} />
            <SubstitutionPanel teacherId={selectedId} teacher={selectedTeacher} academicYear={academicYear} periodsPerDay={periodsPerDay} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Teacher Schedule Grid ─────────────────────────────────────────────────────
function TeacherScheduleGrid({ teacherId, teacher, academicYear, periodsPerDay }) {
  const { data, isLoading } = useQuery({
    queryKey: ['timetable-teacher', teacherId, academicYear],
    queryFn: () => api.get(`/timetable?teacherId=${teacherId}&academicYear=${academicYear}`),
    enabled: !!teacherId
  });
  const timetables = data?.timetables || [];

  const getCell = (day, p) => {
    for (const tt of timetables) {
      const ds = tt.schedule.find(s => s.day === day);
      if (!ds) continue;
      const period = ds.periods.find(per => per.periodNumber === p);
      if (period) return { cls: tt.class, subject: period.subject, period };
    }
    return null;
  };

  const activeDays = DAYS.filter(day => timetables.some(tt => tt.schedule.some(s => s.day === day && s.periods.length)));

  const totalPeriods = timetables.reduce((acc, tt) => acc + tt.schedule.reduce((a, d) => a + d.periods.length, 0), 0);

  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
          {teacher?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{teacher?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{teacher?.designation || teacher?.department || 'Teacher'} · {totalPeriods} periods/week</div>
        </div>
      </div>

      {isLoading ? <div style={{ padding: 40 }}><PageLoader /></div> : timetables.length === 0 ? (
        <div style={{ padding: 32 }}><EmptyState icon={Clock} message="No timetable assigned to this teacher yet" /></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                <th style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', width: 70 }}>P#</th>
                {activeDays.map(day => (
                  <th key={day} style={{ padding: '10px 16px', color: 'white', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{DAY_LABELS[day]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => (
                <tr key={p} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 16px', background: '#f8fafc', textAlign: 'center', borderRight: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)' }}>P{p}</td>
                  {activeDays.map(day => {
                    const cell = getCell(day, p);
                    return (
                      <td key={day} style={{ padding: 5, textAlign: 'center', minWidth: 100 }}>
                        {cell ? (
                          <div style={{ borderRadius: 8, padding: '7px 8px', background: `${cell.subject?.color || '#1a56e8'}14`, border: `1px solid ${cell.subject?.color || '#1a56e8'}35`, minHeight: 50 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: cell.subject?.color || 'var(--primary)' }}>{cell.subject?.name || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{cell.cls?.name} {cell.cls?.section}</div>
                          </div>
                        ) : (
                          <div style={{ minHeight: 50, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13, color: '#d1d5db' }}>—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Substitution Panel ────────────────────────────────────────────────────────
function SubstitutionPanel({ teacherId, teacher, academicYear }) {
  const [absentDate, setAbsentDate] = useState('');

  const absentDay = absentDate
    ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(absentDate + 'T00:00:00').getDay()]
    : null;

  const { data: ttData } = useQuery({
    queryKey: ['timetable-teacher', teacherId, academicYear],
    queryFn: () => api.get(`/timetable?teacherId=${teacherId}&academicYear=${academicYear}`),
    enabled: !!teacherId
  });
  const timetables = ttData?.timetables || [];

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['day-substitutes', absentDay, academicYear],
    queryFn: () => api.get(`/timetable/day-substitutes?day=${absentDay}&academicYear=${academicYear}`),
    enabled: !!absentDay
  });
  const substitutes = subData?.substitutes || {};

  const teacherPeriods = absentDay ? (() => {
    const periods = [];
    for (const tt of timetables) {
      const ds = tt.schedule.find(s => s.day === absentDay);
      if (!ds) continue;
      for (const p of ds.periods) {
        periods.push({ periodNumber: p.periodNumber, subject: p.subject, cls: tt.class });
      }
    }
    return periods.sort((a, b) => a.periodNumber - b.periodNumber);
  })() : [];

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <UserX size={18} color="#ef4444" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Substitution Planner</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mark {teacher?.name} absent and find available substitutes for each period</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Absent Date</label>
            <input type="date" className="form-control" style={{ maxWidth: 180 }} value={absentDate} onChange={e => setAbsentDate(e.target.value)} />
          </div>
          {absentDay && (
            <div style={{ padding: '6px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserX size={13} />
              {teacher?.name} absent on {DAY_FULL[absentDay]}
            </div>
          )}
        </div>

        {!absentDay && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Select a date to see substitution suggestions
          </div>
        )}

        {absentDay && teacherPeriods.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {teacher?.name} has no periods on {DAY_FULL[absentDay]}. No substitutions needed.
          </div>
        )}

        {absentDay && teacherPeriods.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              {teacherPeriods.length} period{teacherPeriods.length > 1 ? 's' : ''} need coverage on {DAY_FULL[absentDay]}:
            </div>
            {teacherPeriods.map(tp => {
              const freeSubs = substitutes[tp.periodNumber] || [];
              // Exclude the absent teacher from suggestions
              const availSubs = freeSubs.filter(t => t._id !== teacherId);
              return (
                <div key={tp.periodNumber} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Period header */}
                  <div style={{ padding: '10px 16px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: tp.subject?.color || 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>P{tp.periodNumber}</div>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{tp.subject?.name || 'No Subject'}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{tp.cls?.name} {tp.cls?.section}</span>
                      </div>
                    </div>
                    {subLoading ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: availSubs.length > 0 ? '#dcfce7' : '#fef2f2', color: availSubs.length > 0 ? '#15803d' : '#dc2626' }}>
                        {availSubs.length} available
                      </span>
                    )}
                  </div>

                  {/* Free teachers list */}
                  <div style={{ padding: '10px 16px' }}>
                    {subLoading ? (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Finding available teachers...</span>
                    ) : availSubs.length === 0 ? (
                      <span style={{ fontSize: 13, color: '#dc2626' }}>No free teachers available for this period</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {availSubs.map(t => (
                          <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '5px 12px 5px 6px' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#065f46', lineHeight: 1.2 }}>{t.name}</div>
                              {t.designation && <div style={{ fontSize: 10, color: '#047857', lineHeight: 1.2 }}>{t.designation}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Cell Modal (unchanged) ───────────────────────────────────────────────
function EditCellModal({ cell, day, period, subjects, teachers, onSave, onClose, onClear }) {
  const [subjectId, setSubjectId] = useState(cell?.subject?._id || cell?.subject || '');
  const [teacherId, setTeacherId] = useState(cell?.teacher?._id || cell?.teacher || '');
  const [room, setRoom] = useState(cell?.room || '');
  const [isBreak, setIsBreak] = useState(cell?.isBreak || false);
  const [breakName, setBreakName] = useState(cell?.breakName || '');
  const [startTime, setStartTime] = useState(cell?.startTime || '');
  const [endTime, setEndTime] = useState(cell?.endTime || '');

  return (
    <Modal open onClose={onClose} title={`${day.charAt(0).toUpperCase() + day.slice(1)} — Period ${period}`} size="sm"
      footer={<>
        <button className="btn btn-danger btn-sm" onClick={onClear}>Clear</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave({ subject: subjectId || null, teacher: teacherId || null, room, isBreak, breakName, startTime, endTime })}>Save</button>
      </>}>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={isBreak} onChange={e => setIsBreak(e.target.checked)} />
          <span className="form-label" style={{ marginBottom: 0 }}>Mark as Break</span>
        </label>
      </div>
      {isBreak ? (
        <div className="form-group">
          <label className="form-label">Break Name</label>
          <input className="form-control" value={breakName} onChange={e => setBreakName(e.target.value)} placeholder="e.g. Lunch Break" />
        </div>
      ) : <>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <select className="form-control" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">Select subject</option>
            {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Teacher</label>
          <select className="form-control" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
            <option value="">Select teacher</option>
            {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input className="form-control" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input className="form-control" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </FormRow>
        <div className="form-group">
          <label className="form-label">Room</label>
          <input className="form-control" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 101" />
        </div>
      </>}
    </Modal>
  );
}
