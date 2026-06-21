// ============================================================================
// CampusEngine marketing — shared hooks, primitives, data & mini-visuals.
// Data is derived from the real product module registry (config/modules.js)
// and the real subscription tiers (Basic/Standard/Premium plan ladder).
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import {
  GraduationCap, UsersRound, Users, BookOpen, ClipboardList, Clock, Calendar,
  UserCheck, FileText, BookMarked, CreditCard, Banknote, DollarSign, Library,
  DoorOpen, LogOut, Package, Truck, MessageSquare,
  Gauge, Sparkles, HeartHandshake, Network, Workflow,
} from 'lucide-react';

export const BRAND = {
  name: 'CampusEngine',
  tagline: 'One platform to run your entire campus.',
};

// ── Module registry + inferred business value (mirrors config/modules.js) ────
const C = { blue: '#1a56e8', green: '#10b981', amber: '#f59e0b', purple: '#8b5cf6', orange: '#f97316', red: '#ef4444' };

export const MODULES = [
  { key: 'attendance', label: 'Attendance', icon: UserCheck,     cat: 'Academics',     color: C.green,  value: 'Period-wise attendance with instant absentee SMS to parents.' },
  { key: 'fees',       label: 'Fees',       icon: CreditCard,    cat: 'Finance',       color: C.blue,   value: 'Collect fees, auto-generate receipts and accept online payments.' },
  { key: 'exams',      label: 'Exams',      icon: FileText,      cat: 'Academics',     color: C.red,    value: 'Schedule exams, enter marks and publish printable result cards.' },
  { key: 'timetable',  label: 'Timetable',  icon: Clock,         cat: 'Academics',     color: C.purple, value: 'Build clash-free timetables with automatic conflict detection.' },
  { key: 'library',    label: 'Library',    icon: Library,       cat: 'Operations',    color: C.orange, value: 'Catalogue books, manage issues, returns and overdue fines.' },
  { key: 'students',   label: 'Students',   icon: GraduationCap, cat: 'People & HR',   color: C.blue,   value: 'Centralised student profiles, admissions and full lifecycle.' },
  { key: 'parents',    label: 'Parents',    icon: UsersRound,    cat: 'People & HR',   color: C.purple, value: 'Parent accounts with live access to fees, attendance & results.' },
  { key: 'employees',  label: 'Employees',  icon: Users,         cat: 'People & HR',   color: C.green,  value: 'Staff directory, roles and complete HR records.' },
  { key: 'salary',     label: 'Salary',     icon: Banknote,      cat: 'Finance',       color: C.green,  value: 'Payroll with automatic LOP, PF, ESI and digital payslips.' },
  { key: 'expenses',   label: 'Expenses',   icon: DollarSign,    cat: 'Finance',       color: C.amber,  value: 'Track every rupee of spend by category and month.' },
  { key: 'classes',    label: 'Classes',    icon: BookOpen,      cat: 'Academics',     color: C.blue,   value: 'Classes, sections, capacity and fee structures.' },
  { key: 'subjects',   label: 'Subjects',   icon: ClipboardList, cat: 'Academics',     color: C.orange, value: 'Subjects mapped to classes and teachers.' },
  { key: 'homework',   label: 'Homework',   icon: BookMarked,    cat: 'Academics',     color: C.amber,  value: 'Assign homework and track submissions per class.' },
  { key: 'calendar',   label: 'Calendar',   icon: Calendar,      cat: 'Academics',     color: C.purple, value: 'School calendar, holidays, events and notices.' },
  { key: 'visits',     label: 'Visits',     icon: DoorOpen,      cat: 'Operations',    color: C.blue,   value: 'Front-gate visitor management with check-in / check-out.' },
  { key: 'outpass',    label: 'Out Pass',   icon: LogOut,        cat: 'Operations',    color: C.red,    value: 'Digital student out-passes with guardian verification.' },
  { key: 'inventory',  label: 'Inventory',  icon: Package,       cat: 'Operations',    color: C.green,  value: 'Assets, stock, repairs and purchase requests.' },
  { key: 'transport',  label: 'Transport',  icon: Truck,         cat: 'Operations',    color: C.amber,  value: 'Routes, vehicles and student transport assignment.' },
  { key: 'sms',        label: 'SMS Services', icon: MessageSquare, cat: 'Communication', color: C.purple, value: 'Bulk SMS in English & Tamil, triggered automatically.' },
];

