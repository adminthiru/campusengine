import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { PageLoader, EmptyState, Badge } from '../components/ui';
import { CreditCard } from 'lucide-react';

export default function Payments() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['sa-payments', status, page],
    queryFn: () => api.get(`/super-admin/payments?status=${status}&page=${page}&limit=30`),
  });
  const payments = data?.payments || [];
  const pages = data?.pages || 1;
  const total = data?.total || 0;
  const revenue = payments.reduce((s, p) => s + (p.status === 'paid' ? p.amount : 0), 0);

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="page-title">Payments</h1>
        <select className="form-control" style={{ width: 'auto' }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option>
        </select>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{total} payment{total === 1 ? '' : 's'} · ₹{revenue.toLocaleString('en-IN')} on this page</div>

      {payments.length === 0 ? <EmptyState icon={CreditCard} message="No payments found." /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%' }}>
            <thead><tr><th>Invoice</th><th>School</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id}>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{p.invoiceNumber}</td>
                  <td style={{ fontSize: 13 }}><Link to={`/tenants/${p.school?._id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{p.school?.name || '—'}</Link></td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.planName || '—'}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>₹{p.amount}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(p.method || '').replace('_', ' ')}</td>
                  <td><Badge status={p.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: 12 }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                <button key={n} className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(n)}>{n}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
