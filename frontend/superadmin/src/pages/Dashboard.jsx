import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { PageLoader, StatCard } from '../components/ui';
import { Building2, CheckCircle, Clock, XCircle, Ban, IndianRupee, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['sa-stats'], queryFn: () => api.get('/super-admin/stats') });
  const s = data?.stats;
  if (isLoading || !s) return <PageLoader />;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Schools" value={s.total} icon={Building2} />
        <StatCard label="Active" value={s.active} icon={CheckCircle} color="#16a34a" />
        <StatCard label="On Trial" value={s.trial} icon={Clock} color="#d97706" />
        <StatCard label="Expired" value={s.expired} icon={XCircle} color="#dc2626" />
        <StatCard label="Suspended" value={s.suspended} icon={Ban} color="#64748b" />
        <StatCard label="MRR" value={`₹${(s.mrr || 0).toLocaleString('en-IN')}`} icon={TrendingUp} color="#1a56e8" />
        <StatCard label="Total Revenue" value={`₹${(s.totalRevenue || 0).toLocaleString('en-IN')}`} icon={IndianRupee} color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        {/* Signups chart */}
        <div className="card" style={{ padding: 18 }}>
          <h3 className="text-14-semibold" style={{ marginBottom: 14 }}>New Schools (last 6 months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.signups || []}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a56e8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent payments */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}><span className="text-14-semibold">Recent Payments</span></div>
          {(s.recentPayments || []).length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>No payments yet.</div>
          ) : (
            <table style={{ width: '100%' }}>
              <tbody>
                {s.recentPayments.map(p => (
                  <tr key={p._id}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}><Link to={`/tenants/${p.school?._id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{p.school?.name || '—'}</Link></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.planName || ''}</td>
                    <td style={{ fontSize: 13, textAlign: 'right', fontWeight: 600 }}>₹{p.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
