import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapPin, LogIn, LogOut, Clock, Users, ExternalLink } from 'lucide-react';
import api from '../../utils/api';
import { PageLoader, EmptyState, StatCard, Avatar, DateInput } from '../../components/ui';

const fmtTime = (t) => (t ? format(new Date(t), 'hh:mm a') : '—');

const workedDuration = (rec) => {
  const inT = rec?.checkIn?.time;
  const outT = rec?.checkOut?.time;
  if (!inT) return '—';
  const end = outT ? new Date(outT) : new Date();
  const mins = Math.max(0, Math.round((end - new Date(inT)) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

function LocationCell({ punch }) {
  if (!punch || punch.lat == null || punch.lng == null) {
    return <span className="text-12-regular" style={{ color: 'var(--text-muted)' }}>No location</span>;
  }
  const coords = `${punch.lat.toFixed(5)}, ${punch.lng.toFixed(5)}`;
  const mapUrl = `https://www.google.com/maps?q=${punch.lat},${punch.lng}`;
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-12-regular"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontWeight: 600 }}
      title={punch.accuracy ? `Accuracy ±${Math.round(punch.accuracy)}m` : 'View on map'}
    >
      <MapPin size={13} />
      {coords}
      <ExternalLink size={12} />
    </a>
  );
}

function StatusPill({ rec }) {
  const inT = rec?.checkIn?.time;
  const outT = rec?.checkOut?.time;
  let label = 'Absent', color = '#6b7280', bg = '#f3f4f6';
  if (inT && !outT) { label = 'Working'; color = '#10b981'; bg = '#f0fdf4'; }
  else if (inT && outT) { label = 'Checked out'; color = '#1a56e8'; bg = '#eff6ff'; }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export default function StaffTracking() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['staff-tracking', date],
    queryFn: () => api.get(`/staff-attendance?date=${date}`),
  });

  const records = data?.records || [];
  const checkedIn = records.filter(r => r.checkIn?.time).length;
  const working = records.filter(r => r.checkIn?.time && !r.checkOut?.time).length;
  const checkedOut = records.filter(r => r.checkIn?.time && r.checkOut?.time).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Tracking</h1>
          <p className="page-subtitle">Teacher & staff check-in / check-out — login time and location</p>
        </div>
        <div style={{ width: 200 }}>
          <DateInput value={date} onChange={(d) => setDate(d || format(new Date(), 'yyyy-MM-dd'))} maxDate={new Date()} />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <StatCard title="Checked in" value={checkedIn} sub={format(new Date(date), 'dd MMM yyyy')} icon={Users} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Currently working" value={working} sub="No check-out yet" icon={Clock} color="#f59e0b" bg="#fffbeb" />
        <StatCard title="Checked out" value={checkedOut} sub="Completed the day" icon={LogOut} color="#1a56e8" bg="#eff6ff" />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : records.length === 0 ? (
        <EmptyState icon={MapPin} message="No staff check-ins recorded for this date." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
              <tr>
                <th>Staff</th>
                <th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><LogIn size={13} /> Check In</span></th>
                <th>Check-in Location</th>
                <th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><LogOut size={13} /> Check Out</span></th>
                <th>Check-out Location</th>
                <th>Worked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const emp = rec.employee || {};
                return (
                  <tr key={rec._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={emp.photo} name={emp.name} size={36} />
                        <div>
                          <div className="text-14-semibold">{emp.name || 'Unknown'}</div>
                          <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>
                            {emp.employeeId}{emp.designation ? ` · ${emp.designation}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-14-regular" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(rec.checkIn?.time)}</td>
                    <td><LocationCell punch={rec.checkIn} /></td>
                    <td className="text-14-regular" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(rec.checkOut?.time)}</td>
                    <td><LocationCell punch={rec.checkOut} /></td>
                    <td className="text-14-regular" style={{ fontVariantNumeric: 'tabular-nums' }}>{workedDuration(rec)}</td>
                    <td><StatusPill rec={rec} /></td>
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
