import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, CalendarDays, List, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

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
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [view,  setView]  = useState('calendar'); // 'calendar' | 'list'
  const [modal, setModal] = useState(null); // null | { mode:'add'|'edit', event?, date? }
  const [form,  setForm]  = useState({});
  const [selectedDay, setSelectedDay] = useState(null);

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
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Manage holidays, events and important dates
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('calendar')} style={{ padding: '7px 14px', border: 'none', background: view === 'calendar' ? 'var(--primary)' : 'transparent', color: view === 'calendar' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <CalendarDays size={15} /> Month
            </button>
            <button onClick={() => setView('list')} style={{ padding: '7px 14px', border: 'none', background: view === 'list' ? 'var(--primary)' : 'transparent', color: view === 'list' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <List size={15} /> List
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => openAdd(today.getDate())} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add Event
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(TYPE_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{v.label}</span>
          </div>
        ))}
      </div>

      {view === 'calendar' ? (
        <CalendarView
          year={year} month={month} daysInMonth={daysInMonth} firstWeekday={firstWeekday}
          eventsByDay={eventsByDay} selectedDay={selectedDay} dayEvents={dayEvents}
          today={today} isLoading={isLoading}
          onPrev={prevMonth} onNext={nextMonth}
          onDayClick={(d) => setSelectedDay(sel => sel === d ? null : d)}
          onAddClick={openAdd} onEdit={openEdit} onDelete={handleDelete}
        />
      ) : (
        <ListView year={year} setYear={setYear} groupedList={groupedList} onEdit={openEdit} onDelete={handleDelete} onAdd={() => openAdd(1)} />
      )}

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
                    <input className="form-control" type="date" value={form.date || ''} onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="form-label">End Date <span style={{color:'var(--text-muted)',fontSize:11}}>(optional)</span></label>
                    <input className="form-control" type="date" value={form.endDate || ''} onChange={e => setForm(f => ({...f, endDate: e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.type || 'event'} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
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

// ── Calendar month grid ───────────────────────────────────────────────────────

function CalendarView({ year, month, daysInMonth, firstWeekday, eventsByDay, selectedDay, dayEvents, today, isLoading, onPrev, onNext, onDayClick, onAddClick, onEdit, onDelete }) {
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
                        {evs.length === 0 && (
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
            <button onClick={() => onAddClick(selectedDay)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}>
              <Plus size={13} /> Add
            </button>
          </div>
          {dayEvents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No events on this day</div>
          ) : (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayEvents.map(ev => (
                <EventCard key={ev._id} ev={ev} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── List (yearly) view ────────────────────────────────────────────────────────

function ListView({ year, setYear, groupedList, onEdit, onDelete, onAdd }) {
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
          <button className="btn btn-primary" onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Plus size={15} /> Add First Event
          </button>
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
                {groupedList[m].map(ev => <EventCard key={ev._id} ev={ev} onEdit={onEdit} onDelete={onDelete} showDate />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared event card ─────────────────────────────────────────────────────────

function EventCard({ ev, onEdit, onDelete, showDate = false }) {
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
        <button onClick={e => onEdit(ev, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }} title="Edit"><Edit2 size={14} /></button>
        <button onClick={e => onDelete(ev._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, borderRadius: 6 }} title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
