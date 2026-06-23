import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Save, AlertTriangle, BookOpen, Users, UserX, ChevronRight, Check, X, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select as AntSelect, DatePicker, TimePicker } from 'antd';
import dayjs from 'dayjs';

// Build a dayjs from an "HH:mm" string without needing the customParseFormat plugin.
const hhmmToDayjs = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (isNaN(h)) return null;
  return dayjs().hour(h).minute(m || 0).second(0).millisecond(0);
};
import api from '../../utils/api';
import { PageLoader, EmptyState, Modal, FormRow } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';
import { useYear } from '../../store/YearContext';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };
const DAY_FULL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function Timetable() {
  const { user } = useAuth();
  const { selectedYear } = useYear();
  const [view, setView] = useState('class');

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = schoolData?.school;

  const academicYear = selectedYear || school?.academicYear?.current || user?.school?.academicYear?.current || '2024-2025';
  const periodsPerDay = school?.periodsPerDay || user?.school?.periodsPerDay || 8;
  const workingDays = school?.workingDays || user?.school?.workingDays;

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = (() => {
    const raw = classData?.classes || [];
    const saved = JSON.parse(localStorage.getItem('sklproj_class_order') || '[]');
    if (!saved.length) return raw;
    return [...raw].sort((a, b) => {
      const ai = saved.indexOf(a._id);
      const bi = saved.indexOf(b._id);
      return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });
  })();

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
        ? <ClassView classes={classes} teachers={teachers} workingDays={workingDays} academicYear={academicYear} periodsPerDay={periodsPerDay} />
        : <TeacherView teachers={teachers} academicYear={academicYear} periodsPerDay={periodsPerDay} />
      }
    </div>
  );
}

