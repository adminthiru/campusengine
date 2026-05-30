// Teacher portal - My Classes & attendance
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../store/AuthContext';
import api from '../../utils/api';
import { PageLoader, StatusBadge, StatCard } from '../../components/ui';
import { BookOpen, Users } from 'lucide-react';
export { ParentDashboard } from './ParentPortal';

export function TeacherDashboard() {
  const { user } = useAuth();
  const { data: subjectData } = useQuery({
    queryKey: ['teacher-subjects'],
    queryFn: () => api.get('/subjects')
  });
  const subjects = (subjectData?.subjects || []).filter(s => s.teacher?._id === user?.employeeId?.toString() || s.teacher === user?.employeeId?.toString());

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.name?.split(' ')[0]}!</h1>
          <p className="page-subtitle">Teacher Dashboard</p>
        </div>
      </div>
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard title="My Subjects" value={subjects.length} icon={BookOpen} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="My Classes" value={subjects.length} icon={Users} color="#10b981" bg="#f0fdf4" />
      </div>
      <div className="card">
        <h3 className="text-16-bold" style={{ marginBottom: 16 }}>My Subjects</h3>
        <div className="grid-3">
          {subjects.map((sub, i) => (
            <div key={sub._id} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, borderLeft: `4px solid ${sub.color || '#1a56e8'}` }}>
              <div className="text-14-bold">{sub.name}</div>
              <div className="text-12-regular" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                {sub.classes?.map(c => `${c.name} ${c.section}`).join(', ')}
              </div>
            </div>
          ))}
          {subjects.length === 0 && <p className="text-14-regular" style={{ color: 'var(--text-muted)' }}>No subjects assigned yet.</p>}
        </div>
      </div>
    </div>
  );
}

export function MySalary() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['my-salary'],
    queryFn: () => api.get(`/salaries?employeeId=${user?.employeeId}`)
  });
  const salaries = data?.salaries || [];

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">My Salary</h1></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead><tr><th>Month</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead>
            <tbody>
              {salaries.map(sal => {
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return (
                  <tr key={sal._id}>
                    <td>{months[sal.month - 1]} {sal.year}</td>
                    <td>₹{sal.grossSalary?.toLocaleString('en-IN')}</td>
                    <td className="text-14-regular" style={{ color: '#ef4444' }}>₹{sal.totalDeductions?.toLocaleString('en-IN')}</td>
                    <td className="text-14-bold" style={{ color: '#10b981' }}>₹{sal.netSalary?.toLocaleString('en-IN')}</td>
                    <td><StatusBadge status={sal.status} /></td>
                  </tr>
                );
              })}
              {salaries.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No salary records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Maintenance tasks view
export function MyTasks() {
  const { user } = useAuth();
  const [updating, setUpdating] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => user?.employeeId ? api.get(`/employees/${user.employeeId}`) : Promise.resolve(null)
  });
  const employee = data?.employee;
  const tasks = employee?.tasks || [];

  const updateTask = async (taskId, status) => {
    setUpdating(taskId);
    try {
      await api.put(`/employees/${user.employeeId}/tasks/${taskId}`, { status });
      refetch();
    } catch { }
    setUpdating(null);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">My Tasks</h1></div>
      <div className="grid-2">
        {tasks.map(task => (
          <div key={task._id} className="card" style={{ borderLeft: `4px solid ${task.status === 'completed' ? '#10b981' : task.status === 'in_progress' ? '#f59e0b' : '#1a56e8'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="text-14-bold">{task.title}</div>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-14-regular" style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{task.description}</p>
            {task.status !== 'completed' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {task.status === 'pending' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => updateTask(task._id, 'in_progress')} disabled={updating === task._id}>
                    Start Task
                  </button>
                )}
                {task.status === 'in_progress' && (
                  <button className="btn btn-success btn-sm" onClick={() => updateTask(task._id, 'completed')} disabled={updating === task._id}>
                    Mark Complete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="card"><p className="text-14-regular" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>No tasks assigned yet.</p></div>
        )}
      </div>
    </div>
  );
}

export { StudentDashboard } from './StudentPortal';

