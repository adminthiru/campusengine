import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { UserCheck, Save, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageLoader, Avatar, SearchInput } from '../../components/ui';

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

export default function Attendance() {
  const qc = useQueryClient();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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

  const { data: studentData, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-attendance', classId],
    enabled: tab === 'student' && !!classId,
    queryFn: () => api.get(`/students?classId=${classId}&limit=100&status=active`)
  });
  const students = studentData?.students || [];

  const { data: empData, isLoading: loadingEmps } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/employees?limit=200&status=active'),
    enabled: tab === 'employee'
  });
  const allEmployees = empData?.employees || [];

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
  const usedLeave = leaveBalData?.used || {};

  // Monthly limits from school settings
  const clLimit = school?.leaveTypes?.find(lt => lt.code === 'cl')?.daysPerMonth ?? 1;
  const slLimit = school?.leaveTypes?.find(lt => lt.code === 'sl')?.daysPerMonth ?? 1;

  const getRemaining = (empId, code) => {
    const limit = code === 'cl' ? clLimit : code === 'sl' ? slLimit : null;
    if (limit === null) return null;
    return Math.max(0, limit - (usedLeave[empId]?.[code] || 0));
  };

  const { data: existingData } = useQuery({
    queryKey: ['attendance-existing', date, classId, tab],
    enabled: tab === 'student' ? !!classId : true,
    queryFn: () => api.get(`/attendance?type=${tab}&classId=${classId}&date=${date}`)
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
      const records = people.map(p => ({
        [tab === 'student' ? 'student' : 'employee']: p._id,
        status: attendance[p._id]?.status || 'present',
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1); setDate(format(d, 'yyyy-MM-dd'));
          }}><ChevronLeft size={16} /></button>
          <input type="date" className="form-control" style={{ width: 'auto' }} value={date}
            onChange={e => setDate(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1); setDate(format(d, 'yyyy-MM-dd'));
          }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        <div style={{ display: 'flex', overflowX: 'auto', marginBottom: -2 }}>
          {['student', 'employee'].map(t => (
            <button key={t}
              onClick={() => { setTab(t); setSearch(''); if (t === 'employee') setClassId(''); if (t === 'student') setEmpRole(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${tab === t ? 'var(--primary)' : 'transparent'}`,
                transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                textTransform: 'capitalize'
              }}>
              {t} Attendance
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div style={{ minWidth: 240 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tab === 'student' ? 'Search by name or admission no...' : 'Search by name or employee ID...'}
          />
        </div>
        {tab === 'student' && (
          <select className="form-control" style={{ width: 'auto' }} value={classId}
            onChange={e => { setClassId(e.target.value); setSearch(''); }}>
            <option value="">Select Class</option>
            {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
          </select>
        )}
        {tab === 'employee' && empRoles.length > 0 && (
          <select className="form-control" style={{ width: 'auto' }} value={empRole}
            onChange={e => setEmpRole(e.target.value)}>
            <option value="">All Roles</option>
            {empRoles.map(r => (
              <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>
            ))}
          </select>
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
      </div>

      {/* Working days info bar */}
      {workingDaysInfo?.workingDays != null && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 16px', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
            📅 {new Date(date).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <span style={{ fontSize: 13, color: '#1e293b' }}>
            <b style={{ color: '#1d4ed8' }}>{workingDaysInfo.workingDays}</b> working days
          </span>
          {workingDaysInfo.holidayCount > 0 && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              🎌 {workingDaysInfo.holidayCount} holiday{workingDaysInfo.holidayCount !== 1 ? 's' : ''}
            </span>
          )}
          {workingDaysInfo.weekendCount > 0 && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              🗓 {workingDaysInfo.weekendCount} weekend day{workingDaysInfo.weekendCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Stats cards — full width equal columns */}
      {people.length > 0 && (
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

      {/* Table */}
      {tab === 'student' && !classId ? (
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
                  <th>{tab === 'student' ? 'Admission No' : 'Employee ID'}</th>
                  <th>Status</th>
                  {editMode && <th>Mark</th>}
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {people.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
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
                        {tab === 'student' ? person.admissionNumber : person.employeeId}
                      </td>
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
      )}

    </div>
  );
}
