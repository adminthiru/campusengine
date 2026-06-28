import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { UserCheck, Save, ChevronLeft, ChevronRight, Edit2, Settings, Clock, CheckCircle, XCircle, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select as AntSelect, DatePicker } from 'antd';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { useYear } from '../../store/YearContext';
import { PageLoader, Avatar, SearchInput, Modal } from '../../components/ui';

const BASE_STATUS_CONFIG = [
  { key: 'present',  label: 'P',  fullLabel: 'Present',  color: '#10b981', bg: '#f0fdf4' },
  { key: 'absent',   label: 'A',  fullLabel: 'Absent',   color: '#ef4444', bg: '#fef2f2' },
  { key: 'half_day', label: 'H',  fullLabel: 'Half Day', color: '#f97316', bg: '#fff7ed' },
  { key: 'late',     label: 'L',  fullLabel: 'Late',     color: '#f59e0b', bg: '#fffbeb' },
  { key: 'excused',  label: 'E',  fullLabel: 'Excused',  color: '#6366f1', bg: '#eef2ff' },
];

// Extra statuses for employees — driven entirely by school leave config
const LEAVE_META = {
  od: { label: 'OD', fullLabel: 'On Duty',      color: '#0ea5e9', bg: '#f0f9ff' },
  cl: { label: 'CL', fullLabel: 'Casual Leave', color: '#8b5cf6', bg: '#f5f3ff' },
  sl: { label: 'SL', fullLabel: 'Sick Leave',   color: '#ec4899', bg: '#fdf2f8' },
};

const toAmPm = (time = '') => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

