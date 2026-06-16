import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Send, Settings, FileText, History,
  Plus, Trash2, Edit, RefreshCw, CheckCircle, XCircle, Clock,
  Users, Save, ChevronDown, ChevronLeft, ChevronRight,
  Calendar, Zap, AlertCircle, Smartphone, MessageCircle, Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../utils/api';
import { PageLoader, StatusBadge, Modal, FormRow, EmptyState, SearchInput } from '../../components/ui';

const TABS = [
  { key: 'compose',   label: 'Compose',   icon: Send },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'logs',      label: 'Logs',      icon: History },
  { key: 'settings',  label: 'Settings',  icon: Settings },
];

const MSG_TYPES = [
  { value: 'general',          label: 'General',          desc: 'General announcements' },
  { value: 'attendance',       label: 'Attendance',       desc: 'Student attendance alerts' },
  { value: 'staff_attendance', label: 'Staff Attendance', desc: 'Staff attendance notifications' },
  { value: 'fee',              label: 'Fee',              desc: 'Fee reminders & payment confirmations' },
  { value: 'exam',             label: 'Exam',             desc: 'Exam schedules & results' },
  { value: 'homework',         label: 'Homework',         desc: 'Homework assignments' },
  { value: 'holiday',          label: 'Holiday',          desc: 'Holiday announcements' },
  { value: 'payroll',          label: 'Payroll',          desc: 'Salary & payroll notifications' },
  { value: 'ptmeeting',        label: 'PT Meeting',       desc: 'Parent-teacher meeting alerts' },
  { value: 'circular',         label: 'Circular',         desc: 'School circulars & notices' },
  { value: 'emergency',        label: 'Emergency',        desc: 'Urgent school alerts' },
  { value: 'transport',        label: 'Transport',        desc: 'Bus & transport updates' },
];

const TARGET_GROUPS = [
  { value: 'everyone',      label: 'Everyone',        desc: 'All students, parents & staff' },
  { value: 'students',      label: 'Students',        desc: 'Active students' },
  { value: 'parents',       label: 'Parents',         desc: 'Registered parents & guardians' },
  { value: 'teachers',      label: 'Teachers',        desc: 'Teaching department staff' },
  { value: 'staff',         label: 'All Staff',       desc: 'All employees including teachers' },
  { value: 'class',         label: 'Class',            desc: 'All sections of a specific class' },
  { value: 'class_section', label: 'Class & Section',  desc: 'A specific class and section' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'pa', label: 'Punjabi' },
];

const NOTIFICATION_LABELS = {
  studentAttendance: 'Student Attendance',
  staffAttendance:   'Staff Attendance',
  examSchedule:      'Exam Schedule',
  examResult:        'Exam Results',
  homework:          'Homework Alerts',
};

// Safe date formatter — returns '—' instead of throwing on invalid dates
const safeFormat = (dateVal, fmt) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt);
};

const statusColor = { sent: '#10b981', failed: '#ef4444', pending: '#f59e0b', delivered: '#1a56e8', undelivered: '#94a3b8' };
const statusIcon  = { sent: CheckCircle, failed: XCircle, pending: Clock, delivered: CheckCircle, undelivered: XCircle };