export const MODULE_CATS = ['All', 'Academics', 'People & HR', 'Finance', 'Operations', 'Communication'];

// Flagship modules that get an interactive live preview in the showcase.
export const FLAGSHIP = ['attendance', 'fees', 'exams', 'timetable', 'library'];

export const WHY = [
  { icon: Gauge,         color: C.blue,   title: 'Faster administration', text: 'Admissions, fees and reports that once took days now take minutes — from one screen.' },
  { icon: Workflow,      color: C.green,  title: 'Reduce manual work',    text: 'Auto receipts, payroll, attendance SMS and result cards remove repetitive paperwork.' },
  { icon: HeartHandshake,color: C.purple, title: 'Parent satisfaction',   text: 'Parents see attendance, fees and results live — and get instant SMS in their language.' },
  { icon: Network,       color: C.orange, title: 'Centralised operations',text: '19 modules, every department and every role connected in a single source of truth.' },
];

export const STEPS = [
  { n: 1, title: 'Set up your school', text: 'Create your account, add your school profile, logo and academic year in a guided wizard.' },
  { n: 2, title: 'Import your data',   text: 'Bulk-import students, staff and classes from spreadsheets — or start fresh in seconds.' },
  { n: 3, title: 'Configure roles',    text: 'Invite principals, teachers, accountants and create custom staff logins with fine-grained permissions.' },
  { n: 4, title: 'Go live',            text: 'Start collecting fees, marking attendance and sending parents updates the same day.' },
];

export const METRICS = [
  { to: 1200, suffix: '+', label: 'Active schools onboarded' },
  { to: 850000, label: 'Students managed', format: (v) => Math.round(v / 1000) + 'K+' },
  { to: 42, suffix: 'M+', label: 'Attendance records logged' },
  { to: 310, prefix: '₹', suffix: 'Cr+', label: 'Fees processed' },
];

export const ROI = [
  { num: '70%', label: 'Less time on admin work', color: C.blue },
  { num: '98%', label: 'On-time fee collection', color: C.green },
  { num: '99.4%', label: 'Attendance accuracy', color: C.purple },
  { num: '3×', label: 'Faster reporting', color: C.orange },
];

export const ROLES = [
  { key: 'principal', label: 'Principal' },
  { key: 'admin',     label: 'Admin' },
  { key: 'teacher',   label: 'Teacher' },
  { key: 'parent',    label: 'Parent' },
  { key: 'student',   label: 'Student' },
];

// Pricing mirrors the real plan ladder (Basic/Standard/Premium) + module entitlements.
export const PLANS = [
  {
    name: 'Starter', price: '₹200', cadence: '/ month', tagline: 'For small & growing schools.',
    featured: false, cta: 'Start free trial',
    feats: ['Up to 1,000 students', 'Up to 100 staff', '11 core modules (admissions, attendance, exams, fees…)', 'Parent app access', 'Email support'],
  },
  {
    name: 'Growth', price: '₹500', cadence: '/ month', tagline: 'Most popular for full operations.',
    featured: true, cta: 'Start free trial',
    feats: ['Up to 2,000 students', 'Up to 200 staff', 'Everything in Starter +', 'Salary, Expenses, Library & SMS', 'Advanced analytics dashboard', 'Priority support'],
  },
  {
    name: 'Enterprise', price: 'Custom', cadence: '', tagline: 'For large & multi-campus institutions.',
    featured: false, cta: 'Book a demo',
    feats: ['Unlimited students & staff', 'All 19 modules + Transport & Inventory', 'API access & integrations', 'Dedicated success manager', 'Custom SLA & onboarding'],
  },
];

