import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Save, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageLoader, EmptyState, Modal, FormRow } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };

export default function Timetable() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [academicYear] = useState(user?.school?.academicYear?.current || '2024-2025');
  const [editMode, setEditMode] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [editCell, setEditCell] = useState(null); // { day, period }
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: subjectData } = useQuery({
    queryKey: ['subjects', classId], enabled: !!classId,
    queryFn: () => api.get(`/subjects?classId=${classId}`)
  });
  const subjects = subjectData?.subjects || [];

  const { data: empData } = useQuery({
    queryKey: ['teachers'], queryFn: () => api.get('/employees?role=teacher&limit=100')
  });
  const teachers = empData?.employees || [];

  const { data: ttData, isLoading } = useQuery({
    queryKey: ['timetable', classId, academicYear],
    enabled: !!classId,
    queryFn: () => api.get(`/timetable?classId=${classId}&academicYear=${academicYear}`),
    onSuccess: (data) => {
      if (data.timetable) {
        setSchedule(data.timetable.schedule || []);
      } else {
        initSchedule();
      }
    }
  });

  const periodsPerDay = user?.school?.periodsPerDay || 8;

  const initSchedule = () => {
    const activeDays = DAYS.filter(d => {
      const wd = user?.school?.workingDays;
      return !wd || wd[d] !== false;
    });
    setSchedule(activeDays.map(day => ({
      day,
      periods: Array.from({ length: periodsPerDay }, (_, i) => ({
        periodNumber: i + 1,
        startTime: '',
        endTime: '',
        subject: null,
        teacher: null,
        room: '',
        isBreak: false
      }))
    })));
  };

  const getCell = (day, periodNum) => {
    const daySchedule = schedule.find(s => s.day === day);
    return daySchedule?.periods?.find(p => p.periodNumber === periodNum);
  };

  const updateCell = (day, periodNum, updates) => {
    setSchedule(prev => prev.map(s => {
      if (s.day !== day) return s;
      return {
        ...s,
        periods: s.periods.map(p =>
          p.periodNumber === periodNum ? { ...p, ...updates } : p
        )
      };
    }));
  };

  const saveSchedule = async () => {
    if (!classId) return toast.error('Select a class');
    setSaving(true);
    setConflict(null);
    try {
      await api.post('/timetable', { classId, academicYear, schedule });
      toast.success('Timetable saved!');
      qc.invalidateQueries(['timetable']);
      setEditMode(false);
    } catch (err) {
      if (err.conflicts) {
        setConflict(err.conflicts[0]?.message || 'Conflict detected');
        toast.error('Timetable conflict detected!');
      } else {
        toast.error(err.message || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const activeDays = schedule.map(s => s.day);

  const getPeriodTimeLabel = (periodNum) => {
    for (const daySchedule of schedule) {
      const period = daySchedule.periods?.find(p => p.periodNumber === periodNum);
      if (period?.startTime && period?.endTime) {
        const fmt = (t) => {
          const [h, m] = t.split(':');
          const hour = parseInt(h, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const h12 = hour % 12 || 12;
          return `${h12}:${m} ${ampm}`;
        };
        return `${fmt(period.startTime)} – ${fmt(period.endTime)}`;
      }
    }
    return `P${periodNum}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">Manage class schedules with conflict detection</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {classId && !editMode && <button className="btn btn-secondary" onClick={() => { setEditMode(true); if (!schedule.length) initSchedule(); }}><Plus size={16} /> Edit Timetable</button>}
          {editMode && (
            <>
              <button className="btn btn-secondary" onClick={() => { setEditMode(false); qc.invalidateQueries(['timetable']); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSchedule} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} />Saving...</> : <><Save size={16} /> Save</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Class selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select className="form-control" style={{ maxWidth: 220 }} value={classId} onChange={e => { setClassId(e.target.value); setEditMode(false); setConflict(null); }}>
          <option value="">Select Class</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        <span className="text-14-regular" style={{ color: 'var(--text-muted)' }}>{academicYear}</span>
      </div>

      {/* Conflict warning */}
      {conflict && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="text-14-semibold" style={{ color: '#dc2626' }}>Timetable Conflict</div>
            <div className="text-14-regular" style={{ color: '#991b1b' }}>{conflict}</div>
          </div>
        </div>
      )}

      {!classId ? (
        <div className="card"><EmptyState icon={Clock} message="Select a class to view or edit its timetable" /></div>
      ) : isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                <th className="text-12-semibold" style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', width: 80 }}>Period</th>
                {activeDays.map(day => (
                  <th key={day} className="text-14-bold" style={{ padding: '12px 16px', color: 'white', textAlign: 'center', textTransform: 'capitalize' }}>
                    {DAY_LABELS[day] || day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => (
                <tr key={p} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 16px', background: '#f8fafc', color: 'var(--text-secondary)', textAlign: 'center', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 110 }}>
                    {(() => {
                      const timeLabel = getPeriodTimeLabel(p);
                      if (timeLabel === `P${p}`) {
                        return <span className="text-14-bold">P{p}</span>;
                      }
                      return (
                        <>
                          <div className="text-12-semibold">P{p}</div>
                          <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 1 }}>{timeLabel}</div>
                        </>
                      );
                    })()}
                  </td>
                  {activeDays.map(day => {
                    const cell = getCell(day, p);
                    const subj = cell?.subject ? (typeof cell.subject === 'object' ? cell.subject : subjects.find(s => s._id === cell.subject)) : null;
                    const teacher = cell?.teacher ? (typeof cell.teacher === 'object' ? cell.teacher : teachers.find(t => t._id === cell.teacher)) : null;
                    const isBreak = cell?.isBreak;

                    return (
                      <td key={day} style={{ padding: 4, textAlign: 'center', verticalAlign: 'top', minWidth: 100 }}>
                        {isBreak ? (
                          <div className="text-12-regular" style={{ background: '#f1f5f9', borderRadius: 8, padding: '8px 4px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {cell?.breakName || 'Break'}
                          </div>
                        ) : editMode ? (
                          <button
                            onClick={() => setEditCell({ day, period: p })}
                            style={{
                              width: '100%', minHeight: 60, border: `2px dashed ${subj ? subj.color || 'var(--primary)' : 'var(--border)'}`,
                              borderRadius: 8, background: subj ? `${subj.color || '#1a56e8'}15` : 'white',
                              cursor: 'pointer', padding: '6px 8px', transition: 'all 0.15s'
                            }}
                          >
                            {subj ? (
                              <>
                                <div className="text-12-bold" style={{ color: subj.color || 'var(--primary)' }}>{subj.name}</div>
                                {teacher && <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{teacher.name}</div>}
                              </>
                            ) : <span className="text-12-regular" style={{ color: 'var(--text-muted)' }}>+ Add</span>}
                          </button>
                        ) : (
                          <div style={{
                            minHeight: 60, borderRadius: 8, padding: '8px',
                            background: subj ? `${subj.color || '#1a56e8'}12` : '#f8fafc',
                            border: `1px solid ${subj ? `${subj.color || '#1a56e8'}30` : 'transparent'}`
                          }}>
                            {subj ? (
                              <>
                                <div className="text-12-bold" style={{ color: subj.color || 'var(--primary)' }}>{subj.name}</div>
                                {teacher && <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{teacher.name}</div>}
                              </>
                            ) : <span className="text-12-regular" style={{ color: '#e2e8f0' }}>—</span>}
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

      {/* Edit Cell Modal */}
      {editCell && (
        <EditCellModal
          cell={getCell(editCell.day, editCell.period)}
          day={editCell.day}
          period={editCell.period}
          subjects={subjects}
          teachers={teachers}
          onSave={(updates) => { updateCell(editCell.day, editCell.period, updates); setEditCell(null); }}
          onClose={() => setEditCell(null)}
          onClear={() => { updateCell(editCell.day, editCell.period, { subject: null, teacher: null, room: '', isBreak: false, breakName: '' }); setEditCell(null); }}
        />
      )}
    </div>
  );
}

function EditCellModal({ cell, day, period, subjects, teachers, onSave, onClose, onClear }) {
  const [subjectId, setSubjectId] = useState(cell?.subject?._id || cell?.subject || '');
  const [teacherId, setTeacherId] = useState(cell?.teacher?._id || cell?.teacher || '');
  const [room, setRoom] = useState(cell?.room || '');
  const [isBreak, setIsBreak] = useState(cell?.isBreak || false);
  const [breakName, setBreakName] = useState(cell?.breakName || '');
  const [startTime, setStartTime] = useState(cell?.startTime || '');
  const [endTime, setEndTime] = useState(cell?.endTime || '');

  return (
    <Modal open onClose={onClose} title={`${day.charAt(0).toUpperCase() + day.slice(1)} - Period ${period}`}
      size="sm"
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
      ) : (
        <>
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
        </>
      )}
    </Modal>
  );
}