// Converts 12-hr parts → "HH:MM" 24-hr string stored in state
const to24 = (h12, min, period) => {
  let h = Number(h12);
  if (period === 'AM') { if (h === 12) h = 0; }
  else                 { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, '0')}:${min}`;
};

// Custom AM/PM time picker — stores value as "HH:MM" but displays 12-hr
function AmPmTimePicker({ value = '10:00', onChange }) {
  const [h24, m] = value.split(':');
  const h24n = Number(h24);
  const period = h24n >= 12 ? 'PM' : 'AM';
  const hour12 = String(h24n % 12 || 12);

  const sel = {
    padding: '6px 4px', border: '1px solid var(--border)', borderRadius: 6,
    fontSize: 14, fontWeight: 600, background: 'white', cursor: 'pointer',
    outline: 'none', color: 'var(--text-primary)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2,
      border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px',
      background: 'white' }}>
      {/* Hour */}
      <select value={hour12} style={sel}
        onChange={e => onChange(to24(e.target.value, m, period))}>
        {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => (
          <option key={h} value={String(h)}>{String(h).padStart(2,'0')}</option>
        ))}
      </select>
      <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>:</span>
      {/* Minute */}
      <select value={m} style={sel}
        onChange={e => onChange(to24(hour12, e.target.value, period))}>
        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(min => (
          <option key={min} value={min}>{min}</option>
        ))}
      </select>
      {/* AM/PM toggle */}
      <div style={{ display: 'flex', marginLeft: 4, borderRadius: 6, overflow: 'hidden',
        border: '1px solid var(--border)' }}>
        {['AM','PM'].map(p => (
          <button key={p} onClick={() => onChange(to24(hour12, m, p))}
            style={{
              padding: '4px 8px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: period === p ? 'var(--primary)' : 'white',
              color: period === p ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

export default function Attendance() {
  const qc = useQueryClient();
  const { selectedYear, isCurrent, range } = useYear();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // When a past academic year is selected in the header, move the working
  // date into that year so the summaries reflect it; current year stays today.
  useEffect(() => {
    setDate(isCurrent ? format(new Date(), 'yyyy-MM-dd') : range.startDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);
  const [classId, setClassId] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [tab, setTab] = useState('student');
  const [search, setSearch] = useState('');
  const [attendance, setAttendance] = useState({}); // { [personId]: { status, remarks } }
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [holidayWarning, setHolidayWarning] = useState(null);

  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = schoolData?.school;

  // Working days for the selected month
  const [yearStr, monthStr] = date.split('-');
  const { data: wdData } = useQuery({
    queryKey: ['working-days', yearStr, monthStr, classId, tab],
    queryFn: () => api.get(`/attendance/working-days?year=${yearStr}&month=${monthStr}${tab === 'student' && classId ? '&classId=' + classId : ''}`),
    enabled: !!(yearStr && monthStr),
  });
  const workingDaysInfo = wdData || null;

  // Build employee status config — fully driven by school leave settings (no hardcoded extras)
  const empStatusConfig = (() => {
    const leaveTypes = school?.leaveTypes?.length
      ? school.leaveTypes
      : [{ code: 'od', enabled: true }, { code: 'cl', enabled: true }, { code: 'sl', enabled: true }];
    const extra = leaveTypes
      .filter(lt => lt.enabled && LEAVE_META[lt.code])
      .map(lt => ({ key: lt.code, ...LEAVE_META[lt.code] }));
    return [...BASE_STATUS_CONFIG, ...extra];
  })();

  const { data: classData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes')
  });
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

  // Initially select the first class (e.g. PRE-KG) on the Student Attendance tab.
  const didInitClass = useRef(false);
  useEffect(() => {
    if (!didInitClass.current && tab === 'student' && !classId && classes.length > 0) {
      setClassId(classes[0]._id);
      didInitClass.current = true;
    }
  }, [classes, tab, classId]);

  const { data: studentData, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-attendance', classId],
    enabled: tab === 'student' && !!classId,
    queryFn: () => api.get(`/students?classId=${classId}&limit=100&status=active`)
  });
  const students = studentData?.students || [];

  const { data: empData, isLoading: loadingEmps } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/employees?limit=200&status=active'),
    enabled: tab === 'employee' || tab === 'checkin'
  });
  const allEmployees = empData?.employees || [];

  // ── Leave Requests tab ───────────────────────────────────────────────────
  const [leaveFilter, setLeaveFilter] = useState('all');
  const [leaveScope, setLeaveScope]   = useState('student'); // 'student' | 'staff'
  const [editingLeaves, setEditingLeaves] = useState(() => new Set()); // ids re-opened for edit

  // Staff (employee) leave requests
  const { data: leavesData, isLoading: loadingLeaves } = useQuery({
    queryKey: ['leaves', leaveFilter],
    enabled:  tab === 'leaves' && leaveScope === 'staff',
    queryFn:  () => api.get(`/leaves${leaveFilter !== 'all' ? `?status=${leaveFilter}` : ''}`),
  });
  // Hide leaves whose employee was deleted (orphaned records).
  const staffLeaves = (leavesData?.leaves ?? []).filter(lv => lv.employee);

  // Student leave requests (submitted from the parent / student app)
  const { data: stuLeavesData, isLoading: loadingStuLeaves } = useQuery({
    queryKey: ['student-leaves', leaveFilter],
    enabled:  tab === 'leaves' && leaveScope === 'student',
    queryFn:  () => api.get(`/student-leaves${leaveFilter !== 'all' ? `?status=${leaveFilter}` : ''}`),
  });
  const studentLeaves = (stuLeavesData?.leaves ?? []).filter(lv => lv.student);

  // Always-on query: total pending leaves across both student + staff
  // Used only for the tab badge — lightweight, refetches every 30 s.
  const { data: pendingLeavesCount = 0 } = useQuery({
    queryKey: ['pending-leaves-count'],
    queryFn: async () => {
      const [stuRes, staffRes] = await Promise.all([
        api.get('/student-leaves?status=pending').catch(() => null),
        api.get('/leaves?status=pending').catch(() => null),
      ]);
      return (stuRes?.leaves?.length ?? 0) + (staffRes?.leaves?.length ?? 0);
    },
    refetchInterval: 30000,
  });

  const leaveQuery = search.trim().toLowerCase();
  const loadingLeaveList = leaveScope === 'staff' ? loadingLeaves : loadingStuLeaves;
  const displayLeaves = leaveScope === 'staff'
    ? (leaveQuery
        ? staffLeaves.filter(lv =>
            (lv.employee?.name || '').toLowerCase().includes(leaveQuery) ||
            (lv.employee?.employeeId || '').toLowerCase().includes(leaveQuery) ||
            (lv.reason || '').toLowerCase().includes(leaveQuery))
        : staffLeaves)
    : (leaveQuery
        ? studentLeaves.filter(lv =>
            (lv.student?.name || '').toLowerCase().includes(leaveQuery) ||
            (lv.student?.admissionNumber || '').toLowerCase().includes(leaveQuery) ||
            (lv.reason || '').toLowerCase().includes(leaveQuery))
        : studentLeaves);

  const leaveAction = useMutation({
    mutationFn: ({ id, status, adminNote }) =>
      api.put(`/leaves/${id}`, { status, adminNote }),
    onSuccess: (_, { status }) => {
      toast.success(`Leave ${status}`);
      qc.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: () => toast.error('Action failed'),
  });

  const studentLeaveAction = useMutation({
    mutationFn: ({ id, status, adminNote }) =>
      api.put(`/student-leaves/${id}`, { status, adminNote }),
    onSuccess: (_, { status }) => {
      toast.success(`Leave ${status}`);
      qc.invalidateQueries({ queryKey: ['student-leaves'] });
    },
    onError: () => toast.error('Action failed'),
  });
  const activeLeaveAction = leaveScope === 'staff' ? leaveAction : studentLeaveAction;

  // ── Staff Check-in tab state ──────────────────────────────────────────────
  const [showTimingForm, setShowTimingForm] = useState(false);
  const [timingForm, setTimingForm] = useState({ onTimeBy: '10:00', lateFrom: '11:00', halfDayFrom: '12:30', schoolEndTime: '16:00', enabled: true });
  const [savingTiming, setSavingTiming] = useState(false);

  const { data: checkinData, isLoading: loadingCheckins } = useQuery({
    queryKey: ['staff-checkins', date],
    queryFn: () => api.get(`/staff-attendance?date=${date}`),
    enabled: tab === 'checkin',
  });
  const checkinRecords = checkinData?.records || [];
  const checkinTiming  = checkinData?.timing;

  // Sync timing form when data loads
  useEffect(() => {
    if (checkinTiming) {
      setTimingForm({
        onTimeBy:      checkinTiming.onTimeBy      || '10:00',
        lateFrom:      checkinTiming.lateFrom      || '11:00',
        halfDayFrom:   checkinTiming.halfDayFrom   || '12:30',
        schoolEndTime: checkinTiming.schoolEndTime || '16:00',
        enabled:       checkinTiming.enabled !== false,
      });
    }
  }, [checkinTiming]);

  // Merge: checked-in employees + all employees who haven't checked in
  const checkinByEmpId = {};
  checkinRecords.forEach(r => { checkinByEmpId[String(r.employee?._id)] = r; });

  const toMinutes = (t = '00:00') => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const formatLate = (mins) => { const h = Math.floor(mins / 60); const m = mins % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  const getCheckinStatus = (checkInTime) => {
    if (!checkInTime) return null;
    const d = new Date(checkInTime);
    const nowMins = d.getHours() * 60 + d.getMinutes();
    const onTimeByMin    = toMinutes(timingForm.onTimeBy);
    const lateFromMin    = toMinutes(timingForm.lateFrom);
    const halfDayFromMin = toMinutes(timingForm.halfDayFrom);
    if (nowMins > halfDayFromMin) {
      return { status: 'half_day', label: 'Half Day', color: '#f97316', bg: '#fff7ed', late: formatLate(nowMins - onTimeByMin) };
    }
    if (nowMins > lateFromMin) {
      return { status: 'late', label: 'Late', color: '#f59e0b', bg: '#fffbeb', late: formatLate(nowMins - onTimeByMin) };
    }
    return { status: 'present', label: 'On Time', color: '#10b981', bg: '#f0fdf4', late: null };
  };

  const saveTimingConfig = async () => {
    setSavingTiming(true);
    try {
      await api.put('/school/staff-attendance-timing', timingForm);
      toast.success('Timing rules saved');
      qc.invalidateQueries(['staff-checkins']);
      setShowTimingForm(false);
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingTiming(false);
    }
  };

  // Unique roles from employees
  const empRoles = [...new Set(allEmployees.map(e => e.role).filter(Boolean))].sort();
  const employees = empRole ? allEmployees.filter(e => e.role === empRole) : allEmployees;

  // Parse month/year from selected date for leave balance tracking
  const yearNum = Number(yearStr), monthNum = Number(monthStr);

  // Monthly leave usage per employee — auto-resets each month naturally
  const { data: leaveBalData } = useQuery({
    queryKey: ['leave-balance', monthNum, yearNum],
    enabled: tab === 'employee',
    queryFn: () => api.get(`/attendance/leave-balance?month=${monthNum}&year=${yearNum}`)
  });
  const usedLeave    = leaveBalData?.used    || {};  // this month only
  const usedLeaveYtd = leaveBalData?.usedYtd || {};  // year to date

  // Limits: respect carry-forward — if ON, entitlement grows each month
  const currentMonth = new Date().getMonth() + 1; // 1–12
  const clType = school?.leaveTypes?.find(lt => lt.code === 'cl');
  const slType = school?.leaveTypes?.find(lt => lt.code === 'sl');
  const clDpm  = clType?.daysPerMonth ?? 1;
  const slDpm  = slType?.daysPerMonth ?? 1;
  const clCf   = clType?.carryForward ?? false;
  const slCf   = slType?.carryForward ?? false;
  const clLimit = clCf ? clDpm * currentMonth : clDpm;
  const slLimit = slCf ? slDpm * currentMonth : slDpm;

  const getRemaining = (empId, code) => {
    const cf    = code === 'cl' ? clCf  : code === 'sl' ? slCf  : false;
    const limit = code === 'cl' ? clLimit : code === 'sl' ? slLimit : null;
    if (limit === null) return null;
    // Use YTD usage when carry-forward is on, monthly usage otherwise
    const used = cf
      ? (usedLeaveYtd[empId]?.[code] || 0)
      : (usedLeave[empId]?.[code]    || 0);
    return Math.max(0, limit - used);
  };

  const { data: existingData } = useQuery({
    queryKey: ['attendance-existing', date, tab === 'student' ? classId : '', tab],
    enabled: tab === 'student' ? !!classId : true,
    // Employee attendance has no class — never pass classId for it, or the
    // backend filters by a (stale) class and returns nothing.
    queryFn: () => api.get(`/attendance?type=${tab}${tab === 'student' ? `&classId=${classId}` : ''}&date=${date}`)
  });

  // Populate attendance from saved data whenever query result changes
  useEffect(() => {
    if (existingData === undefined) return;
    const existing = existingData?.attendance?.[0];
    if (existing) {
      const map = {};
      existing.records.forEach(r => {
        const id = r.student?._id || r.employee?._id || r.student || r.employee;
        if (id) map[String(id)] = { status: r.status, remarks: r.remarks || '' };
      });
      setAttendance(map);
    } else {
      setAttendance({});
    }
    setEditMode(false);
  }, [existingData]);

  const allPeople = tab === 'student' ? students : employees;
  const people = search.trim()
    ? allPeople.filter(p => {
        const q = search.trim().toLowerCase();
        return p.name?.toLowerCase().includes(q) ||
          (tab === 'student' ? p.admissionNumber : p.employeeId)?.toLowerCase().includes(q);
      })
    : allPeople;
  const statusConfig = tab === 'student' ? BASE_STATUS_CONFIG : empStatusConfig;

  const setStatus = (id, status) => {
    setAttendance(prev => ({
      ...prev,
      [id]: { status, remarks: prev[id]?.remarks || '' }
    }));
  };

  const setRemarks = (id, remarks) => {
    setAttendance(prev => ({
      ...prev,
      [id]: { status: prev[id]?.status, remarks }
    }));
  };

  const toggleAll = (status) => {
    const map = {};
    people.forEach(p => {
      map[p._id] = { status, remarks: attendance[p._id]?.remarks || '' };
    });
    setAttendance(map);
  };

  const saveAttendance = async () => {
    if (people.length === 0) return toast.error('No students/employees to mark');
    setSaving(true);
    try {
      // Only save people who were explicitly marked — never auto-mark present
      // for untouched rows.
      const records = people
        .filter(p => attendance[p._id]?.status)
        .map(p => ({
          [tab === 'student' ? 'student' : 'employee']: p._id,
          status: attendance[p._id].status,
          remarks: attendance[p._id]?.remarks || ''
        }));
      let res;
      if (tab === 'student') {
        res = await api.post('/attendance/student', { classId, date, records });
      } else {
        res = await api.post('/attendance/employee', { date, records });
      }
      toast.success('Attendance saved!');
      qc.invalidateQueries(['attendance-existing']);
      setEditMode(false);
      // Show holiday or Saturday warning if returned by backend
      if (res?.holidayWarning || res?.isHoliday || res?.isSaturdayHoliday) {
        setHolidayWarning(res.holidayWarning || 'This date is a holiday. Attendance saved but will not affect salary LOP.');
      } else {
        setHolidayWarning(null);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const markedCount = people.filter(p => attendance[p._id]?.status).length;
  const notMarked = people.length - markedCount;
  const counts = statusConfig.reduce((acc, s) => {
    acc[s.key] = people.filter(p => attendance[p._id]?.status === s.key).length;
    return acc;
  }, {});

  const statsCards = [
    { label: 'Total',      val: people.length, color: 'var(--text-primary)' },
    ...statusConfig.map(s => ({ label: s.fullLabel, val: counts[s.key], color: s.color })),
    { label: 'Not Marked', val: notMarked,      color: 'var(--text-muted)' },
  ];

  const isLoading = (tab === 'student' && loadingStudents) || (tab === 'employee' && loadingEmps);

  return (
    <div>
      {holidayWarning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, color: '#92400e', flex: 1 }}>{holidayWarning}</span>
          <button onClick={() => setHolidayWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Mark daily attendance</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {workingDaysInfo?.workingDays != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 4,
              background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 20,
              padding: '4px 12px', fontSize: 12.5, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap',
            }}>
              <CalendarDays size={13} style={{ color: '#94a3b8' }} />
              {new Date(date).toLocaleString('default', { month: 'long', year: 'numeric' })}
              <span style={{ color: '#cbd5e1' }}>·</span>
              <b style={{ color: '#334155' }}>{workingDaysInfo.workingDays}</b> working days
              {workingDaysInfo.holidayCount > 0 && <><span style={{ color: '#cbd5e1' }}>·</span><b style={{ color: '#334155' }}>{workingDaysInfo.holidayCount}</b> holiday{workingDaysInfo.holidayCount !== 1 ? 's' : ''}</>}
              {workingDaysInfo.weekendCount > 0 && <><span style={{ color: '#cbd5e1' }}>·</span><b style={{ color: '#334155' }}>{workingDaysInfo.weekendCount}</b> weekend day{workingDaysInfo.weekendCount !== 1 ? 's' : ''}</>}
            </span>
          )}
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1); setDate(format(d, 'yyyy-MM-dd'));
          }}><ChevronLeft size={16} /></button>
          <DatePicker
            style={{ width: 150, height: 36 }}
            format="DD MMM YYYY"
            allowClear={false}
            value={date ? dayjs(date) : null}
            onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
            disabledDate={(d) => d && d > dayjs().endOf('day')}
            getPopupContainer={() => document.body}
          />
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1); setDate(format(d, 'yyyy-MM-dd'));
          }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        <div style={{ display: 'flex', overflowX: 'auto', marginBottom: -2 }}>
          {[
            { key: 'student',  label: 'Student Attendance' },
            { key: 'employee', label: 'Employee Attendance' },
            { key: 'checkin',  label: 'Staff Check-in' },
            { key: 'leaves',   label: 'Leave Requests', badge: pendingLeavesCount },
          ].map(({ key, label, badge }) => (
            <button key={key}
              onClick={() => { setTab(key); setSearch(''); if (key === 'student') setEmpRole(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === key ? 700 : 500,
                color: tab === key ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${tab === key ? 'var(--primary)' : 'transparent'}`,
                transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              {label}
              {badge > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, padding: '0 5px',
                  background: '#ef4444', color: '#fff',
                  fontSize: 11, fontWeight: 700, borderRadius: 20,
                  lineHeight: 1,
                }}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar — hidden on check-in and leaves tabs */}
      {tab !== 'checkin' && tab !== 'leaves' && <div className="filter-bar">
        <div style={{ minWidth: 240 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tab === 'student' ? 'Search by name or admission no...' : 'Search by name or employee ID...'}
          />
        </div>
        {tab === 'student' && (
          <AntSelect
            style={{ minWidth: 160 }}
            value={classId || undefined}
            placeholder="Select Class"
            allowClear
            showSearch
            optionFilterProp="label"
            onChange={val => { setClassId(val ?? ''); setSearch(''); }}
            options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
          />
        )}
        {tab === 'employee' && empRoles.length > 0 && (
          <AntSelect
            style={{ minWidth: 140 }}
            value={empRole || undefined}
            placeholder="All Roles"
            allowClear
            onChange={val => setEmpRole(val ?? '')}
            options={empRoles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
          />
        )}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          {editMode && people.length > 0 && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => toggleAll('present')}>All Present</button>
              <button className="btn btn-danger btn-sm" onClick={() => toggleAll('absent')}>All Absent</button>
            </>
          )}
          {people.length > 0 && (
            editMode ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setEditMode(false);
                  qc.invalidateQueries(['attendance-existing']);
                }}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={saveAttendance} disabled={saving}>
                  {saving
                    ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving...</>
                    : <><Save size={14} /> Save Attendance</>}
                </button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>
                <Edit2 size={14} /> Edit Attendance
              </button>
            )
          )}
        </div>
      </div>}

      {/* Stats cards — full width equal columns */}
      {tab !== 'checkin' && tab !== 'leaves' && people.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${statsCards.length}, 1fr)`,
          gap: 10,
          marginBottom: 16
        }}>
          {statsCards.map(s => (
            <div key={s.label} style={{
              background: 'white', padding: '10px 6px',
              borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center'
            }}>
              <div className="text-20-bold" style={{ color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Staff Check-in tab ─────────────────────────────────────────────── */}
      {tab === 'checkin' && (() => {
        const allCheckedIn    = allEmployees.filter(e => checkinByEmpId[e._id]);
        const allNotCheckedIn = allEmployees.filter(e => !checkinByEmpId[e._id]);
        const onTime  = allCheckedIn.filter(e => getCheckinStatus(checkinByEmpId[e._id]?.checkIn?.time)?.status === 'present').length;
        const late    = allCheckedIn.filter(e => getCheckinStatus(checkinByEmpId[e._id]?.checkIn?.time)?.status === 'late').length;
        const halfDay = allCheckedIn.filter(e => getCheckinStatus(checkinByEmpId[e._id]?.checkIn?.time)?.status === 'half_day').length;
        // Search filter (display only — stats reflect all staff)
        const q = search.trim().toLowerCase();
        const matchStaff = (e) => !q || e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q);
        const checkedIn    = allCheckedIn.filter(matchStaff);
        const notCheckedIn = allNotCheckedIn.filter(matchStaff);
        const rulesConfigured = !!checkinTiming?.configured;

        return (
          <div>
            {/* Search + timing rules CTA */}
            <div className="filter-bar" style={{ marginBottom: 16 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search staff by name or ID..." />
              <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setShowTimingForm(true)}>
                <Settings size={15} /> {rulesConfigured ? 'Edit Time Rules' : 'Set Time Rules'}
              </button>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total Staff',    val: allEmployees.length, color: 'var(--text-primary)' },
                { label: 'Checked In',     val: allCheckedIn.length, color: '#1a56e8' },
                { label: 'On Time',        val: onTime,              color: '#10b981' },
                { label: 'Late',           val: late,                color: '#f59e0b' },
                { label: 'Half Day',       val: halfDay,             color: '#f97316' },
              ].map(s => (
                <div key={s.label} style={{ background: 'white', padding: '10px 6px', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div className="text-20-bold" style={{ color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {loadingCheckins ? <PageLoader /> : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Employee</th>
                        <th>Role / Dept</th>
                        <th>Check-in Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Checked-in employees */}
                      {checkedIn.map((emp, idx) => {
                        const rec = checkinByEmpId[emp._id];
                        const st  = getCheckinStatus(rec?.checkIn?.time);
                        const checkInTime = rec?.checkIn?.time ? new Date(rec.checkIn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                        return (
                          <tr key={emp._id} style={{ background: st ? st.bg + '55' : undefined }}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar src={emp.photo} name={emp.name} size={30} />
                                <div>
                                  <div className="text-14-medium">{emp.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.employeeId}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                              {emp.role}{emp.department ? ` · ${emp.department}` : ''}
                            </td>
                            <td style={{ fontSize: 13, fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                {checkInTime}
                              </div>
                              {st?.late && (
                                <div style={{ fontSize: 11, color: st.color, marginTop: 2 }}>{st.late} late</div>
                              )}
                            </td>
                            <td>
                              {st && (
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, background: st.bg, color: st.color, fontSize: 12, fontWeight: 600, border: `1px solid ${st.color}33` }}>
                                  {st.label}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Not checked-in employees */}
                      {notCheckedIn.map((emp, idx) => (
                        <tr key={emp._id} style={{ opacity: 0.55 }}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{checkedIn.length + idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar src={emp.photo} name={emp.name} size={30} />
                              <div>
                                <div className="text-14-medium">{emp.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{emp.role}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</td>
                          <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not checked in</span></td>
                        </tr>
                      ))}

                      {checkedIn.length === 0 && notCheckedIn.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                          {q ? 'No staff match your search' : 'No employees found'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Timing rules modal */}
            <Modal open={showTimingForm} onClose={() => setShowTimingForm(false)} title="Attendance Timing Rules"
              footer={<>
                <button className="btn btn-secondary" onClick={() => setShowTimingForm(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveTimingConfig} disabled={savingTiming}>
                  {savingTiming ? 'Saving...' : <><Save size={14} /> Save Rules</>}
                </button>
              </>}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
                Set the check-in time thresholds used to mark staff as present, late or half-day.
              </p>

              {/* Active / Inactive toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: '#f8fafc', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Staff Check-in</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {timingForm.enabled ? 'Teachers can check in/out from their app.' : 'Check-in is hidden in the teacher app.'}
                  </div>
                </div>
                <button type="button" onClick={() => setTimingForm(f => ({ ...f, enabled: !f.enabled }))}
                  style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: timingForm.enabled ? 'var(--primary)' : '#cbd5e1', position: 'relative', transition: 'background 0.2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: timingForm.enabled ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, opacity: timingForm.enabled ? 1 : 0.5, pointerEvents: timingForm.enabled ? 'auto' : 'none' }}>
                {[
                  { key: 'onTimeBy',      label: 'On time by (Present)' },
                  { key: 'lateFrom',      label: 'Late starts from' },
                  { key: 'halfDayFrom',   label: 'Half day starts from' },
                  { key: 'schoolEndTime', label: 'School ends (auto check-out)' },
                ].map(({ key, label }) => (
                  <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>{label}</label>
                    <AmPmTimePicker
                      value={timingForm[key] || '10:00'}
                      onChange={val => setTimingForm(f => ({ ...f, [key]: val }))}
                    />
                  </div>
                ))}
              </div>
            </Modal>
          </div>
        );
      })()}

      {/* ── Leave Requests tab ──────────────────────────────────────────────── */}
      {tab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scope toggle + search + status filter */}
          <div className="filter-bar" style={{ margin: 0 }}>
            <AntSelect
              style={{ width: 150 }}
              value={leaveScope}
              onChange={val => setLeaveScope(val)}
              options={[
                { value: 'student', label: 'Students' },
                { value: 'staff',   label: 'Staff' },
              ]}
            />
            <SearchInput value={search} onChange={setSearch}
              placeholder={leaveScope === 'staff' ? 'Search by employee or reason...' : 'Search by student or reason...'} />
            <AntSelect
              style={{ width: 170 }}
              value={leaveFilter}
              onChange={val => setLeaveFilter(val)}
              options={[
                { value: 'all',      label: 'All Status' },
                { value: 'pending',  label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>

          {loadingLeaveList ? <PageLoader /> : displayLeaves.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><CheckCircle size={28} /></div>
                <p>{leaveQuery ? 'No leave requests match your search' : `No ${leaveFilter === 'all' ? '' : leaveFilter} leave requests`}</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{leaveScope === 'staff' ? 'Employee' : 'Student'}</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLeaves.map((lv, idx) => {
                      const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' }[lv.status];
                      const statusBg    = { pending: '#fffbeb', approved: '#f0fdf4', rejected: '#fef2f2' }[lv.status];
                      return (
                        <tr key={lv._id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                          <td>
                            {leaveScope === 'staff' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar name={lv.employee?.name} size={30} />
                                <div>
                                  <div className="text-14-medium">{lv.employee?.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lv.employee?.employeeId}</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar name={lv.student?.name} size={30} />
                                <div>
                                  <div className="text-14-medium">{lv.student?.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {lv.student?.admissionNumber}
                                    {lv.parent?.name ? ` · by ${lv.parent.name}` : ''}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                              {leaveScope === 'staff' ? lv.leaveType : 'Leave'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13 }}>{format(new Date(lv.fromDate), 'dd MMM yyyy')}</td>
                          <td style={{ fontSize: 13 }}>{format(new Date(lv.toDate), 'dd MMM yyyy')}</td>
                          <td style={{ fontSize: 13, fontWeight: 600 }}>{lv.days}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200 }}>{lv.reason}</td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                              background: statusBg, color: statusColor,
                              fontSize: 12, fontWeight: 600, border: `1px solid ${statusColor}33`,
                              textTransform: 'capitalize',
                            }}>{lv.status}</span>
                            {lv.adminNote && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lv.adminNote}</div>
                            )}
                          </td>
                          <td>
                          {(lv.status === 'pending' || editingLeaves.has(lv._id)) ? (
                              <div style={{ display: 'flex', gap: 6, minWidth: 170 }}>
                                <button
                                  onClick={() => { activeLeaveAction.mutate({ id: lv._id, status: 'approved' }); setEditingLeaves(s => { const n = new Set(s); n.delete(lv._id); return n; }); }}
                                  disabled={activeLeaveAction.isPending}
                                  style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600,
                                  }}
                                ><CheckCircle size={13} /> Approve</button>
                                <button
                                  onClick={() => { activeLeaveAction.mutate({ id: lv._id, status: 'rejected' }); setEditingLeaves(s => { const n = new Set(s); n.delete(lv._id); return n; }); }}
                                  disabled={activeLeaveAction.isPending}
                                  style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600,
                                  }}
                                ><XCircle size={13} /> Reject</button>
                              </div>
                          ) : (
                            <button
                              onClick={() => setEditingLeaves(s => new Set(s).add(lv._id))}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                                background: 'transparent', color: 'var(--primary)',
                                border: '1px solid var(--border)', fontSize: 12, fontWeight: 600,
                              }}
                            ><Edit2 size={13} /> Edit</button>
                          )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table — student / employee tabs */}
      {tab !== 'checkin' && tab !== 'leaves' && (tab === 'student' && !classId ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><UserCheck size={28} /></div>
            <p>Select a class to mark attendance</p>
          </div>
        </div>
      ) : isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>{tab === 'student' ? 'Roll No' : 'Employee ID'}</th>
                  {tab === 'student' && <th>Class &amp; Sec</th>}
                  {tab === 'employee' && <th>Designation</th>}
                  <th>Status</th>
                  {editMode && <th>Mark</th>}
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {people.length === 0 && (
                  <tr>
                    <td colSpan={5 + (editMode ? 1 : 0) + (tab === 'employee' || tab === 'student' ? 1 : 0)} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      No records found
                    </td>
                  </tr>
                )}
                {people.map((person, idx) => {
                  const current = attendance[person._id];
                  const sc = statusConfig.find(s => s.key === current?.status);
                  return (
                    <tr key={person._id} style={{ background: sc ? sc.bg + '66' : undefined }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar src={person.photo} name={person.name} size={30} />
                          <span className="text-14-medium">{person.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {tab === 'student' ? (person.rollNumber || '—') : person.employeeId}
                      </td>
                      {tab === 'student' && (
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {person.currentClass
                            ? `${person.currentClass.name}${person.currentClass.section ? ` ${person.currentClass.section}` : ''}`
                            : '—'}
                        </td>
                      )}
                      {tab === 'employee' && (
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {person.role || '—'}{person.department ? ` · ${person.department}` : ''}
                        </td>
                      )}
                      <td>
                        {sc ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                            background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600,
                            border: `1px solid ${sc.color}33`
                          }}>{sc.fullLabel}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not marked</span>
                        )}
                      </td>
                      {editMode && (
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {statusConfig.map(s => {
                              const isTracked = s.key === 'cl' || s.key === 'sl';
                              const remaining = isTracked ? getRemaining(person._id, s.key) : null;
                              const isSelected = current?.status === s.key;
                              const limit = s.key === 'cl' ? clLimit : s.key === 'sl' ? slLimit : null;
                              // Disable only if balance exhausted AND not already selected today
                              const isDisabled = isTracked && remaining === 0 && !isSelected;
                              return (
                                <button key={s.key}
                                  onClick={() => !isDisabled && setStatus(person._id, s.key)}
                                  disabled={isDisabled}
                                  style={{
                                    minWidth: 32, width: isTracked ? 'auto' : 32,
                                    height: isTracked ? 42 : 32,
                                    padding: isTracked ? '2px 8px' : 0,
                                    border: `2px solid ${isSelected ? s.color : isDisabled ? '#e2e8f0' : 'var(--border)'}`,
                                    borderRadius: 8,
                                    background: isSelected ? s.bg : isDisabled ? '#f8fafc' : 'white',
                                    color: isSelected ? s.color : isDisabled ? '#cbd5e1' : 'var(--text-muted)',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.15s',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 1,
                                    fontWeight: 700, fontSize: 11,
                                  }}
                                >
                                  <span>{s.label}</span>
                                  {isTracked && (
                                    <span style={{
                                      fontSize: 9, lineHeight: 1, fontWeight: 600,
                                      color: isSelected ? s.color : isDisabled ? '#cbd5e1' : 'var(--text-muted)'
                                    }}>
                                      {remaining}/{limit}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      )}
                      <td>
                        {editMode ? (
                          <input type="text" className="form-control"
                            style={{ fontSize: 13, padding: '4px 8px', minWidth: 160 }}
                            placeholder="Remarks (optional)"
                            value={current?.remarks || ''}
                            onChange={e => setRemarks(person._id, e.target.value)} />
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {current?.remarks || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

    </div>
  );
}