// Twilio connection modal — opened from the "Connect Twilio" CTA. Pre-fills from
// the current config so it doubles as a "Manage connection" editor.
function ConnectTwilioModal({ config, onClose, onConnected }) {
  const qc = useQueryClient();
  const [smsOn, setSmsOn] = useState(!!config?.smsEnabled);
  const [waOn,  setWaOn]  = useState(!!config?.whatsappEnabled);
  const [creds, setCreds] = useState({
    twilioSid:           config?.twilioSid || '',
    twilioToken:         config?.twilioToken || '',
    messagingServiceSid: config?.messagingServiceSid || '',
    whatsappNumber:      config?.whatsappNumber || '',
  });

  const saveMutation = useMutation({
    mutationFn: (d) => api.put('/sms/settings', d),
    onSuccess: () => { qc.invalidateQueries(['sms-settings']); toast.success('Twilio connected!'); onConnected(); },
    onError:   (err) => toast.error(err?.response?.data?.message || err.message || 'Failed to connect Twilio'),
  });

  const handleConnect = () => {
    if (!smsOn && !waOn) return toast.error('Enable at least one channel (SMS or WhatsApp)');
    if (!creds.twilioSid || !creds.twilioToken) return toast.error('Account SID and Auth Token are required');
    if (smsOn && !creds.messagingServiceSid) return toast.error('Messaging Service SID is required for SMS');
    if (waOn && !creds.whatsappNumber) return toast.error('WhatsApp number is required for WhatsApp');
    // Note: omit `notifications` so the dot-notation $set on the backend preserves
    // any auto-notification messages already configured.
    saveMutation.mutate({ smsEnabled: smsOn, whatsappEnabled: waOn, ...creds });
  };

  const channelCard = (icon, label, desc, color, bg, on, setOn) => (
    <div onClick={() => setOn(v => !v)}
      style={{ flex: 1, padding: '16px 16px', borderRadius: 12, border: `2px solid ${on ? color : 'var(--border)'}`,
        background: on ? bg : 'white', cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: on ? color : '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
          {icon}
        </div>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? color : 'var(--border)'}`,
          background: on ? color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
          {on && <CheckCircle size={13} color="white" />}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: on ? color : 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );

  return (
    <Modal open onClose={onClose} size="md"
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={16} color="var(--primary)" /> Connect Twilio</span>}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={saveMutation.isLoading}>
            {saveMutation.isLoading ? 'Connecting…' : 'Connect & Enable'}
          </button>
        </>
      }>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Choose the channels you want to send through, then enter your Twilio credentials. Once connected you can start sending messages.
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>Channels</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {channelCard(<Smartphone size={19} color={smsOn ? 'white' : 'var(--text-muted)'} />, 'SMS', 'Send text messages via Twilio to any phone number.', 'var(--primary)', '#eff6ff', smsOn, setSmsOn)}
        {channelCard(<MessageCircle size={19} color={waOn ? 'white' : 'var(--text-muted)'} />, 'WhatsApp', 'Send rich messages via WhatsApp Business API.', '#25d366', '#f0fdf4', waOn, setWaOn)}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Twilio Credentials</div>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Account SID <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" type="password" placeholder="ACxxxxxxxxxxxxxxxx" value={creds.twilioSid} onChange={e => setCreds(p => ({ ...p, twilioSid: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Auth Token <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" type="password" placeholder="Your auth token" value={creds.twilioToken} onChange={e => setCreds(p => ({ ...p, twilioToken: e.target.value }))} />
        </div>
      </FormRow>
      {smsOn && (
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Smartphone size={13} color="var(--primary)" /> Messaging Service SID <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input className="form-control" placeholder="MGxxxxxxxxxxxxxxxx" value={creds.messagingServiceSid} onChange={e => setCreds(p => ({ ...p, messagingServiceSid: e.target.value }))} />
        </div>
      )}
      {waOn && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageCircle size={13} color="#25d366" /> WhatsApp Number <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input className="form-control" placeholder="+14155238886" value={creds.whatsappNumber} onChange={e => setCreds(p => ({ ...p, whatsappNumber: e.target.value }))} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Twilio sandbox: +14155238886</div>
        </div>
      )}
    </Modal>
  );
}

export default function SMS() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState('compose');
  const [connectOpen, setConnectOpen] = useState(false);

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['sms-settings'],
    queryFn: () => api.get('/sms/settings'),
  });

  const cfg        = settingsData?.smsConfig || {};
  const smsEnabled = !!cfg.smsEnabled;
  const waEnabled  = !!cfg.whatsappEnabled;
  const connected  = smsEnabled || waEnabled;

  if (settingsLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">SMS Services</h1>
          <p className="page-subtitle">Manage notifications, templates, and bulk messaging</p>
        </div>
        {/* Connection status / CTA */}
        {connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#10b981', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '5px 11px', borderRadius: 20 }}>
              <CheckCircle size={13} /> Twilio Connected
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setConnectOpen(true)}>
              <Settings size={13} /> Manage
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setConnectOpen(true)}>
            <MessageSquare size={15} /> Connect Twilio
          </button>
        )}
      </div>

      {/* Not-connected banner */}
      {!connected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', marginBottom: 20, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} color="var(--primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Connect Twilio to start sending</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>You can compose messages and build templates now — connect your Twilio account to actually send them.</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => setConnectOpen(true)}>
            <MessageSquare size={13} /> Connect Twilio
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'white', padding: 6, borderRadius: 12, border: '1px solid var(--border)', width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'compose'   && <ComposeTab smsEnabled={smsEnabled} waEnabled={waEnabled} connected={connected} onConnect={() => setConnectOpen(true)} />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'logs'      && <LogsTab />}
      {tab === 'settings'  && <SettingsTab />}

      {connectOpen && (
        <ConnectTwilioModal
          config={cfg}
          onClose={() => setConnectOpen(false)}
          onConnected={() => { setConnectOpen(false); qc.invalidateQueries(['sms-settings']); }}
        />
      )}
    </div>
  );
}


// ── Floating Date Picker ──────────────────────────────────────────────────────
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT  = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function FloatingDatePicker({ value, onChange, onClose }) {
  const pickerRef = useRef(null);
  useEffect(() => {
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const today = new Date(); today.setHours(0,0,0,0);
  const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // Default: tomorrow at 9:00 AM
  const defaultDate = () => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return localIso(d);
  };

  const parse = (v) => {
    if (!v) return { date: defaultDate(), hour: 9, min: 0, ap: 'AM' };
    const [dp, tp] = v.split('T');
    const [h, m] = (tp || '09:00').split(':').map(Number);
    return { date: dp, hour: h % 12 || 12, min: Math.round(m / 5) * 5 % 60, ap: h >= 12 ? 'PM' : 'AM' };
  };

  const init = parse(value);
  const [vy,      setVy]      = useState(() => new Date((value || (defaultDate() + 'T00:00'))).getFullYear());
  const [vm,      setVm]      = useState(() => new Date((value || (defaultDate() + 'T00:00'))).getMonth());
  const [selDate, setSelDate] = useState(init.date);
  const [selHour, setSelHour] = useState(init.hour);
  const [selMin,  setSelMin]  = useState(init.min);
  const [selAp,   setSelAp]   = useState(init.ap);

  // Emit immediately on first render so parent has a value
  useEffect(() => {
    if (!value) emitChange(init.date, init.hour, init.min, init.ap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = (date, hour, min, ap) => {
    if (!date) return;
    let hr = hour;
    if (ap === 'PM' && hr !== 12) hr += 12;
    if (ap === 'AM' && hr === 12) hr = 0;
    onChange(`${date}T${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };

  const prevMonth = () => { if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1); };
  const nextMonth = () => { if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1); };

  // Build calendar grid
  const firstDay    = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const daysInPrev  = new Date(vy, vm, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ d: daysInPrev - i, t: 'prev' });
  for (let d = 1; d <= daysInMonth; d++)   cells.push({ d, t: 'cur' });
  let nd = 1;
  while (cells.length % 7 !== 0) cells.push({ d: nd++, t: 'next' });

  const cellIso = ({ d, t }) => {
    if (t === 'prev') { const m2 = vm === 0 ? 11 : vm - 1; const y2 = vm === 0 ? vy - 1 : vy; return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    if (t === 'next') { const m2 = vm === 11 ? 0 : vm + 1; const y2 = vm === 11 ? vy + 1 : vy; return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    return `${vy}-${String(vm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const selectCell = (cell) => {
    const iso = cellIso(cell);
    if (new Date(iso + 'T00:00') < today) return;
    setSelDate(iso);
    if (cell.t === 'prev') prevMonth();
    if (cell.t === 'next') nextMonth();
    emitChange(iso, selHour, selMin, selAp);
  };

  const handleHour = (h)  => { setSelHour(h);  emitChange(selDate, h,       selMin, selAp); };
  const handleMin  = (m)  => { setSelMin(m);   emitChange(selDate, selHour, m,      selAp); };
  const handleAp   = (ap) => { setSelAp(ap);   emitChange(selDate, selHour, selMin, ap);    };

  const goToday = () => {
    const iso = localIso(today);
    setVy(today.getFullYear()); setVm(today.getMonth());
    setSelDate(iso);
    emitChange(iso, selHour, selMin, selAp);
  };

  // Formatted summary shown in the footer
  const summary = (() => {
    const src = value || (selDate ? `${selDate}T${String((() => { let hr = selHour; if (selAp === 'PM' && hr !== 12) hr += 12; if (selAp === 'AM' && hr === 12) hr = 0; return hr; })()).padStart(2,'0')}:${String(selMin).padStart(2,'0')}` : '');
    if (!src) return null;
    const [dp, tp] = src.split('T');
    const d = new Date(dp + 'T00:00');
    const ds = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const [h, m] = tp.split(':').map(Number);
    return `${ds}  ·  ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  })();

  const selStyle = { padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', outline: 'none', color: 'var(--text-primary)', textAlign: 'center', letterSpacing: '-0.02em', fontFamily: 'inherit' };
  const hours   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Quick-pick shortcuts
  const quickPicks = [
    { label: 'Today',     getDate: () => localIso(today) },
    { label: 'Tomorrow',  getDate: () => { const d = new Date(today); d.setDate(d.getDate()+1); return localIso(d); } },
    { label: 'In 3 days', getDate: () => { const d = new Date(today); d.setDate(d.getDate()+3); return localIso(d); } },
    { label: 'Next week', getDate: () => { const d = new Date(today); d.setDate(d.getDate()+7); return localIso(d); } },
  ];

  const applyQuick = (getDate) => {
    const iso = getDate();
    setSelDate(iso);
    setVy(new Date(iso+'T00:00').getFullYear());
    setVm(new Date(iso+'T00:00').getMonth());
    emitChange(iso, selHour, selMin, selAp);
  };

  const navBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1 };

  return (
    <div ref={pickerRef} style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 500, width: 300, borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: 'white', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>

      {/* Month / Year nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <button type="button" style={navBtn} onClick={prevMonth}
          onMouseEnter={e => e.currentTarget.style.background='var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {MONTHS_LONG[vm]} {vy}
        </span>
        <button type="button" style={navBtn} onClick={nextMonth}
          onMouseEnter={e => e.currentTarget.style.background='var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>›</button>
      </div>

      {/* Calendar grid */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 3 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '-0.02em', padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 5 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 2 }}>
          {cells.map((cell, i) => {
            const iso = cellIso(cell); const past = new Date(iso + 'T00:00') < today;
            const isToday = new Date(iso + 'T00:00').toDateString() === today.toDateString();
            const isSel = iso === selDate; const isOther = cell.t !== 'cur';
            return (
              <button key={`${cell.t}-${cell.d}-${i}`} type="button" onClick={() => !past && selectCell(cell)}
                style={{ padding: '6px 2px', border: 'none', borderRadius: 'var(--radius-sm)', textAlign: 'center', outline: 'none', fontSize: 13, letterSpacing: '-0.02em', cursor: past ? 'default' : 'pointer', fontWeight: isSel || isToday ? 600 : 400, background: isSel ? 'var(--primary)' : isToday && !isSel ? '#eff6ff' : 'transparent', color: isSel ? 'white' : past ? '#e2e8f0' : isOther ? '#cbd5e1' : isToday ? 'var(--primary)' : 'var(--text-secondary)', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!past && !isSel) e.currentTarget.style.background = isToday ? '#dbeafe' : 'var(--bg)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isToday && !isSel ? '#eff6ff' : 'transparent'; }}>
                {cell.d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick picks */}
      <div style={{ padding: '6px 10px 8px', borderTop: '1px solid var(--border)', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {quickPicks.map(qp => {
          const active = selDate === qp.getDate();
          return (
            <button key={qp.label} type="button" onClick={() => applyQuick(qp.getDate)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`, background: active ? 'var(--primary)' : 'white', color: active ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              {qp.label}
            </button>
          );
        })}
      </div>

      {/* Time + Done */}
      <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Clock size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <select value={selHour} onChange={e => handleHour(Number(e.target.value))} style={{ ...selStyle, width: 50 }}>
          {hours.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>:</span>
        <select value={selMin} onChange={e => handleMin(Number(e.target.value))} style={{ ...selStyle, width: 54 }}>
          {minutes.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <select value={selAp} onChange={e => handleAp(e.target.value)} style={{ ...selStyle, width: 62 }}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <button type="button" onClick={onClose}
          style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── Searchable Picklist ───────────────────────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder = 'Select...' }) {
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState('');
  const [highlightIdx, setHighlight] = useState(-1);
  const ref      = useRef(null);
  const listRef  = useRef(null);
  const itemsRef = useRef([]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); setHighlight(-1); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const selected = options.find(o => o.value === value);

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlight(-1); }, [search]);

  // Seed highlight to currently-selected item when dropdown opens
  useEffect(() => {
    if (open) {
      const idx = filtered.findIndex(o => o.value === value);
      setHighlight(idx >= 0 ? idx : -1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && itemsRef.current[highlightIdx]) {
      itemsRef.current[highlightIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const select = (o) => { onChange(o.value); setOpen(false); setSearch(''); setHighlight(-1); };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) select(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false); setSearch(''); setHighlight(-1);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} className="form-control"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ color: selected ? 'inherit' : 'var(--text-muted)' }}>{selected?.label || placeholder}</span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input autoFocus className="form-control" style={{ padding: '6px 10px', fontSize: 13 }}
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Search..." autoComplete="off" />
          </div>
          <div ref={listRef} style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>No results</div>}
            {filtered.map((o, i) => {
              const isActive   = value === o.value;
              const isHighlight = highlightIdx === i;
              return (
                <div key={o.value}
                  ref={el => itemsRef.current[i] = el}
                  onClick={() => select(o)}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseLeave={() => setHighlight(-1)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                    background: isHighlight ? '#eff6ff' : isActive ? '#eff6ff' : 'white',
                    transition: 'background 0.1s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: isActive || isHighlight ? 600 : 400, color: isActive || isHighlight ? 'var(--primary)' : 'inherit' }}>{o.label}</div>
                  {o.desc && <div style={{ fontSize: 11, color: isHighlight ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.85, marginTop: 2 }}>{o.desc}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonMultiSelect({ queryKey, endpoint, responseKey, value = [], onChange, placeholder = 'Search...' }) {
  const [search, setSearch]           = useState('');
  const [highlightIdx, setHighlight]  = useState(-1);
  const listRef   = useRef(null);
  const itemsRef  = useRef([]);

  const sep = endpoint.includes('?') ? '&' : '?';
  const { data } = useQuery({
    queryKey: [queryKey, search],
    queryFn: () => api.get(`${endpoint}${sep}search=${encodeURIComponent(search)}&limit=30`),
    enabled: search.length > 0,
  });
  const people = (data?.[responseKey] || []).filter(p => !value.find(v => v.id === p._id));

  // Reset highlight whenever the list changes
  useEffect(() => { setHighlight(-1); }, [search, people.length]);

  // Keep highlighted row scrolled into view
  useEffect(() => {
    if (highlightIdx >= 0 && itemsRef.current[highlightIdx]) {
      itemsRef.current[highlightIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const remove = (id) => onChange(value.filter(v => v.id !== id));
  const add = (p) => {
    if (!value.find(v => v.id === p._id)) onChange([...value, { id: p._id, name: p.name }]);
    setSearch('');
    setHighlight(-1);
  };

  const open = search.length > 0 && people.length > 0;

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(i => Math.min(i + 1, people.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < people.length) add(people[highlightIdx]);
    } else if (e.key === 'Escape') {
      setSearch('');
      setHighlight(-1);
    }
  };

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map(p => (
            <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: 'var(--primary)', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 500, border: '1px solid #bfdbfe' }}>
              {p.name}
              <button type="button" onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          className="form-control"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {open && (
          <div ref={listRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto' }}>
            {people.map((p, i) => (
              <div
                key={p._id}
                ref={el => itemsRef.current[i] = el}
                onClick={() => add(p)}
                onMouseEnter={() => setHighlight(i)}
                onMouseLeave={() => setHighlight(-1)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  borderBottom: '1px solid #f8fafc',
                  background: highlightIdx === i ? '#eff6ff' : 'white',
                  color: highlightIdx === i ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: highlightIdx === i ? 500 : 400,
                  transition: 'background 0.1s',
                }}>
                {p.name} {p.phone && <span style={{ fontSize: 11, color: highlightIdx === i ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.8 }}>{p.phone}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live Phone Preview ────────────────────────────────────────────────────────
// A small phone mockup showing how the composed message lands on a recipient's
// device — styled per channel (SMS bubble vs. WhatsApp bubble).
function PhonePreview({ channel, message, schoolName }) {
  const isWa   = channel === 'whatsapp';
  const isBoth = channel === 'both';
  const time   = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const empty  = !message.trim();
  const body   = empty ? 'Your message preview will appear here as you type…' : message;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        {isBoth ? 'SMS + WhatsApp Preview' : isWa ? 'WhatsApp Preview' : 'SMS Preview'}
      </div>

      {/* Phone frame */}
      <div style={{ width: 268, border: '9px solid #1e293b', borderRadius: 38, overflow: 'hidden', boxShadow: 'var(--shadow-md)', background: '#1e293b' }}>
        {/* Notch */}
        <div style={{ height: 20, background: '#1e293b', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 74, height: 5, borderRadius: 6, background: '#0f172a' }} />
        </div>

        {/* Screen */}
        <div style={{ height: 408, background: isWa ? '#e5ddd5' : '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
          {/* App header */}
          <div style={{ background: isWa ? '#075e54' : '#f8fafc', borderBottom: isWa ? 'none' : '1px solid #e2e8f0', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChevronLeft size={16} color={isWa ? 'white' : 'var(--primary)'} style={{ flexShrink: 0 }} />
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: isWa ? 'rgba(255,255,255,0.22)' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isWa ? <MessageCircle size={15} color="white" /> : <Smartphone size={14} color="var(--text-muted)" />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: isWa ? 'white' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{schoolName}</div>
              <div style={{ fontSize: 10, color: isWa ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{isWa ? 'online' : 'Text Message'}</div>
            </div>
          </div>

          {/* Conversation */}
          <div style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, background: isWa ? 'rgba(255,255,255,0.75)' : '#e2e8f0', color: 'var(--text-muted)', padding: '2px 10px', borderRadius: 10 }}>Today</span>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ maxWidth: '88%', background: isWa ? 'white' : '#e9e9eb', color: empty ? 'var(--text-muted)' : '#0f172a', padding: '8px 11px', borderRadius: isWa ? '0 9px 9px 9px' : 14, fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: isWa ? '0 1px 0.5px rgba(0,0,0,0.13)' : 'none', fontStyle: empty ? 'italic' : 'normal' }}>
                {body}
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3 }}>{time}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
        How recipients will see your message
      </div>
    </div>
  );
}

// ── Compose ───────────────────────────────────────────────────────────────────
const GROUPS_WITH_SUBTYPE = ['students', 'parents', 'teachers', 'staff'];

const PERSON_MULTISELECT_CONFIG = {
  students: { queryKey: 'search-students', endpoint: '/students',                           responseKey: 'students',  placeholder: 'Search student name...' },
  parents:  { queryKey: 'search-parents',  endpoint: '/parents',                            responseKey: 'parents',   placeholder: 'Search parent name...' },
  teachers: { queryKey: 'search-teachers', endpoint: '/employees?department=Teaching',      responseKey: 'employees', placeholder: 'Search teacher name...' },
  staff:    { queryKey: 'search-staff',    endpoint: '/employees',                          responseKey: 'employees', placeholder: 'Search staff name...' },
};

function ComposeTab({ smsEnabled = true, waEnabled = false, connected = true, onConnect }) {
  const [targetGroup, setTargetGroup]     = useState('students');
  const [targetSubtype, setTargetSubtype] = useState('all');   // 'all' | 'selected'
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [classFilter, setClassFilter]     = useState({});      // { className } or { classId }
  const [message, setMessage]             = useState('');
  const [type, setType]                   = useState('general');
  const [scheduleMode, setScheduleMode]   = useState(false);
  const [scheduledAt, setScheduledAt]     = useState('');
  const [pickerOpen,  setPickerOpen]      = useState(false);
  const [templateId, setTemplateId]       = useState('');
  const [channel, setChannel]             = useState(() => (!smsEnabled && waEnabled) ? 'whatsapp' : 'sms');
  const [sending, setSending]             = useState(false);

  // If the active channel gets disabled in settings, fall back to an available one
  useEffect(() => {
    if (channel === 'sms'      && !smsEnabled) setChannel(waEnabled  ? 'whatsapp' : 'sms');
    if (channel === 'whatsapp' && !waEnabled)  setChannel(smsEnabled ? 'sms'      : 'whatsapp');
    if (channel === 'both'     && (!smsEnabled || !waEnabled)) setChannel(smsEnabled ? 'sms' : 'whatsapp');
  }, [smsEnabled, waEnabled]); // eslint-disable-line

  const { data: classesData }   = useQuery({ queryKey: ['classes'],       queryFn: () => api.get('/classes') });
  const { data: templatesData } = useQuery({ queryKey: ['sms-templates'], queryFn: () => api.get('/sms/templates') });
  const { data: schoolData }    = useQuery({ queryKey: ['school'],        queryFn: () => api.get('/school') });
  const classes    = classesData?.classes || [];
  const templates  = templatesData?.templates || [];
  const schoolName = schoolData?.school?.name || 'Your School';

  // Character limits per Twilio
  const MAX_SMS_CHARS = 1600;
  const MAX_WA_CHARS  = 4096;
  const maxChars   = channel === 'whatsapp' ? MAX_WA_CHARS : MAX_SMS_CHARS;
  const charCount  = message.length;
  const isOverLimit = charCount > maxChars;
  const smsSegments = channel !== 'whatsapp' ? (charCount === 0 ? 1 : Math.ceil(charCount / 160)) : null;
  const charPct    = charCount / maxChars;
  const counterColor = isOverLimit ? '#ef4444' : charPct > 0.85 ? '#f59e0b' : 'var(--text-muted)';

  const getApiTarget = () => {
    if (targetGroup === 'everyone')      return { targetType: 'all',           targetFilter: {} };
    if (targetGroup === 'class')         return { targetType: 'class',         targetFilter: classFilter };
    if (targetGroup === 'class_section') return { targetType: 'class_section', targetFilter: classFilter };
    if (targetSubtype === 'all')         return { targetType: `all_${targetGroup}`, targetFilter: {} };
    const filterKey = targetGroup === 'students' ? 'studentIds' : targetGroup === 'parents' ? 'parentIds' : 'employeeIds';
    return { targetType: `specific_${targetGroup}`, targetFilter: { [filterKey]: selectedPeople.map(p => p.id) } };
  };

  const handleGroupChange = (g) => { setTargetGroup(g); setTargetSubtype('all'); setSelectedPeople([]); setClassFilter({}); };

  const applyTemplate = (tpl) => {
    const content = typeof tpl.content === 'string' ? tpl.content : (tpl.content?.en || '');
    setMessage(content);
    setType(tpl.type || 'general');
    setTemplateId(tpl._id);
  };

  const handleSend = async () => {
    if (!connected) { onConnect?.(); return toast.error('Connect Twilio to send messages'); }
    if (!message.trim()) return toast.error('Message cannot be empty');
    if (isOverLimit) return toast.error(`Message exceeds ${maxChars.toLocaleString()} character limit`);
    // Validate target selection completeness
    if (targetGroup === 'class' && !classFilter.className) return toast.error('Please select a class');
    if (targetGroup === 'class_section' && !classFilter.classId) return toast.error('Please select a class and section');
    if (GROUPS_WITH_SUBTYPE.includes(targetGroup) && targetSubtype === 'selected' && selectedPeople.length === 0) {
      return toast.error('Please select at least one recipient');
    }
    setSending(true);
    try {
      const { targetType, targetFilter } = getApiTarget();
      const schedVal = (scheduleMode && scheduledAt) ? scheduledAt : undefined;
      const payload = { message, type, channel, targetType, targetFilter, scheduledAt: schedVal };
      const res = await api.post('/sms/send', payload);
      toast.success(res.message || (schedVal ? 'Scheduled!' : 'Sending...'));
      setMessage(''); setScheduleMode(false); setScheduledAt(''); setPickerOpen(false); setSelectedPeople([]); setClassFilter({});
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const msConfig = PERSON_MULTISELECT_CONFIG[targetGroup];

  // ── Live recipients (senders) list ──────────────────────────────────────────
  // Is the current audience selection complete enough to resolve recipients?
  const targetReady = (() => {
    if (targetGroup === 'class')         return !!classFilter.className;
    if (targetGroup === 'class_section') return !!classFilter.classId;
    if (GROUPS_WITH_SUBTYPE.includes(targetGroup) && targetSubtype === 'selected') return selectedPeople.length > 0;
    return true; // everyone, or all_<group>
  })();

  const apiTarget = getApiTarget();
  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: ['sms-recipients', apiTarget.targetType, JSON.stringify(apiTarget.targetFilter)],
    queryFn: () => api.post('/sms/recipients/preview', apiTarget),
    enabled: targetReady,
    keepPreviousData: true,
  });
  const recipients      = previewData?.recipients || [];
  const totalRecipients = previewData?.total || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
      <div>
        {/* Target audience + Channel */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start' }}>

            {/* Target audience */}
            <div>
              <h3 className="text-14-semibold" style={{ marginBottom: 12 }}>Target Audience</h3>
              <SearchableSelect options={TARGET_GROUPS} value={targetGroup} onChange={handleGroupChange} placeholder="Select audience..." />

              {/* All / Only Selected radios */}
              {GROUPS_WITH_SUBTYPE.includes(targetGroup) && (
                <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                  {[
                    { value: 'all',      label: `All ${TARGET_GROUPS.find(g => g.value === targetGroup)?.label}` },
                    { value: 'selected', label: 'Only Selected' },
                  ].map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: targetSubtype === opt.value ? 600 : 400, color: targetSubtype === opt.value ? 'var(--primary)' : 'var(--text-secondary)' }}>
                      <input type="radio" name="targetSubtype" value={opt.value} checked={targetSubtype === opt.value}
                        onChange={() => { setTargetSubtype(opt.value); setSelectedPeople([]); }}
                        style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              {/* Person multi-select for specific selection */}
              {GROUPS_WITH_SUBTYPE.includes(targetGroup) && targetSubtype === 'selected' && msConfig && (
                <div style={{ marginTop: 10 }}>
                  <PersonMultiSelect
                    queryKey={msConfig.queryKey} endpoint={msConfig.endpoint}
                    responseKey={msConfig.responseKey} placeholder={msConfig.placeholder}
                    value={selectedPeople} onChange={setSelectedPeople}
                  />
                  {selectedPeople.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {selectedPeople.length} {TARGET_GROUPS.find(g => g.value === targetGroup)?.label.toLowerCase()} selected
                    </div>
                  )}
                </div>
              )}

              {/* Class name picker */}
              {targetGroup === 'class' && (
                <div style={{ marginTop: 12 }}>
                  <SearchableSelect
                    options={[...new Set(classes.map(c => c.name))].sort().map(name => ({ value: name, label: name }))}
                    value={classFilter.className || ''}
                    onChange={name => setClassFilter({ className: name })}
                    placeholder="Select class..."
                  />
                  {classFilter.className && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      Includes all sections of {classFilter.className}
                    </div>
                  )}
                </div>
              )}

              {/* Class & Section picker */}
              {targetGroup === 'class_section' && (
                <div style={{ marginTop: 12 }}>
                  <SearchableSelect
                    options={classes.map(c => ({ value: c._id, label: `${c.name} — Section ${c.section}` }))}
                    value={classFilter.classId || ''}
                    onChange={id => setClassFilter({ classId: id })}
                    placeholder="Select class & section..."
                  />
                </div>
              )}
            </div>

            {/* Channel */}
            <div style={{ minWidth: 152 }}>
              <h3 className="text-14-semibold" style={{ marginBottom: 12 }}>Channel</h3>
              {connected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { value: 'sms',      label: 'SMS',      icon: Smartphone,    color: 'var(--primary)', bg: '#eff6ff', show: smsEnabled },
                    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25d366',        bg: '#f0fdf4', show: waEnabled  },
                    { value: 'both',     label: 'Both',     icon: Send,          color: '#f59e0b',        bg: '#fffbeb', show: smsEnabled && waEnabled },
                  ].filter(c => c.show).map(c => {
                    const Icon = c.icon;
                    const active = channel === c.value;
                    return (
                      <button key={c.value} type="button" onClick={() => setChannel(c.value)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${active ? c.color : 'var(--border)'}`, background: active ? c.bg : 'white', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? c.color : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <Icon size={14} /> {c.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '12px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: '#f8fafc', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  No channel connected.
                  <button type="button" onClick={onConnect} style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    Connect Twilio →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recipients (senders) list */}
        <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} color="var(--primary)" />
              <span className="text-14-semibold">Recipients</span>
            </div>
            {targetReady && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: '#eff6ff', padding: '3px 11px', borderRadius: 20, fontVariantNumeric: 'tabular-nums' }}>
                {previewLoading && recipients.length === 0 ? '…' : `${totalRecipients.toLocaleString()} ${totalRecipients === 1 ? 'number' : 'numbers'}`}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 224, overflowY: 'auto' }}>
            {!targetReady ? (
              <div style={{ padding: '20px 18px', fontSize: 12.5, color: 'var(--text-muted)' }}>Select an audience above to see who will receive this message.</div>
            ) : previewLoading && recipients.length === 0 ? (
              <div style={{ padding: '20px 18px', fontSize: 12.5, color: 'var(--text-muted)' }}>Loading recipients…</div>
            ) : totalRecipients === 0 ? (
              <div style={{ padding: '20px 18px', fontSize: 12.5, color: 'var(--text-muted)' }}>No recipients with a mobile number match this selection.</div>
            ) : (
              <>
                {recipients.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {(r.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.phone}</div>
                  </div>
                ))}
                {totalRecipients > recipients.length && (
                  <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    + {(totalRecipients - recipients.length).toLocaleString()} more recipient{totalRecipients - recipients.length === 1 ? '' : 's'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="text-14-semibold">Message</h3>
            <div style={{ minWidth: 200 }}>
              <SearchableSelect options={MSG_TYPES} value={type} onChange={setType} placeholder="Select type..." />
            </div>
          </div>
          <textarea className="form-control" rows={5} value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here..."
            style={{ resize: 'vertical', borderColor: isOverLimit ? '#ef4444' : undefined }} />
          {isOverLimit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
              <AlertCircle size={13} /> Message exceeds the {maxChars.toLocaleString()}-character limit for {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: isOverLimit ? 4 : 8, fontSize: 12, color: counterColor, fontWeight: charPct > 0.75 ? 600 : 400 }}>
            <span>{charCount.toLocaleString()} / {maxChars.toLocaleString()} characters</span>
            {smsSegments && (
              <span title="Messages over 160 chars are split into multiple SMS and billed per segment">
                {smsSegments > 1 ? `Split into ${smsSegments} SMS segments · billed as ${smsSegments}×` : '1 SMS segment'}
              </span>
            )}
          </div>
        </div>

        {/* When to Send */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>When to Send</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Send Now */}
            <button type="button" onClick={() => { setScheduleMode(false); setScheduledAt(''); setPickerOpen(false); }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${!scheduleMode ? 'var(--primary)' : 'var(--border)'}`, background: !scheduleMode ? '#eff6ff' : 'white', color: !scheduleMode ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: !scheduleMode ? 600 : 400, letterSpacing: '-0.02em', transition: 'var(--transition)' }}>
              <Zap size={14} /> Send Now
            </button>

            {/* Schedule for Later — calendar floats above this button */}
            <div style={{ flex: 1, position: 'relative' }}>
              <button type="button" onClick={() => { setScheduleMode(true); setPickerOpen(true); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, letterSpacing: '-0.02em', transition: 'var(--transition)', fontWeight: scheduleMode ? 600 : 400,
                  border:      scheduleMode && scheduledAt ? '1.5px solid #f59e0b' : scheduleMode ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  background:  scheduleMode && scheduledAt ? '#fffbeb' : scheduleMode ? '#eff6ff' : 'white',
                  color:       scheduleMode && scheduledAt ? '#d97706' : scheduleMode ? 'var(--primary)' : 'var(--text-secondary)',
                }}>
                <Calendar size={14} />
                {scheduleMode && scheduledAt ? (() => {
                  const [dp, tp] = scheduledAt.split('T');
                  const ds = new Date(dp + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const [h, m] = tp.split(':').map(Number);
                  return `${ds} · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                })() : 'Schedule for Later'}
              </button>

              {pickerOpen && (
                <FloatingDatePicker
                  value={scheduledAt}
                  onChange={v => setScheduledAt(v)}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        {connected ? (
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
            onClick={handleSend} disabled={sending || isOverLimit}>
            <Send size={16} /> {sending ? 'Sending...' : (scheduleMode && scheduledAt) ? 'Schedule Send' : 'Send Now'}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
            onClick={onConnect}>
            <MessageSquare size={16} /> Connect Twilio to Send
          </button>
        )}
      </div>

      {/* Right rail — live phone preview + quick templates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20, alignSelf: 'start' }}>
        {/* Live phone preview */}
        <div className="card" style={{ padding: 18 }}>
          <PhonePreview channel={channel} message={message} schoolName={schoolName} />
        </div>

        {/* Quick templates */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', maxHeight: 360 }}>
          <h3 className="text-14-semibold" style={{ marginBottom: 12, flexShrink: 0 }}>Quick Templates</h3>
          {templates.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No templates yet. Create one in the Templates tab.</p>}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {templates.map(tpl => (
              <div key={tpl._id} onClick={() => applyTemplate(tpl)}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${templateId === tpl._id ? 'var(--primary)' : 'var(--border)'}`, marginBottom: 8, cursor: 'pointer', background: templateId === tpl._id ? '#eff6ff' : 'white', transition: 'border-color 0.15s' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: templateId === tpl._id ? 'var(--primary)' : 'inherit' }}>{tpl.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof tpl.content === 'string' ? tpl.content : (tpl.content?.en || '')}
                </div>
                <span style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 10, marginTop: 6, display: 'inline-block', textTransform: 'capitalize' }}>{tpl.type?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Templates ─────────────────────────────────────────────────────────────────
function TemplatesTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTpl, setEditTpl] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['sms-templates'], queryFn: () => api.get('/sms/templates') });
  const templates = data?.templates || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/sms/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries(['sms-templates']); toast.success('Template deleted'); }
  });

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => { setEditTpl(null); setShowModal(true); }}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {templates.length === 0 && <EmptyState icon={FileText} message="No templates yet." action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Create Template</button>} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {templates.map(tpl => (
          <div key={tpl._id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div className="text-14-semibold">{tpl.name}</div>
                <span style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{tpl.type?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setEditTpl(tpl); setShowModal(true); }}><Edit size={13} /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteMutation.mutate(tpl._id)}><Trash2 size={13} /></button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
              {typeof tpl.content === 'string' ? tpl.content : (tpl.content?.en || '')}
            </p>
            {tpl.dltTemplateId && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>DLT: {tpl.dltTemplateId}</div>
            )}
          </div>
        ))}
      </div>

      {showModal && <TemplateModal tpl={editTpl} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function TemplateModal({ tpl, onClose }) {
  const qc = useQueryClient();
  // Support both old { en: '...' } format and new plain-string format
  const existingContent = typeof tpl?.content === 'string' ? tpl.content : (tpl?.content?.en || '');
  const [form, setForm] = useState({
    name: tpl?.name || '',
    type: tpl?.type || 'general',
    dltTemplateId: tpl?.dltTemplateId || '',
    variables: (tpl?.variables || []).join(', '),
    content: existingContent,
  });

  const mutation = useMutation({
    mutationFn: (data) => tpl ? api.put(`/sms/templates/${tpl._id}`, data) : api.post('/sms/templates', data),
    onSuccess: () => { qc.invalidateQueries(['sms-templates']); toast.success(tpl ? 'Template updated' : 'Template created'); onClose(); }
  });

  const save = () => {
    if (!form.name) return toast.error('Template name is required');
    if (!form.content) return toast.error('Message content is required');
    mutation.mutate({ ...form, variables: form.variables.split(',').map(v => v.trim()).filter(Boolean) });
  };

  const charCount = form.content.length;

  return (
    <Modal open onClose={onClose} title={tpl ? 'Edit Template' : 'New Template'} size="lg"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={mutation.isLoading}>{mutation.isLoading ? 'Saving...' : 'Save Template'}</button></>}>
      <FormRow>
        <div className="form-group">
          <label className="form-label">Template Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Fee Reminder" />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <SearchableSelect options={MSG_TYPES} value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group">
          <label className="form-label">DLT Template ID <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input className="form-control" value={form.dltTemplateId} onChange={e => setForm(f => ({ ...f, dltTemplateId: e.target.value }))} placeholder="TRAI DLT Template ID" />
        </div>
        <div className="form-group">
          <label className="form-label">Variables <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(comma separated)</span></label>
          <input className="form-control" value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))} placeholder="student_name, amount, due_date" />
        </div>
      </FormRow>

      <div className="form-group" style={{ marginTop: 4 }}>
        <label className="form-label">Message Content <span style={{ color: '#ef4444' }}>*</span></label>
        <textarea className="form-control" rows={5} value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder="Type your message here. Use {variable_name} for dynamic values..."
          style={{ resize: 'vertical' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Use <code style={{ background: '#f1f5f9', padding: '0 4px', borderRadius: 4 }}>{'{variable_name}'}</code> for dynamic values</span>
          <span style={{ color: charCount > 1600 ? '#ef4444' : undefined }}>{charCount} / 1600</span>
        </div>
      </div>
    </Modal>
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────
const ChannelBadge = ({ channel }) =>
  channel === 'whatsapp'
    ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#25d366', fontWeight: 600 }}><MessageCircle size={12} /> WA</span>
    : channel === 'both'
      ? <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>Both</span>
      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}><Smartphone size={12} /> SMS</span>;

const StatusPill = ({ status }) => {
  const Icon = statusIcon[status] || Clock;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <Icon size={13} style={{ color: statusColor[status] }} />
      <span style={{ fontSize: 12, color: statusColor[status], fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
};

function ScheduledRow({ campaign: c, onCancel, cancelling }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer', background: expanded ? '#f8fafc' : 'white' }}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: '#fff8e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={11} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.targetType?.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</div>
            </div>
          </div>
        </td>
        <td><ChannelBadge channel={c.channel} /></td>
        <td><span style={{ fontSize: 12, background: '#fff8e1', color: '#f59e0b', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Scheduled</span></td>
        <td style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>
          {safeFormat(c.scheduledAt, 'dd MMM yyyy, hh:mm a')}
        </td>
        <td style={{ textAlign: 'right' }}>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
            {expanded ? '▲ Hide' : '▼ Details'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: 0, background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Target</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.targetType?.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Channel</div>
                  <ChannelBadge channel={c.channel} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Scheduled For</div>
                  <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>{safeFormat(c.scheduledAt, 'dd MMM yyyy, hh:mm a')}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Message</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {c.message}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onCancel(); }} disabled={cancelling}>
                  <Trash2 size={13} /> Cancel Scheduled Send
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const BATCH_PAGE_SIZE = 25;

function BatchRow({ batch }) {
  const qc = useQueryClient();
  const [expanded, setExpanded]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent' | 'failed'
  const [search, setSearch]         = useState('');
  const [innerPage, setInnerPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sms-batch-logs', batch._id],
    queryFn: () => api.get(`/sms/batches/${batch._id}/logs`),
    enabled: expanded,
  });
  const allLogs = data?.logs || [];

  const retryMutation = useMutation({
    mutationFn: (id) => api.post(`/sms/logs/${id}/retry`),
    onSuccess: () => { qc.invalidateQueries(['sms-batch-logs', batch._id]); toast.success('Retrying...'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Retry failed')
  });

  // Filter + search — reset page on change
  const filtered = allLogs.filter(log => {
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (search && !(log.recipientName || '').toLowerCase().includes(search.toLowerCase()) && !(log.to || '').includes(search)) return false;
    return true;
  });

  useEffect(() => { setInnerPage(1); }, [statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BATCH_PAGE_SIZE));
  const paged = filtered.slice((innerPage - 1) * BATCH_PAGE_SIZE, innerPage * BATCH_PAGE_SIZE);

  const counts = {
    all:    allLogs.length,
    sent:   allLogs.filter(l => l.status === 'sent' || l.status === 'delivered').length,
    failed: allLogs.filter(l => l.status === 'failed').length,
  };

  const batchStatusColor = { completed: '#10b981', running: '#1a56e8', failed: '#ef4444', cancelled: '#94a3b8' };
  const sc = batchStatusColor[batch.status] || '#94a3b8';

  const filterTabs = [
    { key: 'all',    label: 'All',    count: counts.all },
    { key: 'sent',   label: 'Sent',   count: counts.sent,   color: '#10b981' },
    { key: 'failed', label: 'Failed', count: counts.failed, color: '#ef4444' },
  ];

  return (
    <>
      <tr onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer', background: expanded ? '#f8fafc' : 'white' }}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={11} color="var(--text-muted)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{batch.targetType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batch.message}</div>
            </div>
          </div>
        </td>
        <td><ChannelBadge channel={batch.channel} /></td>
        <td>
          <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{batch.sentCount} sent</span>
            {batch.failedCount > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{batch.failedCount} failed</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{batch.totalCount} total</div>
        </td>
        <td><span style={{ fontSize: 12, background: sc + '18', color: sc, padding: '2px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>{batch.status}</span></td>
        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{safeFormat(batch.createdAt, 'dd MMM yyyy, hh:mm a')}</td>
        <td style={{ textAlign: 'right' }}>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
            {expanded ? '▲ Hide' : '▼ Details'}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
            {isLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading recipients…</div>
            ) : allLogs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No individual logs found</div>
            ) : (
              <div>
                {/* Toolbar: filter tabs + search */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 12, flexWrap: 'wrap' }}>
                  {/* Status tabs */}
                  <div style={{ display: 'flex', gap: 2, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
                    {filterTabs.map(tab => {
                      const active = statusFilter === tab.key;
                      return (
                        <button key={tab.key} type="button"
                          onClick={e => { e.stopPropagation(); setStatusFilter(tab.key); }}
                          style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
                            background: active ? (tab.color ? tab.color + '18' : '#eff6ff') : 'transparent',
                            color: active ? (tab.color || 'var(--primary)') : 'var(--text-secondary)',
                          }}>
                          {tab.label}
                          <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 600, background: active ? (tab.color || 'var(--primary)') : '#e2e8f0', color: active ? 'white' : 'var(--text-muted)', padding: '1px 6px', borderRadius: 10 }}>{tab.count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Search */}
                  <input
                    className="form-control"
                    style={{ width: 200, padding: '5px 10px', fontSize: 12 }}
                    placeholder="Search name or number…"
                    value={search}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); setSearch(e.target.value); }}
                  />
                </div>

                {/* Table */}
                {filtered.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No recipients match this filter.</div>
                ) : (
                  <>
                    <table style={{ width: '100%' }}>
                      <thead style={{ background: '#f1f5f9' }}>
                        <tr>
                          <th style={{ paddingLeft: 32 }}>Recipient</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Error</th>
                          <th>Sent At</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map(log => (
                          <tr key={log._id} style={{ background: '#f8fafc' }}>
                            <td style={{ paddingLeft: 32, fontSize: 13 }}>{log.recipientName || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.to}</td>
                            <td><StatusPill status={log.status} /></td>
                            <td style={{ fontSize: 12, color: '#ef4444', maxWidth: 260 }}>
                              {log.error ? (
                                <span title={log.error} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                  {log.error}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{safeFormat(log.sentAt, 'dd MMM HH:mm')}</td>
                            <td>
                              {log.status === 'failed' && log.retryCount < 3 && (
                                <button className="btn btn-secondary btn-sm btn-icon" onClick={e => { e.stopPropagation(); retryMutation.mutate(log._id); }} title="Retry">
                                  <RefreshCw size={12} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination footer — always visible */}
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'white' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Showing {filtered.length === 0 ? 0 : (innerPage - 1) * BATCH_PAGE_SIZE + 1}–{Math.min(innerPage * BATCH_PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className="btn btn-secondary btn-sm" disabled={innerPage === 1} onClick={() => setInnerPage(p => p - 1)}>
                            <ChevronLeft size={13} />
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - innerPage) <= 1)
                            .reduce((acc, p, idx, arr) => {
                              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, i) => p === '…'
                              ? <span key={`e${i}`} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
                              : <button key={p} className={`btn btn-sm ${p === innerPage ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setInnerPage(p)}>{p}</button>
                            )
                          }
                          <button className="btn btn-secondary btn-sm" disabled={innerPage === totalPages} onClick={() => setInnerPage(p => p + 1)}>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function LogsTab() {
  const qc = useQueryClient();
  const [view, setView] = useState('batches'); // 'batches' | 'individual'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: statsData } = useQuery({ queryKey: ['sms-stats'], queryFn: () => api.get('/sms/stats') });
  const stats = statsData?.stats;

  const { data: scheduledData, refetch: refetchScheduled } = useQuery({ queryKey: ['sms-scheduled'], queryFn: () => api.get('/sms/scheduled') });
  const scheduled = scheduledData?.campaigns || [];

  const cancelMutation = useMutation({
    mutationFn: (id) => api.delete(`/sms/scheduled/${id}`),
    onSuccess: () => { refetchScheduled(); toast.success('Scheduled send cancelled'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Cancel failed')
  });

  const { data: batchData, isLoading: batchLoading } = useQuery({
    queryKey: ['sms-batches', page],
    queryFn: () => api.get(`/sms/batches?page=${page}&limit=20`),
    enabled: view === 'batches',
    keepPreviousData: true,
  });
  const batches = batchData?.batches || [];
  const batchPages = batchData?.pages || 1;

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['sms-logs', page, search, statusFilter],
    queryFn: () => api.get(`/sms/logs?page=${page}&limit=50&search=${search}&status=${statusFilter}`),
    enabled: view === 'individual',
    keepPreviousData: true,
  });
  const logs  = logsData?.logs || [];
  const logPages = logsData?.pages || 1;

  const retryMutation = useMutation({
    mutationFn: (id) => api.post(`/sms/logs/${id}/retry`),
    onSuccess: () => { qc.invalidateQueries(['sms-logs']); toast.success('Retrying...'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Retry failed')
  });

  const statCards = [
    { label: 'Total Sent',  value: stats?.total || 0,     color: '#1a56e8' },
    { label: 'Delivered',   value: stats?.delivered || 0, color: '#10b981' },
    { label: 'Failed',      value: stats?.failed || 0,    color: '#ef4444' },
    { label: 'Pending',     value: stats?.pending || 0,   color: '#f59e0b' },
  ];

  const switchView = (v) => { setView(v); setPage(1); setSearch(''); setStatusFilter(''); };

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {statCards.map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} color="#f59e0b" />
            <span className="text-14-semibold">Scheduled Sends</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{scheduled.length} pending</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Target / Message</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Scheduled For</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map(c => <ScheduledRow key={c._id} campaign={c} onCancel={() => cancelMutation.mutate(c._id)} cancelling={cancelMutation.isLoading} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button onClick={() => switchView('batches')} style={{ padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: view === 'batches' ? 600 : 400, background: view === 'batches' ? 'var(--primary)' : '#f8fafc', color: view === 'batches' ? 'white' : 'var(--text-secondary)' }}>
            Bulk Sends
          </button>
          <button onClick={() => switchView('individual')} style={{ padding: '7px 18px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: view === 'individual' ? 600 : 400, background: view === 'individual' ? 'var(--primary)' : '#f8fafc', color: view === 'individual' ? 'white' : 'var(--text-secondary)' }}>
            Individual Messages
          </button>
        </div>
        {view === 'individual' && (
          <div className="filter-bar" style={{ margin: 0 }}>
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search phone or message..." />
            <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              {['sent','delivered','failed','pending','undelivered'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Bulk Sends view */}
      {view === 'batches' && (
        batchLoading ? <PageLoader /> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr><th>Target / Message</th><th>Channel</th><th>Results</th><th>Status</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {batches.length === 0 && <tr><td colSpan={6}><EmptyState icon={MessageSquare} message="No bulk sends yet." /></td></tr>}
                {batches.map(b => <BatchRow key={b._id} batch={b} />)}
              </tbody>
            </table>
            {batchPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0' }}>
                {Array.from({ length: batchPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}>{p}</button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Individual Messages view */}
      {view === 'individual' && (
        logsLoading ? <PageLoader /> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr><th>Recipient</th><th>Message</th><th>Channel</th><th>Status</th><th>Sent At</th><th></th></tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={6}><EmptyState icon={MessageSquare} message="No messages found." /></td></tr>}
                {logs.map(log => (
                  <tr key={log._id}>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{log.recipientName || log.to}</div>
                      {log.recipientName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.to}</div>}
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</div>
                    </td>
                    <td><ChannelBadge channel={log.channel} /></td>
                    <td><StatusPill status={log.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{safeFormat(log.sentAt, 'dd MMM HH:mm')}</td>
                    <td>
                      {log.status === 'failed' && log.retryCount < 3 && (
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => retryMutation.mutate(log._id)} title="Retry">
                          <RefreshCw size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0' }}>
                {Array.from({ length: logPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}>{p}</button>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function NotifEditModal({ notifKey, channel, label, content, onSave, onClose }) {
  const [text, setText] = useState(content || '');
  const chColor = channel === 'whatsapp' ? '#25d366' : 'var(--primary)';
  const ChIcon  = channel === 'whatsapp' ? MessageCircle : Smartphone;
  return (
    <Modal open onClose={onClose}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ChIcon size={15} color={chColor} /> Customize — {label}</span>}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onSave(text); onClose(); }}>Save</button>
        </>
      }>
      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Use <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{'{{studentName}}'}</code>, <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{'{{schoolName}}'}</code> etc. as placeholders.
      </div>
      <textarea className="form-control" rows={5} value={text} onChange={e => setText(e.target.value)}
        placeholder={`Enter the ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} message for "${label}"…`}
        style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{text.length} chars</div>
    </Modal>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['sms-settings'], queryFn: () => api.get('/sms/settings') });
  const [config, setConfig]     = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testChannel, setTestChannel] = useState('sms');
  const [testing, setTesting]   = useState(false);
  const [editingNotif, setEditingNotif] = useState(null); // { key, channel, label }

  useEffect(() => {
    if (!data) return;
    const base = {
      smsEnabled: false, whatsappEnabled: false,
      twilioSid: '', twilioToken: '',
      messagingServiceSid: '', whatsappNumber: '',
      notifications: {}
    };
    // Merge so existing saved values always win over defaults
    setConfig({ ...base, ...(data.smsConfig || {}) });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (d) => api.put('/sms/settings', d),
    onSuccess: () => { qc.invalidateQueries(['sms-settings']); toast.success('Settings saved!'); },
    onError: (err) => toast.error(err?.message || 'Failed to save settings'),
  });

  const handleTest = async () => {
    if (!testPhone) return toast.error('Enter a phone number');
    setTesting(true);
    try {
      const res = await api.post('/sms/test', { phone: testPhone, channel: testChannel });
      if (res?.success === false) toast.error(res.message || 'Test failed');
      else toast.success(`Test ${testChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent! Check your phone.`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Test failed');
    } finally { setTesting(false); }
  };

  const set = (path, value) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) { if (!obj[keys[i]]) obj[keys[i]] = {}; obj = obj[keys[i]]; }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  // Normalise a notification value (supports old boolean format)
  const getNotif = (key) => {
    const n = config?.notifications?.[key];
    if (!n || typeof n === 'boolean') return { sms: !!n, whatsapp: false, smsContent: '', whatsappContent: '' };
    return { sms: false, whatsapp: false, smsContent: '', whatsappContent: '', ...n };
  };

  const setNotif = (key, field, value) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.notifications) next.notifications = {};
      next.notifications[key] = { ...getNotif(key), [field]: value };
      return next;
    });
  };

  if (isLoading || !config) return <PageLoader />;

  const Toggle = ({ on, onChange }) => (
    <button type="button" onClick={() => onChange(!on)}
      style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: on ? 'var(--primary)' : '#cbd5e1', position: 'relative', transition: 'background 0.2s' }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16,
        borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
    </button>
  );

  const rowSep = { borderBottom: '1px solid #f1f5f9' };

  return (
    <div style={{ maxWidth: 660 }}>

      {/* ── Twilio + Channel enables ─────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 className="text-14-semibold" style={{ marginBottom: 16 }}>Twilio Configuration</h3>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Account SID</label>
            <input className="form-control" type="password" value={config.twilioSid || ''} onChange={e => set('twilioSid', e.target.value)} placeholder="ACxxxxxxxx…" />
          </div>
          <div className="form-group">
            <label className="form-label">Auth Token</label>
            <input className="form-control" type="password" value={config.twilioToken || ''} onChange={e => set('twilioToken', e.target.value)} placeholder="Auth token" />
          </div>
        </FormRow>
        <div className="form-group">
          <label className="form-label">Messaging Service SID <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>for SMS</span></label>
          <input className="form-control" value={config.messagingServiceSid || ''} onChange={e => set('messagingServiceSid', e.target.value)} placeholder="MGxxxxxxxx…" />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">WhatsApp Number <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>Twilio WhatsApp-enabled</span></label>
          <input className="form-control" value={config.whatsappNumber || ''} onChange={e => set('whatsappNumber', e.target.value)} placeholder="+14155238886" />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'smsEnabled',      label: 'SMS',       desc: 'Send messages via SMS',      Icon: Smartphone    },
            { key: 'whatsappEnabled', label: 'WhatsApp',  desc: 'Send messages via WhatsApp', Icon: MessageCircle },
          ].map(({ key, label, desc, Icon }) => {
            const on = config[key] ?? false;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} color="var(--text-muted)" />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{desc}</span>
                  </div>
                </div>
                <Toggle on={on} onChange={v => set(key, v)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Send Test ────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 className="text-14-semibold" style={{ marginBottom: 12 }}>Send Test Message</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-control" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+91XXXXXXXXXX" style={{ flex: 1 }} />
          {/* Only show channel selector if both channels are enabled */}
          {config.smsEnabled && config.whatsappEnabled && (
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
              <button type="button" onClick={() => setTestChannel('sms')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', border: 'none', cursor: 'pointer', fontSize: 13,
                  background: testChannel === 'sms' ? 'var(--primary)' : 'white', color: testChannel === 'sms' ? 'white' : 'var(--text-secondary)' }}>
                <Smartphone size={13} /> SMS
              </button>
              <button type="button" onClick={() => setTestChannel('whatsapp')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: 13,
                  background: testChannel === 'whatsapp' ? '#25d366' : 'white', color: testChannel === 'whatsapp' ? 'white' : 'var(--text-secondary)' }}>
                <MessageCircle size={13} /> WhatsApp
              </button>
            </div>
          )}
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing} style={{ flexShrink: 0 }}>
            <Send size={14} /> {testing ? 'Sending…' : `Test ${config.smsEnabled && !config.whatsappEnabled ? 'SMS' : config.whatsappEnabled && !config.smsEnabled ? 'WhatsApp' : testChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`}
          </button>
        </div>
      </div>

      {/* ── Auto Notifications ───────────────────────────────── */}
      {(() => {
        const showSms = config.smsEnabled;
        const showWa  = config.whatsappEnabled;
        const cols    = `1fr${showSms ? ' 96px' : ''}${showWa ? ' 96px' : ''}`;
        const CellBtn = ({ notifKey, notifLabel, channel, on, hasContent, accentColor, accentBg }) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Toggle on={on} onChange={v => setNotif(notifKey, channel, v)} />
            <button type="button" disabled={!on}
              title={on ? `Edit ${channel === 'sms' ? 'SMS' : 'WhatsApp'} message` : 'Enable first'}
              onClick={() => on && setEditingNotif({ key: notifKey, channel, label: notifLabel })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6,
                border: `1px solid ${on && hasContent ? accentColor : 'var(--border)'}`,
                background: on && hasContent ? accentBg : on ? 'white' : '#f8fafc',
                color: on && hasContent ? accentColor : on ? 'var(--text-muted)' : '#cbd5e1',
                cursor: on ? 'pointer' : 'default', transition: 'all 0.15s' }}>
              <Pencil size={11} />
            </button>
          </div>
        );
        return (
          <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '12px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto Notifications</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Toggle per channel · pencil to customise message</div>
              </div>
              {showSms && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}><Smartphone size={13} /> SMS</div>}
              {showWa  && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#25d366'       }}><MessageCircle size={13} /> WA</div>}
            </div>
            {Object.entries(NOTIFICATION_LABELS).map(([key, label], idx, arr) => {
              const n = getNotif(key);
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', ...(idx < arr.length - 1 ? rowSep : {}) }}>
                  <div style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
                  {showSms && <CellBtn notifKey={key} notifLabel={label} channel="sms"      on={n.sms}     hasContent={!!n.smsContent}      accentColor="var(--primary)" accentBg="#eff6ff" />}
                  {showWa  && <CellBtn notifKey={key} notifLabel={label} channel="whatsapp" on={n.whatsapp} hasContent={!!n.whatsappContent} accentColor="#25d366"        accentBg="#f0fdf4" />}
                </div>
              );
            })}
          </div>
        );
      })()}

      <button className="btn btn-primary" style={{ padding: '10px 28px' }} onClick={() => saveMutation.mutate(config)} disabled={saveMutation.isLoading}>
        <Save size={15} /> {saveMutation.isLoading ? 'Saving…' : 'Save Settings'}
      </button>

      {editingNotif && (
        <NotifEditModal
          notifKey={editingNotif.key}
          channel={editingNotif.channel}
          label={editingNotif.label}
          content={getNotif(editingNotif.key)[editingNotif.channel === 'sms' ? 'smsContent' : 'whatsappContent']}
          onSave={text => setNotif(editingNotif.key, editingNotif.channel === 'sms' ? 'smsContent' : 'whatsappContent', text)}
          onClose={() => setEditingNotif(null)}
        />
      )}
    </div>
  );
}
