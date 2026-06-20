import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import {
  GraduationCap, Users, TrendingUp, AlertCircle, UserCheck, Banknote, DoorOpen, UserPlus,
  CalendarDays, BookOpen, FileText, ShoppingCart, Receipt, CalendarCheck, ChevronRight,
  CheckCircle2, Wallet,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import { StatCard, Skeleton } from '../../components/ui';
import { format, isToday, isTomorrow } from 'date-fns';

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Fee amounts are stored in paise — match the rest of the dashboard's ÷100 convention.
const inr = (paise) => '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN');
const dateLabel = (d) => {
  const dt = new Date(d);
  return isToday(dt) ? 'Today' : isTomorrow(dt) ? 'Tomorrow' : format(dt, 'EEE, dd MMM');
};

const KIND = {
  event:    { icon: CalendarDays, color: '#8b5cf6' },
  exam:     { icon: FileText,     color: '#ef4444' },
  homework: { icon: BookOpen,     color: '#f59e0b' },
};

// ── Donut with a centered label ─────────────────────────────────────────────
function Donut({ data, centerTop, centerBottom, height = 168 }) {
  const total = data.reduce((a, b) => a + (b.value || 0), 0);
  const slices = total > 0 ? data : [{ name: 'No data', value: 1, color: '#e2e8f0' }];
  return (
    <div style={{ position: 'relative', height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={slices} dataKey="value" cx="50%" cy="50%"
            innerRadius={height * 0.32} outerRadius={height * 0.46}
            paddingAngle={total > 0 ? 2 : 0} startAngle={90} endAngle={-270} stroke="none">
            {slices.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          {total > 0 && <Tooltip formatter={(v, n) => [v, n]} />}
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.5px' }}>{centerTop}</div>
        {centerBottom && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{centerBottom}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h3 className="text-16-bold" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
        {Icon && <Icon size={18} color="var(--primary)" />} {children}
      </h3>
      {action}
    </div>
  );
}

// Small clickable metric tile used in the Gate & Approvals card.
function PulseTile({ icon: Icon, label, value, color, to }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 14px', border: '1px solid var(--border)', transition: 'transform .15s, box-shadow .15s', height: '100%' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Icon size={17} color={color} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </Link>
  );
}

// Loading skeleton that mirrors the dashboard's widgets.
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
      {[0, 1, 2].map(row => (
        <div key={row} className="grid-2" style={{ marginBottom: 24 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <Skeleton width={160} height={16} />
              <Skeleton width="100%" height={180} radius={10} style={{ marginTop: 16 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/school/dashboard'),
    refetchInterval: 60000,
  });

  if (isLoading) return <DashboardSkeleton />;
  const s = data?.stats;

  // ── Finance charts ──────────────────────────────────────────────────────────
  const revenueChart = s?.charts?.revenue?.map(r => ({ name: months[(r._id.month || 1) - 1], Revenue: r.revenue })) || [];
  const expenseChart = s?.charts?.expenses?.map(e => ({ name: months[(e._id.month || 1) - 1], Expenses: e.amount })) || [];
  const financeChart = revenueChart.map((r, i) => ({ name: r.name, Revenue: r.Revenue, Expenses: expenseChart[i]?.Expenses || 0 }));

  // ── Attendance ────────────────────────────────────────────────────────────
  const sPresent = s?.students?.present || 0, sTotal = s?.students?.total || 0;
  const attPct = sTotal ? Math.round((sPresent / sTotal) * 100) : 0;
  const attData = [
    { name: 'Present', value: sPresent, color: '#10b981' },
    { name: 'Absent / unmarked', value: Math.max(0, sTotal - sPresent), color: '#e2e8f0' },
  ];
  const ePresent = s?.employees?.present || 0, eTotal = s?.employees?.total || 0;
  const staffPct = eTotal ? Math.round((ePresent / eTotal) * 100) : 0;

  // ── Fee collection ring ─────────────────────────────────────────────────────
  const collected = s?.finance?.collected || 0, expected = s?.finance?.expected || 0;
  const collPct = expected ? Math.round((collected / expected) * 100) : 0;
  const collData = [
    { name: 'Collected', value: collected, color: '#10b981' },
    { name: 'Outstanding', value: Math.max(0, expected - collected), color: '#f59e0b' },
  ];

  // ── Upcoming (next 7 days) — merge events + exams + homework ────────────────
  const upcoming = [
    ...(s?.upcoming?.events || []).map(e => ({ kind: 'event', title: e.title, date: e.date, meta: e.type })),
    ...(s?.upcoming?.exams || []).map(e => ({ kind: 'exam', title: e.name, date: e.examDate, meta: e.type })),
    ...(s?.upcoming?.homework || []).map(h => ({ kind: 'homework', title: h.title, date: h.dueDate, meta: h.class ? `${h.class.name}${h.class.section ? ' ' + h.class.section : ''}` : '' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);

  // ── Class strength ──────────────────────────────────────────────────────────
  const classStrength = (s?.classStrength || []).map(c => ({
    name: c.section ? `${c.name} ${c.section}` : c.name, count: c.count,
  }));

  // ── Action-center alerts ────────────────────────────────────────────────────
  const alerts = [
    s?.alerts?.overdueFees?.count > 0 && { icon: Receipt, color: '#ef4444', label: 'Overdue fees', value: `${s.alerts.overdueFees.count} · ${inr(s.alerts.overdueFees.amount)}`, to: '/fees' },
    s?.alerts?.pendingLeaves > 0 && { icon: CalendarCheck, color: '#f59e0b', label: 'Pending leave requests', value: s.alerts.pendingLeaves, to: '/attendance' },
    s?.alerts?.overdueBooks > 0 && { icon: BookOpen, color: '#8b5cf6', label: 'Overdue library books', value: s.alerts.overdueBooks, to: '/library' },
    s?.alerts?.pendingPurchases > 0 && { icon: ShoppingCart, color: '#1a56e8', label: 'Pending purchase requests', value: s.alerts.pendingPurchases, to: '/inventory' },
  ].filter(Boolean);

  const quickActions = [
    { icon: UserPlus, label: 'Add Student', to: '/students', color: '#1a56e8' },
    { icon: Banknote, label: 'Collect Fee', to: '/fees', color: '#10b981' },
    { icon: UserCheck, label: 'Mark Attendance', to: '/attendance', color: '#f59e0b' },
    { icon: CalendarDays, label: 'Add Notice', to: '/calendar', color: '#8b5cf6' },
  ];

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
          {user?.subscription?.status === 'trial' && <span className="badge badge-warning">Trial Active</span>}
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard title="Total Students" value={s?.students?.total || 0}
          sub={`${sPresent} present today`} icon={GraduationCap} color="#1a56e8" bg="#eff6ff" />
        <StatCard title="Total Staff" value={s?.employees?.total || 0}
          sub={`${ePresent} present today`} icon={Users} color="#10b981" bg="#f0fdf4" />
        <StatCard title="Collected This Month" value={inr(s?.finance?.monthlyRevenue)}
          sub="Fee collections" icon={TrendingUp} color="#f59e0b" bg="#fffbeb" />
        <StatCard title="Pending Fees" value={inr(s?.finance?.pendingFees)}
          sub={`${s?.finance?.pendingFeesCount || 0} students`} icon={AlertCircle} color="#ef4444" bg="#fef2f2" />
      </div>

      {/* ── Today's Pulse ──────────────────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <SectionTitle icon={UserCheck}>Attendance — Today</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
            <Donut data={attData} centerTop={`${attPct}%`} centerBottom="students present" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Students present</div>
                <div className="text-18-semibold" style={{ color: '#10b981' }}>{sPresent} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}>/ {sTotal}</span></div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Students absent</div>
                <div className="text-18-semibold" style={{ color: '#ef4444' }}>{s?.students?.absent || 0}</div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Staff present — {staffPct}%</div>
                <div className="text-18-semibold" style={{ color: '#1a56e8' }}>{ePresent} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}>/ {eTotal}</span></div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8 }}>
                  <div style={{ height: '100%', width: `${staffPct}%`, background: '#1a56e8', borderRadius: 3, transition: 'width .5s' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <SectionTitle icon={DoorOpen}>Gate &amp; Approvals — Today</SectionTitle>
          <div className="grid-3" style={{ gap: 12 }}>
            <PulseTile icon={DoorOpen} label="Out-passes today" value={s?.pulse?.outpassToday || 0} color="#1a56e8" to="/outpass" />
            <PulseTile icon={UserPlus} label="Visitors today" value={s?.pulse?.visitsToday || 0} color="#10b981" to="/visits" />
            <PulseTile icon={CalendarCheck} label="Pending leaves" value={s?.pulse?.pendingLeaves || 0} color="#f59e0b" to="/attendance" />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span><b style={{ color: 'var(--text-primary)' }}>{s?.pulse?.pendingStudentLeaves || 0}</b> student leave requests</span>
            <span><b style={{ color: 'var(--text-primary)' }}>{s?.pulse?.pendingStaffLeaves || 0}</b> staff leave requests</span>
          </div>
        </div>
      </div>

      {/* ── Finance ────────────────────────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <SectionTitle icon={Banknote}>Revenue vs Expenses (6 months)</SectionTitle>
          {financeChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={financeChart} barGap={4}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${Math.round(v / 100).toLocaleString('en-IN')}`} width={56} />
                <Tooltip formatter={v => inr(v)} />
                <Bar dataKey="Revenue" fill="#1a56e8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>}
          <div className="grid-3" style={{ gap: 12, marginTop: 14 }}>
            {[
              { label: "Today's expenses", val: s?.finance?.todayExpenses, color: '#ef4444', icon: Wallet },
              { label: "This month expenses", val: s?.finance?.monthlyExpenses, color: '#f59e0b', icon: Receipt },
              { label: "Net profit (month)", val: s?.finance?.monthlyProfit, color: (s?.finance?.monthlyProfit || 0) >= 0 ? '#10b981' : '#ef4444', icon: TrendingUp },
            ].map(t => (
              <div key={t.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.label}</div>
                <div className="text-16-bold" style={{ color: t.color }}>{inr(t.val)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <SectionTitle icon={TrendingUp} action={<Link to="/fees" className="text-13" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View fees →</Link>}>Fee Collection</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
            <Donut data={collData} centerTop={`${collPct}%`} centerBottom="collected" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Collected</div>
                <div className="text-18-semibold" style={{ color: '#10b981' }}>{inr(collected)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Expected</div>
                <div className="text-18-semibold">{inr(expected)}</div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Overdue</div>
                <div className="text-18-semibold" style={{ color: '#ef4444' }}>{inr(s?.alerts?.overdueFees?.amount)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s?.alerts?.overdueFees?.count || 0} records past due</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Academics & Upcoming ───────────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <SectionTitle icon={CalendarDays} action={<Link to="/calendar" className="text-13" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Calendar →</Link>}>Upcoming — Next 7 Days</SectionTitle>
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {upcoming.map((u, i) => {
                const K = KIND[u.kind];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: K.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <K.icon size={16} color={K.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{u.kind}{u.meta ? ` · ${u.meta}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: K.color, whiteSpace: 'nowrap' }}>{dateLabel(u.date)}</span>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, gap: 8 }}><CalendarDays size={28} style={{ opacity: 0.4 }} />Nothing scheduled in the next 7 days</div>}
        </div>

        <div className="card">
          <SectionTitle icon={GraduationCap} action={<Link to="/classes" className="text-13" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Classes →</Link>}>Class Strength</SectionTitle>
          {classStrength.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, classStrength.length * 30)}>
              <BarChart data={classStrength} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={v => [`${v} students`, 'Strength']} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" fill="#1a56e8" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No classes yet</div>}
        </div>
      </div>

      {/* ── Action Center + Quick Actions ──────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <SectionTitle icon={AlertCircle}>Action Center</SectionTitle>
          {alerts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {alerts.map((a, i) => (
                <Link key={i} to={a.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: a.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <a.icon size={16} color={a.color} />
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.value}</span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, gap: 8 }}>
              <CheckCircle2 size={30} color="#10b981" style={{ opacity: 0.7 }} />All clear — nothing needs attention
            </div>
          )}
        </div>

        <div className="card">
          <SectionTitle>Quick Actions</SectionTitle>
          <div className="grid-2" style={{ gap: 12 }}>
            {quickActions.map(a => (
              <Link key={a.label} to={a.to} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 14px', borderRadius: 12, border: '1px solid var(--border)', transition: 'transform .15s, box-shadow .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: a.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <a.icon size={19} color={a.color} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent admissions ──────────────────────────────────────────────── */}
      <div className="card">
        <SectionTitle icon={UserPlus} action={<Link to="/students" className="text-13" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>All students →</Link>}>Recent Admissions</SectionTitle>
        {s?.recentStudents?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Student</th><th>Admission No</th><th>Class</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {s.recentStudents.map(stu => (
                  <tr key={stu._id}>
                    <td style={{ fontWeight: 500 }}>{stu.name}</td>
                    <td><span className="badge badge-info">{stu.admissionNumber}</span></td>
                    <td>{stu.currentClass?.name ? `${stu.currentClass.name}${stu.currentClass.section ? ' ' + stu.currentClass.section : ''}` : '—'}</td>
                    <td>{stu.createdAt ? format(new Date(stu.createdAt), 'dd MMM yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No admissions yet</div>}
      </div>
    </div>
  );
}
