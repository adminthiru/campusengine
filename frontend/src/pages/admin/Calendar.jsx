import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, CalendarDays, List, X, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { useYear } from '../../store/YearContext';
import { usePermissions } from '../../store/usePermissions';

const TYPE_CONFIG = {
  holiday:  { label: 'Holiday',   color: '#ef4444', bg: '#fef2f2' },
  event:    { label: 'Event',     color: '#8b5cf6', bg: '#f5f3ff' },
  exam_day: { label: 'Exam Day',  color: '#f59e0b', bg: '#fffbeb' },
  meeting:  { label: 'Meeting',   color: '#10b981', bg: '#ecfdf5' },
  other:    { label: 'Other',     color: '#64748b', bg: '#f8fafc' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function typeColor(type)  { return TYPE_CONFIG[type]?.color  || '#64748b'; }
function typeBg(type)     { return TYPE_CONFIG[type]?.bg     || '#f8fafc'; }
function typeLabel(type)  { return TYPE_CONFIG[type]?.label  || 'Other'; }

function fmtDate(d) {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()].slice(0,3)} ${dt.getFullYear()}`;
}
function toInputDate(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0,10);
}

export default function Calendar() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const today = new Date();
  const { selectedYear, startMonth, isCurrent } = useYear();

  // Derive the display month to jump to when the selected year changes:
  // current year → stay on today's month; past/future year → jump to AY start month.
  const initialMonth = isCurrent ? today.getMonth() + 1 : startMonth;
  const initialYear  = parseInt(selectedYear); // "2027-2028" → 2027

  const [year,  setYear]  = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [view,  setView]  = useState('calendar'); // 'calendar' | 'list'

  // Reset the displayed month whenever the header year selector changes.
  useEffect(() => {
    setYear(parseInt(selectedYear));
    setMonth(isCurrent ? today.getMonth() + 1 : startMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);
  const [modal, setModal] = useState(null); // null | { mode:'add'|'edit', event?, date? }
  const [form,  setForm]  = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => api.get(`/calendar?year=${year}&month=${month}`),
  });
  const events = data?.events || [];

  // For list view — full year
  const { data: yearData } = useQuery({
    queryKey: ['calendar-year', year],
    queryFn: () => api.get(`/calendar?year=${year}`),
    enabled: view === 'list',
  });
  const allEvents = yearData?.events || [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['calendar'] });
    qc.invalidateQueries({ queryKey: ['calendar-year'] });
  };

  const createMut = useMutation({
    mutationFn: (body) => api.post('/calendar', body),
    onSuccess: () => { toast.success('Event added'); closeModal(); invalidate(); },
    onError:   (e)  => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/calendar/${id}`, body),
    onSuccess: () => { toast.success('Event updated'); closeModal(); invalidate(); },
    onError:   (e)  => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/calendar/${id}`),
    onSuccess: () => { toast.success('Event deleted'); invalidate(); },
    onError:   (e)  => toast.error(e.response?.data?.message || 'Failed'),
  });

  // ── Calendar grid helpers ─────────────────────────────────────────────────
  const daysInMonth  = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const d = new Date(ev.date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(ev);
    });
    return map;
  }, [events]);

  const dayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1);  } else setMonth(m => m+1); setSelectedDay(null); };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openAdd = (day) => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setForm({ date: dateStr, type: 'event', title: '' });
    setModal({ mode: 'add' });
  };
  const openEdit = (ev, e) => {
    e.stopPropagation();
    setForm({ title: ev.title, date: toInputDate(ev.date), endDate: ev.endDate ? toInputDate(ev.endDate) : '', type: ev.type, description: ev.description || '' });
    setModal({ mode: 'edit', event: ev });
  };
  const closeModal = () => { setModal(null); setForm({}); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title?.trim()) return toast.error('Title is required');
    if (!form.date) return toast.error('Date is required');
    const body = { title: form.title.trim(), date: form.date, type: form.type || 'event', description: form.description || '' };
    if (form.endDate) body.endDate = form.endDate;
    if (modal.mode === 'add') createMut.mutate(body);
    else updateMut.mutate({ id: modal.event._id, body });
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this event?')) deleteMut.mutate(id);
  };

  // ── Grouped list ─────────────────────────────────────────────────────────
  const groupedList = useMemo(() => {
    const groups = {};
    allEvents.forEach(ev => {
      const key = MONTHS[new Date(ev.date).getMonth()];
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return groups;
  }, [allEvents]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">School Calendar</h1>
          <p className="page-subtitle">Manage holidays, events and important dates</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {can('calendar', 'edit') && (
            <button className="btn btn-secondary" onClick={() => setScheduleModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings2 size={16} /> Work Schedule
            </button>
          )}
          {can('calendar', 'add') && (
            <button className="btn btn-primary" onClick={() => openAdd(today.getDate())} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Add Event
            </button>
          )}
        </div>
      </div>

      {/* Legend + View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{v.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          <button onClick={() => setView('calendar')} style={{ padding: '7px 14px', border: 'none', background: view === 'calendar' ? 'var(--primary)' : 'transparent', color: view === 'calendar' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <CalendarDays size={15} /> Month
          </button>
          <button onClick={() => setView('list')} style={{ padding: '7px 14px', border: 'none', background: view === 'list' ? 'var(--primary)' : 'transparent', color: view === 'list' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <List size={15} /> List
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <CalendarView
          year={year} month={month} daysInMonth={daysInMonth} firstWeekday={firstWeekday}
          eventsByDay={eventsByDay} selectedDay={selectedDay} dayEvents={dayEvents}
          today={today} isLoading={isLoading} can={can}
          onPrev={prevMonth} onNext={nextMonth}
          onDayClick={(d) => setSelectedDay(sel => sel === d ? null : d)}
          onAddClick={openAdd} onEdit={openEdit} onDelete={handleDelete}
        />
      ) : (
        <ListView year={year} setYear={setYear} groupedList={groupedList} can={can} onEdit={openEdit} onDelete={handleDelete} onAdd={() => openAdd(1)} />
      )}

      {/* Work Schedule Modal */}
      {scheduleModal && <WorkScheduleModal onClose={() => setScheduleModal(false)} />}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{modal.mode === 'add' ? 'Add Event' : 'Edit Event'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label className="form-label">Title *</label>
                  <input className="form-control" value={form.title || ''} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Republic Day, Annual Day" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Date *</label>
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Select date"
                      value={form.date ? dayjs(form.date) : null}
                      onChange={(d) => setForm(f => ({ ...f, date: d ? d.format('YYYY-MM-DD') : '' }))}
                      getPopupContainer={() => document.body}
                    />
                  </div>
                  <div>
                    <label className="form-label">End Date <span style={{color:'var(--text-muted)',fontSize:11}}>(optional)</span></label>
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Select end date"
                      value={form.endDate ? dayjs(form.endDate) : null}
                      onChange={(d) => setForm(f => ({ ...f, endDate: d ? d.format('YYYY-MM-DD') : '' }))}
                      getPopupContainer={() => document.body}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <AntSelect
                    style={{ width: '100%' }}
                    value={form.type || 'event'}
                    onChange={val => setForm(f => ({...f, type: val}))}
                    options={Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label, color: v.color }))}
                    optionRender={(option) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: option.data.color, flexShrink: 0 }} />
                        <span>{option.data.label}</span>
                      </div>
                    )}
                    labelRender={({ value }) => {
                      const cfg = TYPE_CONFIG[value];
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {cfg && <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />}
                          <span>{cfg?.label || value}</span>
                        </div>
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="form-label">Description <span style={{color:'var(--text-muted)',fontSize:11}}>(optional)</span></label>
                  <textarea className="form-control" rows={2} value={form.description || ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Additional details..." style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                  {createMut.isPending || updateMut.isPending ? 'Saving...' : modal.mode === 'add' ? 'Add Event' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Work Schedule Modal ───────────────────────────────────────────────────────

const SAT_OPTIONS = [
  { value: 'school_default', label: 'Follow school default' },
  { value: 'all_working',    label: 'All Saturdays — Working' },
  { value: 'all_holiday',    label: 'All Saturdays — Holiday' },
  { value: 'alternate',      label: 'Alternate (1st & 3rd working, 2nd & 4th off)' },
  { value: 'one_in_three',   label: '1-in-3 (1st working, 2nd & 3rd off)' },
];

const DAYS_OF_WEEK = [
  { key: 'monday',    label: 'Mon' },
  { key: 'tuesday',   label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday',  label: 'Thu' },
  { key: 'friday',    label: 'Fri' },
  { key: 'saturday',  label: 'Sat' },
  { key: 'sunday',    label: 'Sun' },
];

function WorkScheduleModal({ onClose }) {
  const qc = useQueryClient();

  // Fetch school config
  const { data: schoolData, isLoading: schoolLoading } = useQuery({
    queryKey: ['school'], queryFn: () => api.get('/school'),
  });
  const school = schoolData?.school || {};

  // Fetch all classes
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['classes'], queryFn: () => api.get('/classes'),
  });
  const classes = classData?.classes || [];

  // Local state
  const [workingDays, setWorkingDays] = useState(null);         // school.workingDays
  const [empSatSchedule, setEmpSatSchedule] = useState('');     // for employees specifically
  const [classSchedules, setClassSchedules] = useState({});     // { classId: saturdaySchedule }
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (!schoolLoading && !classLoading && !initialized) {
    setWorkingDays({ ...{ monday:true, tuesday:true, wednesday:true, thursday:true, friday:true, saturday:false, sunday:false }, ...(school.workingDays || {}) });
    setEmpSatSchedule(school.salaryConfig?.empSaturdaySchedule || 'school_default');
    const map = {};
    classes.forEach(c => { map[c._id] = c.saturdaySchedule || 'school_default'; });
    setClassSchedules(map);
    setInitialized(true);
  }

  const toggleDay = (key) => setWorkingDays(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save school working days + employee saturday schedule
      await api.put('/school', {
        workingDays,
        salaryConfig: { ...school.salaryConfig, empSaturdaySchedule: empSatSchedule },
      });

      // 2. Save each class's saturday schedule (only changed ones)
      const classUpdates = classes
        .filter(c => classSchedules[c._id] !== (c.saturdaySchedule || 'school_default'))
        .map(c => api.put(`/classes/${c._id}`, { saturdaySchedule: classSchedules[c._id] }));
      await Promise.all(classUpdates);

      qc.invalidateQueries({ queryKey: ['school'] });
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['working-days'] });
      toast.success('Work schedule saved');
      onClose();
    } catch {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const isLoading = schoolLoading || classLoading || !initialized;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card,#fff)', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Work Schedule</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Configure working days and Saturday schedules for salary & attendance calculation</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 22px', flex: 1 }}>
          {isLoading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div> : (
            <>
              {/* School working days */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>School Working Days</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Days marked as working apply to all employees and classes (unless overridden below).
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS_OF_WEEK.map(d => {
                    const on = workingDays?.[d.key] ?? (d.key !== 'saturday' && d.key !== 'sunday');
                    return (
                      <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                        style={{ padding: '8px 16px', borderRadius: 20, fontWeight: 600, fontSize: 13, cursor: 'pointer', border: '2px solid', transition: 'all 0.15s',
                          borderColor: on ? 'var(--primary)' : 'var(--border)',
                          background:  on ? '#eff6ff' : 'transparent',
                          color:       on ? 'var(--primary)' : 'var(--text-muted)',
                        }}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Employee Saturday schedule */}
              <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary,#f8fafc)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Employee Saturday Schedule</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Used for calculating monthly working days in salary LOP.
                </div>
                <AntSelect
                  style={{ width: '100%' }}
                  value={empSatSchedule}
                  onChange={val => setEmpSatSchedule(val)}
                  options={SAT_OPTIONS}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  {{
                    school_default:  `Follows school default (Saturday is ${workingDays?.saturday ? 'working' : 'holiday'})`,
                    all_working:    'All 4–5 Saturdays each month count as working days',
                    all_holiday:    'All Saturdays are non-working — excluded from LOP divisor',
                    alternate:      '1st & 3rd Saturdays working, 2nd & 4th are off',
                    one_in_three:   '1st Saturday working, next 2 off — repeating cycle',
                  }[empSatSchedule] || ''}
                </div>
              </div>

              {/* Class-wise Saturday schedule */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Class-wise Saturday Schedule</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Set a different Saturday pattern per class for student attendance calculation.
                </div>
                {classes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No classes found</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {classes.map(c => (
                      <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card,#fff)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, minWidth: 100, color: 'var(--primary)' }}>
                          {c.name}{c.section ? ` ${c.section}` : ''}
                        </div>
                        <AntSelect
                          style={{ flex: 1 }}
                          value={classSchedules[c._id] || 'school_default'}
                          onChange={val => setClassSchedules(prev => ({ ...prev, [c._id]: val }))}
                          options={SAT_OPTIONS}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar month grid ───────────────────────────────────────────────────────

function CalendarView({ year, month, daysInMonth, firstWeekday, eventsByDay, selectedDay, dayEvents, today, isLoading, can, onPrev, onNext, onDayClick, onAddClick, onEdit, onDelete }) {
  const isToday = (d) => d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
  const cells = firstWeekday + daysInMonth; // total cells needed
  const rows  = Math.ceil(cells / 7);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 280px' : '1fr', gap: 16, alignItems: 'start' }}>
      {/* Grid */}
      <div style={{ background: 'var(--bg-card,#fff)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={onPrev} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{MONTHS[month - 1]} {year}</span>
          <button onClick={onNext} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, color: d === 'Sun' ? '#ef4444' : 'var(--text-secondary)' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {Array.from({ length: rows * 7 }, (_, i) => {
              const day = i - firstWeekday + 1;
              const valid = day >= 1 && day <= daysInMonth;
              const evs = valid ? (eventsByDay[day] || []) : [];
              const selected = valid && day === selectedDay;
              const isHoliday = evs.some(e => e.type === 'holiday');

              return (
                <div key={i} onClick={() => valid && onDayClick(day)}
                  style={{ minHeight: 72, padding: '6px 8px', borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none', borderBottom: i < (rows - 1) * 7 ? '1px solid var(--border)' : 'none', background: selected ? '#eff6ff' : isHoliday ? '#fef2f2' : 'transparent', cursor: valid ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                  {valid && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? '#fff' : isHoliday ? '#ef4444' : 'var(--text-primary)', background: isToday(day) ? 'var(--primary)' : 'transparent', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {day}
                        </span>
                        {evs.length === 0 && can('calendar', 'add') && (
                          <button onClick={e => { e.stopPropagation(); onAddClick(day); }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0, color: 'var(--text-muted)', padding: 2 }} className="add-day-btn">
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {evs.slice(0, 2).map(ev => (
                          <div key={ev._id} style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: typeBg(ev.type), color: typeColor(ev.type), fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.title}
                          </div>
                        ))}
                        {evs.length > 2 && <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 5 }}>+{evs.length - 2} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div style={{ background: 'var(--bg-card,#fff)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedDay} {MONTHS[month-1]}</span>
            {can('calendar', 'add') && (
              <button onClick={() => onAddClick(selectedDay)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}>
                <Plus size={13} /> Add
              </button>
            )}
          </div>
          {dayEvents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No events on this day</div>
          ) : (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayEvents.map(ev => (
                <EventCard key={ev._id} ev={ev} can={can} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── List (yearly) view ────────────────────────────────────────────────────────

function ListView({ year, setYear, groupedList, can, onEdit, onDelete, onAdd }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setYear(y => y-1)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 700, fontSize: 18, minWidth: 60, textAlign: 'center' }}>{year}</span>
        <button onClick={() => setYear(y => y+1)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
      </div>

      {Object.keys(groupedList).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <CalendarDays size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No events for {year}</div>
          {can('calendar', 'add') && (
            <button className="btn btn-primary" onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Plus size={15} /> Add First Event
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {MONTHS.filter(m => groupedList[m]).map(m => (
            <div key={m}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 13 }}>{m}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>{groupedList[m].length} event{groupedList[m].length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groupedList[m].map(ev => <EventCard key={ev._id} ev={ev} can={can} onEdit={onEdit} onDelete={onDelete} showDate />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared event card ─────────────────────────────────────────────────────────

function EventCard({ ev, can, onEdit, onDelete, showDate = false }) {
  const color = typeColor(ev.type);
  const bg    = typeBg(ev.type);
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: bg, border: `1px solid ${color}22`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 4, minHeight: 36, borderRadius: 4, background: color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{ev.title}</div>
        {showDate && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {fmtDate(ev.date)}{ev.endDate && ev.endDate !== ev.date ? ` – ${fmtDate(ev.endDate)}` : ''}
          </div>
        )}
        {ev.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{ev.description}</div>}
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: color + '20', color, fontWeight: 600 }}>{typeLabel(ev.type)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {can('calendar', 'edit') && (
          <button onClick={e => onEdit(ev, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }} title="Edit"><Edit2 size={14} /></button>
        )}
        {can('calendar', 'delete') && (
          <button onClick={e => onDelete(ev._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, borderRadius: 6 }} title="Delete"><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}
