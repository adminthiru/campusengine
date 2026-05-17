import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { UserCheck, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageLoader, StatusBadge, Avatar } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [period, setPeriod] = useState(1);
  const [tab, setTab] = useState('student'); // student | employee
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data: subjectData } = useQuery({
    queryKey: ['subjects', classId], enabled: !!classId,
    queryFn: () => api.get(`/subjects?classId=${classId}`)
  });
  const subjects = subjectData?.subjects || [];

  const { data: studentData, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-attendance', classId],
    enabled: !!classId,
    queryFn: () => api.get(`/students?classId=${classId}&limit=100&status=active`)
  });
  const students = studentData?.students || [];

  const { data: empData, isLoading: loadingEmps } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/employees?limit=200&status=active'),
    enabled: tab === 'employee'
  });
  const employees = empData?.employees || [];

  // Load existing attendance
  useQuery({
    queryKey: ['attendance-existing', date, classId, period, tab],
    enabled: tab === 'student' ? !!classId : true,
    queryFn: () => api.get(`/attendance?type=${tab}&classId=${classId}&date=${date}`),
    onSuccess: (data) => {
      const existing = data.attendance?.[0];
      if (existing) {
        const map = {};
        existing.records.forEach(r => {
          const id = r.student?._id || r.employee?._id || r.student || r.employee;
          if (id) map[id] = r.status;
        });
        setAttendance(map);
      }
    }
  });

  const toggleAll = (status) => {
    const people = tab === 'student' ? students : employees;
    const map = {};
    people.forEach(p => { map[p._id] = status; });
    setAttendance(map);
  };

  const setStatus = (id, status) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  const saveAttendance = async () => {
    const people = tab === 'student' ? students : employees;
    if (people.length === 0) return toast.error('No students/employees to mark');
    setSaving(true);
    try {
      const records = people.map(p => ({
        [tab === 'student' ? 'student' : 'employee']: p._id,
        status: attendance[p._id] || 'present'
      }));
      if (tab === 'student') {
        await api.post('/attendance/student', { classId, date, period, subjectId: subjectId || undefined, records });
      } else {
        await api.post('/attendance/employee', { date, records });
      }
      toast.success('Attendance saved!');
      qc.invalidateQueries(['attendance-existing']);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const statusConfig = [
    { key: 'present', label: 'P', color: '#10b981', bg: '#f0fdf4' },
    { key: 'absent', label: 'A', color: '#ef4444', bg: '#fef2f2' },
    { key: 'late', label: 'L', color: '#f59e0b', bg: '#fffbeb' },
    { key: 'excused', label: 'E', color: '#6366f1', bg: '#eef2ff' },
  ];

  const people = tab === 'student' ? students : employees;
  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Mark daily attendance</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1); setDate(format(d, 'yyyy-MM-dd'));
          }}><ChevronLeft size={16} /></button>
          <input type="date" className="form-control" style={{ width: 'auto' }} value={date} onChange={e => setDate(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1); setDate(format(d, 'yyyy-MM-dd'));
          }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Tab */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {['student', 'employee'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setAttendance({}); }}
            style={{ textTransform: 'capitalize' }}>{t} Attendance</button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {tab === 'student' && (
          <>
            <select className="form-control" style={{ width: 'auto' }} value={classId} onChange={e => { setClassId(e.target.value); setAttendance({}); }}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
            </select>
            <select className="form-control" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(Number(e.target.value))}>
              {Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>Period {i + 1}</option>)}
            </select>
            <select className="form-control" style={{ width: 'auto' }} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </>
        )}

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-success btn-sm" onClick={() => toggleAll('present')}>All Present</button>
          <button className="btn btn-danger btn-sm" onClick={() => toggleAll('absent')}>All Absent</button>
        </div>
      </div>

      {/* Stats */}
      {people.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total', val: people.length, color: 'var(--text-primary)' },
            { label: 'Present', val: presentCount, color: '#10b981' },
            { label: 'Absent', val: absentCount, color: '#ef4444' },
            { label: 'Not Marked', val: people.length - Object.keys(attendance).length, color: 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
              <div className="text-20-bold" style={{ color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance table */}
      {(tab === 'student' && !classId) ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><UserCheck size={28} /></div>
            <p>Select a class to mark attendance</p>
          </div>
        </div>
      ) : (loadingStudents && tab === 'student') || (loadingEmps && tab === 'employee') ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  {tab === 'student' && <th>Admission No</th>}
                  {tab === 'employee' && <th>Employee ID</th>}
                  <th>Status</th>
                  <th>Mark</th>
                </tr>
              </thead>
              <tbody>
                {people.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No records found</td></tr>
                )}
                {people.map((person, idx) => {
                  const current = attendance[person._id];
                  return (
                    <tr key={person._id} style={{ background: current === 'absent' ? '#fff5f5' : current === 'late' ? '#fffdf5' : undefined }}>
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
                        {current ? <StatusBadge status={current} /> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not marked</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {statusConfig.map(s => (
                            <button
                              key={s.key}
                              onClick={() => setStatus(person._id, s.key)}
                              className="text-12-bold"
                              style={{
                                width: 32, height: 32, border: `2px solid ${current === s.key ? s.color : 'var(--border)'}`,
                                borderRadius: 8, background: current === s.key ? s.bg : 'white',
                                color: current === s.key ? s.color : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.15s'
                              }}
                            >{s.label}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save button */}
      {people.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary btn-lg" onClick={saveAttendance} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 18, height: 18 }} />Saving...</> : <><Save size={16} /> Save Attendance</>}
          </button>
        </div>
      )}
    </div>
  );
}
