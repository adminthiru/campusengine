import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { StatCard, PageLoader, StatusBadge } from '../../components/ui';

export function SuperAdminDashboard() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: () => api.get('/super-admin/stats')
  });
  const stats = data?.stats;

  const { data: schoolsData, isLoading: loadingSchools } = useQuery({
    queryKey: ['all-schools'],
    queryFn: () => api.get('/super-admin/schools')
  });
  const schools = schoolsData?.schools || [];

  const extendTrial = async (school) => {
    try {
      const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await api.put(`/super-admin/schools/${school._id}/subscription`, { status: 'trial', trialEndDate });
      qc.invalidateQueries(['all-schools', 'super-admin-stats']);
      toast.success('Trial extended by 30 days');
    } catch { toast.error('Failed'); }
  };

  const activate = async (school) => {
    try {
      const start = new Date();
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      await api.put(`/super-admin/schools/${school._id}/subscription`, { status: 'active', currentPeriodStart: start, currentPeriodEnd: end });
      qc.invalidateQueries(['all-schools', 'super-admin-stats']);
      toast.success('Subscription activated');
    } catch { toast.error('Failed'); }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Super Admin Dashboard</h1><p className="page-subtitle">Manage all schools</p></div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total Schools" value={stats?.totalSchools || 0} icon={Building2} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Active Trials" value={stats?.activeTrials || 0} icon={Clock} color="#f59e0b" bg="#fffbeb" />
        <StatCard title="Subscribed" value={stats?.activeSubscriptions || 0} icon={CheckCircle} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Expired" value={stats?.expiredSchools || 0} icon={XCircle} color="#ef4444" bg="#fef2f2" />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="text-14-bold" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>All Schools ({schools.length})</div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>School</th><th>Code</th><th>Contact</th><th>Subscription</th><th>Trial / Expiry</th><th>Registered</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loadingSchools && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>}
              {schools.map(school => (
                <tr key={school._id}>
                  <td>
                    <div className="text-14-semibold">{school.name}</div>
                    <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{school.address?.city}</div>
                  </td>
                  <td><span className="badge badge-info">{school.code}</span></td>
                  <td>
                    <div className="text-14-regular">{school.phone}</div>
                    <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{school.email}</div>
                  </td>
                  <td><StatusBadge status={school.subscription?.status} /></td>
                  <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>
                    {school.subscription?.status === 'trial' && school.subscription?.trialEndDate
                      ? format(new Date(school.subscription.trialEndDate), 'dd MMM yyyy')
                      : school.subscription?.currentPeriodEnd
                      ? format(new Date(school.subscription.currentPeriodEnd), 'dd MMM yyyy')
                      : '—'}
                  </td>
                  <td className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>
                    {format(new Date(school.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm text-12-regular" onClick={() => extendTrial(school)} style={{ padding: '4px 8px' }}>+30 days</button>
                      <button className="btn btn-success btn-sm text-12-regular" onClick={() => activate(school)} style={{ padding: '4px 8px' }}>Activate</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loadingSchools && schools.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No schools registered yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
