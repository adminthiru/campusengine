import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { GraduationCap, Users, CreditCard, TrendingUp, UserCheck, AlertCircle, Clock, Banknote } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import { StatCard, Skeleton } from '../../components/ui';
import { format } from 'date-fns';

// Loading skeleton that mirrors the dashboard's widgets (stat cards + charts + list).
function DashboardSkeleton() {
  return (
    <div style={{ padding: 4 }}>
      <div style={{ marginBottom: 24 }}><Skeleton width={200} height={24} /><Skeleton width={150} height={13} style={{ marginTop: 10 }} /></div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <Skeleton width={36} height={36} radius={10} />
            <Skeleton width={70} height={26} style={{ marginTop: 14 }} />
            <Skeleton width={100} height={12} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <Skeleton width={140} height={16} />
            <Skeleton width="100%" height={200} radius={10} style={{ marginTop: 16 }} />
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <Skeleton width={160} height={16} />
            <Skeleton width="100%" height={200} radius={10} style={{ marginTop: 16 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 18 }}>
        <Skeleton width={180} height={16} style={{ marginBottom: 16 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0' }}>
            <Skeleton width={36} height={36} radius={18} />
            <Skeleton width={160} height={14} /><Skeleton width={100} height={14} /><Skeleton width={80} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = ['#1a56e8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'];
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/school/dashboard'),
    refetchInterval: 60000
  });

  if (isLoading) return <DashboardSkeleton />;
  const s = data?.stats;

  const revenueChart = s?.charts?.revenue?.map(r => ({
    name: months[(r._id.month || 1) - 1],
    Revenue: r.revenue
  })) || [];

  const expenseChart = s?.charts?.expenses?.map(e => ({
    name: months[(e._id.month || 1) - 1],
    Expenses: e.amount
  })) || [];

  // Merge revenue and expense
  const financeChart = revenueChart.map((r, i) => ({
    name: r.name,
    Revenue: r.Revenue,
    Expenses: expenseChart[i]?.Expenses || 0
  }));

  const feesByClass = s?.charts?.feesByClass || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {format(new Date(), 'EEEE, dd MMMM yyyy')} · {user?.school?.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-info">Academic Year: {user?.school?.academicYear?.current || '—'}</span>
          {user?.subscription?.status === 'trial' && (
            <span className="badge badge-warning">Trial Active</span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total Students" value={s?.students?.total || 0}
          sub={`${s?.students?.present || 0} present today`}
          icon={GraduationCap} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Total Staff" value={s?.employees?.total || 0}
          sub={`${s?.employees?.present || 0} present today`}
          icon={Users} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Monthly Revenue" value={`₹${((s?.finance?.monthlyRevenue || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}` }
          sub="Fee collections this month"
          icon={TrendingUp} color="#f59e0b" bg="#fffbeb" />
        <StatCard title="Pending Fees" value={`₹${((s?.finance?.pendingFees || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
          sub={`${s?.finance?.pendingFeesCount || 0} students`}
          icon={AlertCircle} color="#ef4444" bg="#fef2f2" />
      </div>

      {/* Attendance + Finance row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Today's Attendance */}
        <div className="card">
          <h3 className="text-16-bold" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={18} color="var(--primary)" /> Today's Attendance
          </h3>
          <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Students Present', val: s?.students?.present || 0, total: s?.students?.total || 0, color: '#10b981' },
              { label: 'Students Absent', val: s?.students?.absent || 0, total: s?.students?.total || 0, color: '#ef4444' },
              { label: 'Staff Present', val: s?.employees?.present || 0, total: s?.employees?.total || 0, color: '#1a56e8' },
              { label: 'Staff Absent', val: s?.employees?.absent || 0, total: s?.employees?.total || 0, color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                <div className="text-24-bold" style={{ color: item.color }}>{item.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
                {item.total > 0 && (
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 8 }}>
                    <div style={{ height: '100%', background: item.color, borderRadius: 2, width: `${Math.min(100, Math.round((item.val / item.total) * 100))}%`, transition: 'width 0.5s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Finance Summary */}
        <div className="card">
          <h3 className="text-16-bold" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Banknote size={18} color="var(--primary)" /> This Month's Finance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Revenue', val: s?.finance?.monthlyRevenue || 0, color: '#10b981' },
              { label: 'Expenses', val: s?.finance?.monthlyExpenses || 0, color: '#ef4444' },
              { label: 'Net Profit', val: s?.finance?.monthlyProfit || 0, color: s?.finance?.monthlyProfit >= 0 ? '#10b981' : '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span className="text-16-bold" style={{ color: item.color }}>
                  ₹{(item.val / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue vs Expense Chart */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 className="text-16-bold" style={{ marginBottom: 16 }}>Revenue vs Expenses (6 months)</h3>
          {financeChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={financeChart} barGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/100).toLocaleString('en-IN')}`} />
                <Tooltip formatter={(v) => `₹${(v/100).toLocaleString('en-IN')}`} />
                <Bar dataKey="Revenue" fill="#1a56e8" radius={[4,4,0,0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
        </div>

        {/* Fees by class */}
        <div className="card">
          <h3 className="text-16-bold" style={{ marginBottom: 16 }}>Fees by Class</h3>
          {feesByClass.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={feesByClass}>
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/100).toLocaleString('en-IN')}`} />
                <Tooltip formatter={(v) => `₹${(v/100).toLocaleString('en-IN')}`} />
                <Bar dataKey="collected" fill="#10b981" name="Collected" radius={[4,4,0,0]} />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
        </div>
      </div>

      {/* Recent students */}
      <div className="card">
        <h3 className="text-16-bold" style={{ marginBottom: 16 }}>Recent Admissions</h3>
        {s?.recentStudents?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission No</th>
                  <th>Class</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {s.recentStudents.map(stu => (
                  <tr key={stu._id}>
                    <td style={{ fontWeight: 500 }}>{stu.name}</td>
                    <td><span className="badge badge-info">{stu.admissionNumber}</span></td>
                    <td>{stu.currentClass ? `${stu.currentClass.name} ${stu.currentClass.section}` : '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{format(new Date(stu.createdAt), 'dd MMM yyyy')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>
            No students added yet. <a href="/students" style={{ color: 'var(--primary)' }}>Add your first student →</a>
          </div>
        )}
      </div>
    </div>
  );
}