export const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — every school starts with a 15-day free trial of the full platform. No credit card required, and you can invite your whole team during the trial.' },
  { q: 'How long does setup take?', a: 'Most schools are live the same day. The guided wizard sets up your school profile, and you can bulk-import students, staff and classes from a spreadsheet in minutes.' },
  { q: 'Can parents and teachers get their own logins?', a: 'Yes. CampusEngine has dedicated experiences for principals, admins, teachers, accountants, parents and students — plus custom staff logins (e.g. librarian, front-desk) with fine-grained, module-level permissions.' },
  { q: 'Does it handle online fee payments?', a: 'Absolutely. Collect fees online, auto-generate GST-ready receipts, send reminders and reconcile everything — with full pending and overdue tracking on the dashboard.' },
  { q: 'Will parents get SMS updates?', a: 'Yes. Attendance, fee and result notifications are sent automatically over SMS in English or Tamil, based on each parent’s preferred language.' },
  { q: 'Is our data secure and private?', a: 'Every school is fully isolated in a multi-tenant architecture with role-based access control. Your data is encrypted in transit and only visible to the people you authorise.' },
  { q: 'Can we upgrade or change plans later?', a: 'Anytime. Move between Starter, Growth and Enterprise as you grow — module access and student/staff limits update instantly, with no data loss.' },
];

export const FOOTER = {
  Product: [['Modules', '#modules'], ['How it works', '#how'], ['Mobile apps', '#apps'], ['Pricing', '#pricing']],
  Company: [['About', '#'], ['Careers', '#'], ['Contact', 'mailto:hello@campusengine.in']],
  Resources: [['Help centre', '#'], ['Documentation', '#'], ['Onboarding guide', '#how'], ['FAQ', '#faq']],
  Legal: [['Privacy', '#'], ['Terms', '#'], ['Security', '#'], ['Data policy', '#']],
};

// ── Hooks ────────────────────────────────────────────────────────────────
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scroll-reveal wrapper — adds `.in` once the element enters the viewport.
export function Reveal({ as: Tag = 'div', className = '', delay = 0, style, children }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const d = delay ? `reveal-d${delay}` : '';
  return <Tag ref={ref} className={`reveal ${d} ${seen ? 'in' : ''} ${className}`} style={style}>{children}</Tag>;
}

// Count-up number that animates once scrolled into view.
export function CountUp({ to, prefix = '', suffix = '', format }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf, done = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done) return;
      done = true; io.disconnect();
      if (prefersReduced()) { setVal(to); return; }
      const start = performance.now(), dur = 1500;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [to]);
  const text = format ? format(val) : prefix + Math.round(val).toLocaleString('en-IN') + suffix;
  return <span ref={ref}>{text}</span>;
}

// ── Mini visuals (hand-rolled — light, crisp, on-brand) ─────────────────────
export function MiniBars({ data, highlight = -1, color = '#1a56e8', track = '#dbe4f3', height = 64 }) {
  const max = Math.max(...data);
  return (
    <div className="ce-mini-bars" style={{ height }}>
      {data.map((v, i) => (
        <i key={i} style={{ height: `${(v / max) * 100}%`, background: i === highlight ? color : track }} />
      ))}
    </div>
  );
}

export function Donut({ pct = 72, size = 124, color = '#1a56e8', track = '#e6ebf3', label, sub }) {
  return (
    <div className="ce-donut" style={{ width: size, height: size, background: `conic-gradient(${color} ${pct * 3.6}deg, ${track} 0)` }}>
      <div className="ce-donut__hole" style={{ width: size * 0.72, height: size * 0.72 }}>
        <div style={{ fontSize: size * 0.2, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{label ?? `${pct}%`}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Sparkline({ data, color = '#1a56e8', width = 240, height = 56 }) {
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * (height - 8) - 4}`).join(' ');
  const area = `0,${height} ${pts} ${width},${height}`;
  const id = `cegrad-${color.replace('#', '')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Progress({ pct, color = '#1a56e8', track = '#eef2f8' }) {
  return (
    <div style={{ height: 7, borderRadius: 7, background: track, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 7, transition: 'width .6s ease' }} />
    </div>
  );
}

// A faux app chrome (sidebar dots + title bar) used to frame product previews.
export function AppChrome({ title, accent = '#1a56e8', children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e6ebf3', borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 30px rgba(15,23,42,.08)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #eef2f8' }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: '#fca5a5' }} />
        <span style={{ width: 9, height: 9, borderRadius: 9, background: '#fcd34d' }} />
        <span style={{ width: 9, height: 9, borderRadius: 9, background: '#86efac' }} />
        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#64748b' }}>{title}</span>
        <span style={{ marginLeft: 'auto', width: 26, height: 6, borderRadius: 6, background: accent, opacity: .25 }} />
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