// ─── Class View ────────────────────────────────────────────────────────────────
function ClassView({ classes, teachers, workingDays, academicYear, periodsPerDay }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState(classes[0]?._id || '');
  const [editMode, setEditMode] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editPeriodTime, setEditPeriodTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [showStructure, setShowStructure] = useState(false);
  const [localStructure, setLocalStructure] = useState(null);

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/subjects')
  });
  const allSubjects = subjectData?.subjects || [];

  const selectedClass = classes.find(c => c._id === classId);
  const subjects = selectedClass?.subjects?.length
    ? allSubjects.filter(s => selectedClass.subjects.some(cs => (cs._id || cs) === s._id))
    : allSubjects;

  // Per-class period structure (periods + breaks). null = no structure → fall back
  // to school.periodsPerDay (all periods, no breaks).
  const struct = localStructure || (selectedClass?.periodStructure?.length ? selectedClass.periodStructure : null);
  const periodCount = struct ? struct.length : periodsPerDay;
  const activeDaysList = DAYS.filter(d => !workingDays || workingDays[d] !== false);
  // Build a day schedule from a structure, preserving existing subject/teacher
  // assignments by period number.
  const buildFromStructure = (slots, existing, days) => days.map(day => {
    const prevPeriods = existing.find(s => s.day === day)?.periods || [];
    return { day, periods: slots.map((slot, i) => {
      const prev = prevPeriods.find(p => p.periodNumber === i + 1) || {};
      if (slot.kind === 'break') return { periodNumber: i + 1, isBreak: true, breakName: slot.name || 'Break', startTime: slot.startTime || '', endTime: slot.endTime || '', subject: null, teacher: null, room: '' };
      return { periodNumber: i + 1, isBreak: false, breakName: '', startTime: slot.startTime || prev.startTime || '', endTime: slot.endTime || prev.endTime || '', subject: prev.isBreak ? null : (prev.subject || null), teacher: prev.isBreak ? null : (prev.teacher || null), room: prev.isBreak ? '' : (prev.room || '') };
    }) };
  });

  const { data: ttData, isLoading } = useQuery({
    queryKey: ['timetable', classId, academicYear],
    enabled: !!classId,
    queryFn: () => api.get(`/timetable?classId=${classId}&academicYear=${academicYear}`)
  });

  useEffect(() => {
    if (!ttData) return;
    if (ttData.timetable) {
      const loaded = ttData.timetable.schedule || [];
      setSchedule(struct ? buildFromStructure(struct, loaded, activeDaysList) : loaded);
    } else initSchedule();
  }, [ttData]);

  const initSchedule = () => {
    if (struct) { setSchedule(buildFromStructure(struct, [], activeDaysList)); return; }
    setSchedule(activeDaysList.map(day => ({
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

  const getPeriodRawTime = (periodNum) => {
    for (const ds of schedule) {
      const p = ds.periods?.find(p => p.periodNumber === periodNum);
      if (p?.startTime || p?.endTime) return { startTime: p.startTime || '', endTime: p.endTime || '' };
    }
    return { startTime: '', endTime: '' };
  };

  const activeDays = schedule.map(s => s.day);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <AntSelect
          style={{ width: 220, height: 36, fontSize: 14 }}
          value={classId || undefined}
          placeholder="Select class"
          showSearch
          optionFilterProp="label"
          onChange={val => { setClassId(val); setEditMode(false); setConflict(null); setLocalStructure(null); }}
          options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{academicYear}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {classId && !editMode && <button className="btn btn-secondary" onClick={() => setShowStructure(true)}><Clock size={16} /> Period Structure</button>}
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
      ) : isLoading ? <PageLoader /> : (() => {
        const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
        const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
        const breakInfoByPeriod = {};
        periods.forEach(p => {
          const cell = activeDays.map(d => getCell(d, p)).find(c => c?.isBreak);
          if (cell) breakInfoByPeriod[p] = cell;
        });

        return (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', width: 100 }}>Day</th>
                  {periods.map(p => {
                    const brk = breakInfoByPeriod[p];
                    const timeLabel = brk?.startTime && brk?.endTime ? `${fmtTime(brk.startTime)} – ${fmtTime(brk.endTime)}` : getPeriodTimeLabel(p);
                    return brk ? (
                      <th key={p}
                        style={{ padding: '12px 8px', textAlign: 'center', background: '#78350f', width: 80, userSelect: 'none' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {brk.breakName || 'Break'}
                        </div>
                        {timeLabel && <div style={{ fontSize: 10, color: 'rgba(253,230,138,0.6)', fontWeight: 400, marginTop: 2 }}>{timeLabel}</div>}
                      </th>
                    ) : (
                      <th key={p}
                        style={{ padding: '12px 8px', color: 'white', textAlign: 'center', fontSize: 13, fontWeight: 700, minWidth: 110, userSelect: 'none' }}>
                        <div>P{p}</div>
                        {getPeriodTimeLabel(p) && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 400, marginTop: 2 }}>{getPeriodTimeLabel(p)}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeDays.map((day, dayIdx) => (
                  <tr key={day} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 16px', background: '#f8fafc', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{DAY_FULL[day]}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DAY_LABELS[day]}</div>
                    </td>
                    {periods.map(p => {
                      const brk = breakInfoByPeriod[p];
                      if (brk) {
                        if (dayIdx > 0) return null;
                        const timeLabel = brk.startTime && brk.endTime ? `${fmtTime(brk.startTime)} – ${fmtTime(brk.endTime)}` : null;
                        return (
                          <td key={p} rowSpan={activeDays.length} style={{
                            padding: '6px 4px',
                            background: 'white',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                            width: 64,
                          }}>
                            <div style={{
                              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              background: '#fffbeb',
                              border: '1.5px solid #fde68a',
                              borderRadius: 16,
                              padding: '18px 8px',
                              gap: 10,
                              width: 44,
                              minHeight: 140,
                            }}>
                              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 800, color: '#78350f', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                                {brk.breakName || 'Break'}
                              </div>
                            </div>
                          </td>
                        );
                      }

                      const cell = getCell(day, p);
                      const subj = cell?.subject ? (typeof cell.subject === 'object' ? cell.subject : subjects.find(s => s._id === cell.subject)) : null;
                      const tchr = cell?.teacher ? (typeof cell.teacher === 'object' ? cell.teacher : teachers.find(t => t._id === cell.teacher)) : null;
                      return (
                        <td key={p} style={{ padding: 4, textAlign: 'center', verticalAlign: 'top', minWidth: 110 }}>
                          {editMode ? (
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
        );
      })()}

      {editCell && (
        <EditCellModal
          cell={getCell(editCell.day, editCell.period)}
          day={editCell.day} period={editCell.period}
          subjects={subjects} teachers={teachers}
          onSave={u => {
            if (u.isBreak) {
              activeDays.forEach(d => updateCell(d, editCell.period, u));
            } else {
              if (activeDays.some(d => getCell(d, editCell.period)?.isBreak)) {
                activeDays.forEach(d => updateCell(d, editCell.period, { subject: null, teacher: null, room: '', isBreak: false, breakName: '' }));
              }
              updateCell(editCell.day, editCell.period, u);
            }
            setEditCell(null);
          }}
          onClose={() => setEditCell(null)}
          onClear={() => {
            if (activeDays.some(d => getCell(d, editCell.period)?.isBreak)) {
              activeDays.forEach(d => updateCell(d, editCell.period, { subject: null, teacher: null, room: '', isBreak: false, breakName: '' }));
            } else {
              updateCell(editCell.day, editCell.period, { subject: null, teacher: null, room: '', isBreak: false, breakName: '' });
            }
            setEditCell(null);
          }}
        />
      )}

      {showStructure && (
        <StructureEditor
          initial={struct || Array.from({ length: periodsPerDay }, () => ({ kind: 'period', name: '', startTime: '', endTime: '' }))}
          onClose={() => setShowStructure(false)}
          onSave={async (slots) => {
            try {
              await api.put(`/classes/${classId}/period-structure`, { periodStructure: slots });
              setLocalStructure(slots.length ? slots : null);
              qc.invalidateQueries(['classes']);
              const eff = slots.length ? slots : Array.from({ length: periodsPerDay }, () => ({ kind: 'period' }));
              setSchedule(buildFromStructure(eff, schedule, activeDaysList));
              setShowStructure(false);
              setEditMode(true);
              toast.success('Period structure saved — now assign subjects & save');
            } catch (e) { toast.error(e.message || 'Failed to save structure'); }
          }}
        />
      )}
    </div>
  );
}

// ─── Period Structure editor (per-class daily template) ─────────────────────────
function StructureEditor({ initial, onClose, onSave }) {
  const [slots, setSlots] = useState(initial.map(s => ({ kind: s.kind || 'period', name: s.name || '', startTime: s.startTime || '', endTime: s.endTime || '' })));
  const add = (kind) => setSlots(p => [...p, { kind, name: kind === 'break' ? 'Break' : '', startTime: '', endTime: '' }]);
  const update = (i, u) => setSlots(p => p.map((s, idx) => idx === i ? { ...s, ...u } : s));
  // Setting a slot's end time auto-fills the next slot's start time (sequential flow).
  const setTime = (i, field, hhmm) => setSlots(prev => {
    const n = prev.map((s, idx) => idx === i ? { ...s, [field]: hhmm } : s);
    if (field === 'endTime' && hhmm && i + 1 < n.length) n[i + 1] = { ...n[i + 1], startTime: hhmm };
    return n;
  });
  const remove = (i) => setSlots(p => p.filter((_, idx) => idx !== i));
  // Drag-and-drop reordering
  const dragItem = useRef(null), dragOverItem = useRef(null);
  const [dragIdx, setDragIdx] = useState(null);
  const onDragStart = (i) => { dragItem.current = i; setDragIdx(i); };
  const onDragEnter = (i) => { dragOverItem.current = i; };
  const onDragEnd = () => {
    const from = dragItem.current, to = dragOverItem.current;
    if (from != null && to != null && from !== to) {
      setSlots(prev => { const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
    }
    dragItem.current = null; dragOverItem.current = null; setDragIdx(null);
  };
  let pc = 0;
  const labels = slots.map(s => s.kind === 'break' ? (s.name || 'Break') : `P${++pc}`);
  return (
    <Modal open onClose={onClose} title="Period Structure" size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(slots)}><Save size={16} /> Save Structure</button>
      </>}>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
        Build the daily sequence of periods and breaks, then set each one&apos;s timing.
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {labels.map((l, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: slots[i].kind === 'break' ? '#fffbeb' : '#eff6ff', color: slots[i].kind === 'break' ? '#b45309' : 'var(--primary)' }}>{l}</span>
          ))}
          {!slots.length && <span style={{ color: 'var(--text-muted)' }}>No slots yet</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
        {slots.map((s, i) => (
          <div key={i}
            onDragEnter={() => onDragEnter(i)}
            onDragOver={e => e.preventDefault()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10, background: s.kind === 'break' ? '#fffdf5' : '#fff', opacity: dragIdx === i ? 0.4 : 1, transition: 'opacity .15s' }}>
            <span draggable onDragStart={() => onDragStart(i)} onDragEnd={onDragEnd}
              style={{ cursor: 'grab', color: '#cbd5e1', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Drag to reorder">
              <GripVertical size={16} />
            </span>
            <span style={{ width: 54, fontWeight: 700, fontSize: 13, color: s.kind === 'break' ? '#b45309' : 'var(--primary)', flexShrink: 0 }}>{labels[i]}</span>
            {s.kind === 'break'
              ? <input className="form-control" style={{ flex: 1, height: 34 }} placeholder="Break name (e.g. Lunch)" value={s.name} onChange={e => update(i, { name: e.target.value })} />
              : <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Teaching period</span>}
            <TimePicker use12Hours format="h:mm A" minuteStep={5} allowClear placeholder="Start"
              style={{ width: 124 }} getPopupContainer={() => document.body}
              value={hhmmToDayjs(s.startTime)}
              onChange={d => setTime(i, 'startTime', d ? d.format('HH:mm') : '')} />
            <span style={{ color: 'var(--text-muted)' }}>–</span>
            <TimePicker use12Hours format="h:mm A" minuteStep={5} allowClear placeholder="End"
              style={{ width: 124 }} getPopupContainer={() => document.body}
              value={hhmmToDayjs(s.endTime)}
              onChange={d => setTime(i, 'endTime', d ? d.format('HH:mm') : '')} />
            <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => remove(i)} title="Remove"><X size={14} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add('period')}><Plus size={14} /> Add Period</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add('break')}><Plus size={14} /> Add Break</button>
      </div>
    </Modal>
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
      ) : (() => {
        const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
        const getPeriodTime = (periodNum) => {
          for (const tt of timetables) {
            for (const ds of tt.schedule) {
              const p = ds.periods?.find(per => per.periodNumber === periodNum && !per.isBreak);
              if (p?.startTime && p?.endTime) return `${fmtTime(p.startTime)} – ${fmtTime(p.endTime)}`;
            }
          }
          return null;
        };
        const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
        return (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 560 }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', width: 100 }}>Day</th>
                  {periods.map(p => (
                    <th key={p} style={{ padding: '12px 8px', color: 'white', textAlign: 'center', fontSize: 13, fontWeight: 700, minWidth: 110 }}>
                      <div>P{p}</div>
                      {getPeriodTime(p) && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 400, marginTop: 2 }}>{getPeriodTime(p)}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeDays.map(day => (
                  <tr key={day} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 16px', background: '#f8fafc', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{DAY_FULL[day]}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DAY_LABELS[day]}</div>
                    </td>
                    {periods.map(p => {
                      const cell = getCell(day, p);
                      return (
                        <td key={p} style={{ padding: 5, textAlign: 'center', minWidth: 110 }}>
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
        );
      })()}
    </div>
  );
}

// ─── Substitution Panel ────────────────────────────────────────────────────────
function SubstitutionPanel({ teacherId, teacher, academicYear }) {
  const qc = useQueryClient();
  const [absentDate, setAbsentDate] = useState('');
  const [pickingPeriod, setPickingPeriod] = useState(null); // periodNumber being assigned

  const absentDay = absentDate
    ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(absentDate + 'T00:00:00').getDay()]
    : null;

  // Teacher's own periods on the absent day
  const { data: ttData } = useQuery({
    queryKey: ['timetable-teacher', teacherId, academicYear],
    queryFn: () => api.get(`/timetable?teacherId=${teacherId}&academicYear=${academicYear}`),
    enabled: !!teacherId
  });
  const timetables = ttData?.timetables || [];

  // Free teachers per period on that day
  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['day-substitutes', absentDay, academicYear],
    queryFn: () => api.get(`/timetable/day-substitutes?day=${absentDay}&academicYear=${academicYear}`),
    enabled: !!absentDay
  });
  const freeSubs = subData?.substitutes || {};

  // Already-assigned substitutions for this teacher+date
  const { data: assignedData, isLoading: assignedLoading } = useQuery({
    queryKey: ['substitutions', teacherId, absentDate],
    queryFn: () => api.get(`/timetable/substitutions?date=${absentDate}&absentTeacherId=${teacherId}`),
    enabled: !!(teacherId && absentDate)
  });
  const assigned = assignedData?.substitutions || [];

  const assignMutation = useMutation({
    mutationFn: ({ substituteTeacherId, periodNumber, classId, subjectId }) =>
      api.post('/timetable/substitutions', { date: absentDate, absentTeacherId: teacherId, substituteTeacherId, periodNumber, classId, subjectId, academicYear }),
    onSuccess: () => {
      qc.invalidateQueries(['substitutions', teacherId, absentDate]);
      setPickingPeriod(null);
      toast.success('Substitute assigned!');
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.delete(`/timetable/substitutions/${id}`),
    onSuccess: () => { qc.invalidateQueries(['substitutions', teacherId, absentDate]); toast.success('Assignment removed'); },
    onError: () => toast.error('Failed to remove')
  });

  const teacherPeriods = absentDay ? (() => {
    const periods = [];
    for (const tt of timetables) {
      const ds = tt.schedule.find(s => s.day === absentDay);
      if (!ds) continue;
      for (const p of ds.periods) {
        if (!p.isBreak) periods.push({ periodNumber: p.periodNumber, subject: p.subject, cls: tt.class });
      }
    }
    return periods.sort((a, b) => a.periodNumber - b.periodNumber);
  })() : [];

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <UserX size={18} color="#ef4444" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Substitution Planner</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assign substitute teachers for {teacher?.name}'s periods</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Absent Date</label>
            <DatePicker
              style={{ width: 180 }}
              format="DD MMM YYYY"
              allowClear={false}
              value={absentDate ? dayjs(absentDate) : null}
              onChange={(d) => { setAbsentDate(d ? d.format('YYYY-MM-DD') : ''); setPickingPeriod(null); }}
              getPopupContainer={() => document.body}
            />
          </div>
          {absentDay && (
            <div style={{ padding: '6px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserX size={13} /> {teacher?.name} absent on {DAY_FULL[absentDay]}
            </div>
          )}
        </div>

        {!absentDay && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Select a date to manage substitutions
          </div>
        )}

        {absentDay && !subLoading && !assignedLoading && (
          <div>
            {/* summary strip */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{teacherPeriods.length}</strong> period{teacherPeriods.length !== 1 ? 's' : ''} need coverage &nbsp;·&nbsp;
                <strong style={{ color: '#16a34a' }}>{assigned.length}</strong> assigned
                {teacherPeriods.length - assigned.length > 0 && <span style={{ color: '#dc2626' }}> &nbsp;·&nbsp; <strong>{teacherPeriods.length - assigned.length}</strong> pending</span>}
              </span>
            </div>

            {/* period table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* header */}
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 180px 80px', background: '#0f172a', padding: '10px 16px', gap: 8 }}>
                {['Period', 'Subject / Class', 'Free Teachers', 'Assigned Substitute', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>

              {Array.from({ length: 8 }, (_, i) => i + 1).map((pNum, idx) => {
                const tp = teacherPeriods.find(p => p.periodNumber === pNum);
                const assignedRow = tp ? assigned.find(a => a.periodNumber === pNum) : null;
                const availList = tp ? (freeSubs[pNum] || []).filter(t => t._id !== teacherId) : [];
                const isPicking = pickingPeriod === pNum;
                const isBusy = !tp;

                return (
                  <div key={pNum}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '56px 1fr 1fr 180px 80px', padding: '12px 16px', gap: 8, alignItems: 'center',
                      background: assignedRow ? '#f0fdf4' : isBusy ? '#fafafa' : 'white',
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                      opacity: isBusy ? 0.5 : 1,
                    }}>
                      {/* Period badge */}
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: isBusy ? '#e2e8f0' : (tp?.subject?.color || 'var(--primary)'), color: isBusy ? '#94a3b8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                        P{pNum}
                      </div>

                      {/* Subject / Class */}
                      <div>
                        {tp ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{tp.subject?.name || 'No Subject'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tp.cls?.name} {tp.cls?.section}</div>
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No class</span>
                        )}
                      </div>

                      {/* Free teachers count */}
                      <div>
                        {tp ? (
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: availList.length > 0 ? '#dcfce7' : '#fef2f2', color: availList.length > 0 ? '#15803d' : '#dc2626' }}>
                            {availList.length} free
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>

                      {/* Assigned substitute */}
                      <div>
                        {assignedRow ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {assignedRow.substituteTeacher?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{assignedRow.substituteTeacher?.name}</div>
                              {assignedRow.substituteTeacher?.designation && <div style={{ fontSize: 10, color: '#047857' }}>{assignedRow.substituteTeacher.designation}</div>}
                            </div>
                          </div>
                        ) : tp ? (
                          <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>Not assigned</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>

                      {/* Action */}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {tp && (
                          <>
                            <button className="btn btn-primary btn-sm"
                              onClick={() => setPickingPeriod(isPicking ? null : pNum)}
                              style={{ fontSize: 12, padding: '4px 12px' }}>
                              {assignedRow ? 'Change' : 'Assign'}
                            </button>
                            {assignedRow && (
                              <button className="btn btn-secondary btn-sm btn-icon"
                                onClick={() => removeMutation.mutate(assignedRow._id)}
                                style={{ color: '#ef4444' }} title="Remove">
                                <X size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable teacher picker */}
                    {isPicking && (
                      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#f8fafc' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                          Select a substitute for Period {pNum}:
                        </div>
                        {availList.length === 0 ? (
                          <span style={{ fontSize: 13, color: '#dc2626' }}>No free teachers available for this period</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {availList.map(t => {
                              const isCurrentlyAssigned = assignedRow?.substituteTeacher?._id === t._id || assignedRow?.substituteTeacher === t._id;
                              return (
                                <button key={t._id}
                                  onClick={() => assignMutation.mutate({ substituteTeacherId: t._id, periodNumber: pNum, classId: tp?.cls?._id, subjectId: tp?.subject?._id })}
                                  disabled={assignMutation.isPending}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: isCurrentlyAssigned ? '#dcfce7' : 'white', border: `1.5px solid ${isCurrentlyAssigned ? '#86efac' : 'var(--border)'}`, borderRadius: 10, padding: '7px 14px 7px 8px', cursor: 'pointer', transition: 'all 0.15s' }}>
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isCurrentlyAssigned ? '#16a34a' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                    {t.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: isCurrentlyAssigned ? '#15803d' : 'var(--text-primary)' }}>{t.name}</div>
                                    {t.designation && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.designation}</div>}
                                  </div>
                                  {isCurrentlyAssigned && <Check size={13} color="#16a34a" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Period Time Picker (module-level to avoid remount/focus-loss) ────────────
function TimeInput({ label, value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className="form-control" type="number" min={1} max={12}
          value={value.h} onChange={e => onChange({ ...value, h: e.target.value })}
          placeholder="hh" style={{ width: 64, textAlign: 'center' }} />
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>:</span>
        <input className="form-control" type="number" min={0} max={59}
          value={value.m} onChange={e => onChange({ ...value, m: e.target.value })}
          placeholder="mm" style={{ width: 64, textAlign: 'center' }} />
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
          {['AM', 'PM'].map(ap => (
            <button key={ap} type="button" onClick={() => onChange({ ...value, ampm: ap })}
              style={{ padding: '8px 13px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: value.ampm === ap ? 'var(--primary)' : 'white',
                color: value.ampm === ap ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s' }}>
              {ap}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PeriodTimeModal({ period, currentStart, currentEnd, onSave, onClose }) {
  const parse12 = (t) => {
    if (!t) return { h: '8', m: '00', ampm: 'AM' };
    const [hStr, m] = t.split(':');
    const h24 = parseInt(hStr, 10);
    return { h: String(h24 % 12 || 12), m: m || '00', ampm: h24 >= 12 ? 'PM' : 'AM' };
  };
  const to24 = ({ h, m, ampm }) => {
    if (!h) return '';
    let h24 = parseInt(h, 10) % 12;
    if (ampm === 'PM') h24 += 12;
    return `${String(h24).padStart(2, '0')}:${String(m || '0').padStart(2, '0')}`;
  };

  const [start, setStart] = useState(parse12(currentStart));
  const [end, setEnd] = useState(parse12(currentEnd));

  return (
    <Modal open onClose={onClose} title={`Period ${period} — Set Time`} size="sm"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(to24(start), to24(end))}>Apply to All Days</button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Sets the same time for <strong>all days</strong> in Period {period}.
      </p>
      <TimeInput label="Start Time" value={start} onChange={setStart} />
      <TimeInput label="End Time" value={end} onChange={setEnd} />
    </Modal>
  );
}

// ─── Edit Cell Modal ───────────────────────────────────────────────────────────
function EditCellModal({ cell, day, period, subjects, teachers, onSave, onClose, onClear }) {
  const [subjectId, setSubjectId] = useState(cell?.subject?._id || cell?.subject || '');
  const [teacherId, setTeacherId] = useState(cell?.teacher?._id || cell?.teacher || '');
  const [room, setRoom] = useState(cell?.room || '');

  // Teachers assigned to the chosen subject (Subjects module). Fall back to all
  // teachers only when the subject has none assigned.
  const subjOf = (id) => subjects.find(s => s._id === id);
  const teachersForSubject = (subj) => subj ? (subj.teachers?.length ? subj.teachers : (subj.teacher ? [subj.teacher] : [])) : [];
  const subjectTeachers = teachersForSubject(subjOf(subjectId));
  const teacherOpts = subjectTeachers.length ? subjectTeachers : teachers;

  return (
    <Modal open onClose={onClose} title={`${day.charAt(0).toUpperCase() + day.slice(1)} — Period ${period}`} size="sm"
      footer={<>
        <button className="btn btn-danger btn-sm" onClick={onClear}>Clear</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave({
          subject: subjectId || null, teacher: teacherId || null, room,
          startTime: cell?.startTime || '', endTime: cell?.endTime || ''
        })}>Save</button>
      </>}>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <AntSelect
            style={{ width: '100%' }}
            placeholder="Select subject"
            allowClear
            showSearch
            optionFilterProp="label"
            value={subjectId || undefined}
            onChange={val => {
              const next = val ?? '';
              setSubjectId(next);
              const list = teachersForSubject(subjOf(next));
              if (list.length && !list.some(t => (t._id || t) === teacherId)) setTeacherId('');
            }}
            options={subjects.map(s => ({ value: s._id, label: s.name, color: s.color }))}
            optionRender={(option) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {option.data.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: option.data.color, flexShrink: 0 }} />}
                <span>{option.data.label}</span>
              </div>
            )}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Teacher</label>
          <AntSelect
            style={{ width: '100%' }}
            placeholder="Select teacher"
            allowClear
            showSearch
            optionFilterProp="label"
            value={teacherId || undefined}
            onChange={val => setTeacherId(val ?? '')}
            disabled={!subjectId}
            options={teacherOpts.map(t => ({ value: t._id || t, label: t.name || t, designation: t.designation }))}
            optionRender={(option) => (
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{option.data.label}</div>
                {option.data.designation && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{option.data.designation}</div>}
              </div>
            )}
          />
        </div>
    </Modal>
  );
}
