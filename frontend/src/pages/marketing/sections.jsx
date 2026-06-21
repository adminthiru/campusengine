// ============================================================================
// CampusEngine marketing — content sections.
// Product "previews" are faithful, lightweight recreations of the real product
// UI (same tokens / widgets) — self-contained so the marketing page needs no
// auth context or data fetching.
// ============================================================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ChevronDown, ArrowRight, Sparkles, Send, TrendingUp, AlertTriangle,
  Bell, CheckCircle2, GraduationCap, Building2, UserCog, Users2, BarChart3,
  School, FolderTree, FileBarChart,
} from 'lucide-react';
import {
  Reveal, CountUp, MiniBars, Donut, Sparkline, Progress, AppChrome,
  MODULES, MODULE_CATS, FLAGSHIP, WHY, STEPS, METRICS, ROI, ROLES, PLANS, FAQS,
} from './_ui';

const REG = '/register';

// ── tiny shared bits ────────────────────────────────────────────────────────
function Head({ eyebrow, title, lead, light }) {
  return (
    <div className="ce-section-head">
      {eyebrow && <Reveal as="span" className={`ce-eyebrow ${light ? 'ce-eyebrow--light' : ''}`}>{eyebrow}</Reveal>}
      <Reveal as="h2" className="ce-h2" delay={1}>{title}</Reveal>
      {lead && <Reveal as="p" className="ce-lead" delay={2}>{lead}</Reveal>}
    </div>
  );
}
const Tile = ({ label, value, color = '#0f172a', bg = '#f7f9fc' }) => (
  <div style={{ background: bg, borderRadius: 12, padding: '12px 14px' }}>
    <div style={{ fontSize: 11.5, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em', marginTop: 3 }}>{value}</div>
  </div>
);
const Pill = ({ children, color, bg }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '3px 9px', borderRadius: 8 }}>{children}</span>
);

// ── Product previews (per flagship module) ──────────────────────────────────
const PREVIEW = {
  attendance: () => (
    <AppChrome title="Attendance · Today">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Donut pct={94} size={104} color="#10b981" label="94%" sub="present" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Grade 8 — A · Period 1</div>
          {[['Aarav S.', 'P', '#10b981', '#ecfdf5'], ['Diya R.', 'P', '#10b981', '#ecfdf5'], ['Kabir M.', 'A', '#ef4444', '#fef2f2'], ['Isha P.', 'P', '#10b981', '#ecfdf5']].map(([n, s, c, b]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: '#475569' }}>{n}</span>
              <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', fontWeight: 800, color: c, background: b }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#1a56e8', fontWeight: 600 }}>
        <Bell size={13} /> Absentee SMS sent to 1 guardian
      </div>
    </AppChrome>
  ),
  fees: () => (
    <AppChrome title="Fees · Collection" accent="#10b981">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Donut pct={86} size={104} color="#1a56e8" label="86%" sub="collected" />
        <div style={{ flex: 1, display: 'grid', gap: 8 }}>
          <Tile label="Collected this month" value="₹18.4L" color="#10b981" bg="#ecfdf5" />
          <Tile label="Pending" value="₹2.9L" color="#ef4444" bg="#fef2f2" />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f7f9fc', borderRadius: 10, padding: '10px 12px' }}>
        <span style={{ fontSize: 12.5, color: '#475569' }}>Receipt #INV-2048 · Online</span>
        <Pill color="#16a34a" bg="#ecfdf5">Paid ₹12,500</Pill>
      </div>
    </AppChrome>
  ),
  exams: () => (
    <AppChrome title="Exams · Result card" accent="#ef4444">
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Term 1 · Grade 10 — A</div>
      {[['Mathematics', 96, 'A+'], ['Science', 89, 'A'], ['English', 92, 'A+'], ['Social', 84, 'A']].map(([s, m, g]) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
          <span style={{ color: '#475569' }}>{s}</span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <b style={{ color: '#0f172a' }}>{m}/100</b>
            <Pill color="#1a56e8" bg="#eff6ff">{g}</Pill>
          </span>
        </div>
      ))}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Percentage · 90.3%</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16a34a', fontWeight: 700 }}><CheckCircle2 size={13} /> Published</span>
      </div>
    </AppChrome>
  ),
  timetable: () => {
    const cells = [['Math', '#eff6ff', '#1a56e8'], ['Sci', '#ecfdf5', '#10b981'], ['Eng', '#fef3f2', '#ef4444'], ['Hist', '#faf5ff', '#8b5cf6'], ['Geo', '#fffbeb', '#f59e0b']];
    return (
      <AppChrome title="Timetable · Grade 9 — B" accent="#8b5cf6">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => <div key={d} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'center' }}>{d}</div>)}
          {Array.from({ length: 15 }).map((_, i) => {
            const [t, bg, c] = cells[i % cells.length];
            const hot = i === 6;
            return <div key={i} style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '8px 0', borderRadius: 8, color: c, background: bg, outline: hot ? '2px solid #8b5cf6' : 'none' }}>{t}</div>;
          })}
        </div>
        <div style={{ marginTop: 11, fontSize: 12, color: '#8b5cf6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> No teacher clashes detected</div>
      </AppChrome>
    );
  },
  library: () => (
    <AppChrome title="Library · Issued" accent="#f97316">
      {[['Wings of Fire', 'Aarav S.', 'On time', '#16a34a', '#ecfdf5'], ['The Alchemist', 'Diya R.', 'Due today', '#d97706', '#fffbeb'], ['Sapiens', 'Kabir M.', 'Overdue', '#dc2626', '#fef2f2']].map(([b, who, st, c, bg]) => (
        <div key={b} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{b}</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{who}</div>
          </div>
          <Pill color={c} bg={bg}>{st}</Pill>
        </div>
      ))}
      <div style={{ marginTop: 11, display: 'flex', gap: 10 }}>
        <Tile label="Issued" value="248" />
        <Tile label="Overdue" value="12" color="#ef4444" bg="#fef2f2" />
      </div>
    </AppChrome>
  ),
};

// ── 2. Trust ─────────────────────────────────────────────────────────────────
export function TrustBar() {
  const logos = ['Greenwood High', 'St. Xavier’s', 'Vidya Mandir', 'Sunrise Academy', 'National Public'];
  return (
    <section id="trust" className="ce-section ce-section--tight ce-soft">
      <div className="ce-container">
        <Reveal as="p" style={{ textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 14 }}>
          Trusted by growing schools across India
        </Reveal>
        <div className="ce-logos">
          {logos.map((l, i) => (
            <Reveal as="span" key={l} delay={(i % 4) + 1} className="ce-logos__item"><School size={20} /> {l}</Reveal>
          ))}
        </div>
        <div className="ce-metrics">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={(i % 4) + 1} className="ce-metric">
              <div className="ce-metric__num ce-grad-text">
                <CountUp to={m.to} prefix={m.prefix} suffix={m.suffix} format={m.format} />
              </div>
              <div className="ce-metric__label">{m.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 3. Why CampusEngine ──────────────────────────────────────────────────────
export function WhyCampusEngine() {
  return (
    <section id="why" className="ce-section">
      <div className="ce-container">
        <Head eyebrow="Why CampusEngine" title={<>Why schools switch<br />— and stay</>} lead="Replace a dozen registers, spreadsheets and disconnected tools with one calm, reliable system your whole campus actually enjoys using." />
        <div className="ce-why">
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={(i % 3) + 1} className={`ce-why__card ${w.wide ? 'ce-why__card--wide' : ''}`}>
              <div className="ce-ico" style={{ background: w.color + '18', color: w.color }}><w.icon size={22} /></div>
              <h3 className="ce-h3" style={{ fontSize: 19 }}>{w.title}</h3>
              <p style={{ color: '#475569', fontSize: 14.5, marginTop: 8, lineHeight: 1.6 }}>{w.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 4. Product explainer / Module showcase ───────────────────────────────────
const FLAG_POINTS = {
  attendance: ['Mark attendance by class & period in seconds', 'Auto-SMS absentees to guardians instantly', '3-day consecutive-absence alerts'],
  fees: ['Online payments with instant digital receipts', 'Live pending & overdue tracking', 'One-click bulk fee reminders'],
  exams: ['Schedule exams and enter marks fast', 'Automatic grading, totals & ranks', 'Printable, shareable result cards'],
  timetable: ['Visual day × period builder', 'Automatic teacher clash detection', 'Instant free-slot finder for substitutions'],
  library: ['Searchable catalogue of every title', 'Issue, return and renew in a tap', 'Overdue tracking with auto fines'],
};

export function ModuleShowcase() {
  const [active, setActive] = useState('attendance');
  const [cat, setCat] = useState('All');
  const mod = MODULES.find(m => m.key === active);
  const Preview = PREVIEW[active];
  const shown = MODULES.filter(m => cat === 'All' || m.cat === cat);

  return (
    <section id="modules" className="ce-section ce-soft">
      <div className="ce-container">
        <Head eyebrow="Product" title="Everything your campus runs on, in one place" lead="19 deeply-integrated modules — from admissions to payroll — each built to remove busywork and surface what matters." />

        {/* flagship preview switcher */}
        <div className="ce-tabs">
          {FLAGSHIP.map(k => {
            const m = MODULES.find(x => x.key === k);
            return (
              <button key={k} className={`ce-tab ${active === k ? 'ce-tab--active' : ''}`} onClick={() => setActive(k)}>
                <m.icon size={15} /> {m.label}
              </button>
            );
          })}
        </div>

        <Reveal className="ce-showcase">
          <div className="ce-showcase__media">{Preview && <div style={{ width: '100%', maxWidth: 380 }}><Preview /></div>}</div>
          <div>
            <div className="ce-ico" style={{ background: mod.color + '18', color: mod.color }}><mod.icon size={22} /></div>
            <h3 className="ce-h3">{mod.label}</h3>
            <p className="ce-lead" style={{ fontSize: 17, margin: '12px 0 18px' }}>{mod.value}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: 12 }}>
              {FLAG_POINTS[active].map(p => (
                <li key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, color: '#475569' }}>
                  <Check size={18} color={mod.color} style={{ flexShrink: 0, marginTop: 1 }} /> {p}
                </li>
              ))}
            </ul>
            <Link to={REG} className="ce-btn ce-btn--primary">Explore {mod.label} <ArrowRight size={17} /></Link>
          </div>
        </Reveal>

        {/* full module bento */}
        <div style={{ textAlign: 'center', marginTop: 'clamp(48px,6vw,72px)' }}>
          <div className="ce-tabs" style={{ marginBottom: 22 }}>
            {MODULE_CATS.map(c => (
              <button key={c} className={`ce-tab ${cat === c ? 'ce-tab--active' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="ce-modgrid">
          {shown.map((m, i) => (
            <Reveal key={m.key} delay={(i % 4) + 1} className="ce-modcard">
              <div className="ce-modcard__ico" style={{ background: m.color + '18', color: m.color }}><m.icon size={19} /></div>
              <div>
                <div className="ce-modcard__t">{m.label}</div>
                <div className="ce-modcard__d">{m.value}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 5. How it works ──────────────────────────────────────────────────────────
export function HowItWorks() {
  const [step, setStep] = useState(1);
  return (
    <section id="how" className="ce-section">
      <div className="ce-container">
        <Head eyebrow="How it works" title="Live in four simple steps" lead="No lengthy implementation projects. Most schools are running CampusEngine the very same day." />
        <div className="ce-steps">
          {STEPS.map(s => (
            <Reveal key={s.n} delay={s.n} className={`ce-step ${step === s.n ? 'ce-step--active' : ''}`} style={{ cursor: 'pointer' }}>
              <div onMouseEnter={() => setStep(s.n)} onClick={() => setStep(s.n)}>
                <div className="ce-step__n">{s.n}</div>
                <h3 className="ce-h3" style={{ fontSize: 18 }}>{s.title}</h3>
                <p style={{ color: '#475569', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>{s.text}</p>
                <div className="ce-step__bar"><i /></div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 6. CampusEngine AI ───────────────────────────────────────────────────────
const AI_EXAMPLES = [
  {
    q: 'Which classes have low attendance this week?',
    render: () => (
      <>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 96 }}>
          {[['6-A', 96, false], ['7-B', 91, false], ['8-A', 88, false], ['9-B', 71, true], ['10-A', 94, false]].map(([c, v, hot]) => (
            <div key={c} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: `${v - 55}px`, borderRadius: '6px 6px 0 0', background: hot ? '#ef4444' : 'rgba(255,255,255,.22)' }} />
              <div style={{ fontSize: 10.5, marginTop: 6, color: hot ? '#fca5a5' : '#9fb0d0', fontWeight: hot ? 700 : 500 }}>{c} · {v}%</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 9, alignItems: 'flex-start', color: '#cdd8ef', fontSize: 13.5 }}>
          <AlertTriangle size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b style={{ color: '#fff' }}>Grade 9-B at 71%</b> — 8 students absent 3+ days in a row. Recommend contacting guardians today.</span>
        </div>
      </>
    ),
    actions: ['Send SMS to guardians', 'Notify class teacher'],
  },
  {
    q: 'How much fee is still pending this month?',
    render: () => (
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Donut pct={86} size={104} color="#10b981" track="rgba(255,255,255,.12)" label="86%" sub="collected" />
        <div style={{ flex: 1, display: 'grid', gap: 8, color: '#cdd8ef', fontSize: 13.5 }}>
          <div><b style={{ color: '#fff', fontSize: 22 }}>₹2.9L</b> pending across <b style={{ color: '#fff' }}>138</b> students.</div>
          <div>54 are past their due date — reminders can go out in one click.</div>
        </div>
      </div>
    ),
    actions: ['Send fee reminders', 'View overdue list'],
  },
  {
    q: 'Show top performers in Grade 10.',
    render: () => (
      <div style={{ display: 'grid', gap: 8 }}>
        {[['Ananya K.', '96.4%', 1], ['Rohan D.', '94.8%', 2], ['Meera S.', '93.1%', 3]].map(([n, p, r]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '9px 12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#e7ecf6', fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', background: '#1a56e8', color: '#fff', fontSize: 12, fontWeight: 800 }}>{r}</span>{n}
            </span>
            <b style={{ color: '#fff' }}>{p}</b>
          </div>
        ))}
      </div>
    ),
    actions: ['Generate merit certificates', 'Share with parents'],
  },
];

export function AISection() {
  const [i, setI] = useState(0);
  const ex = AI_EXAMPLES[i];
  return (
    <section id="ai" className="ce-section ce-dark">
      <div className="ce-dark__glow" style={{ width: 460, height: 460, top: -120, right: -80, background: 'radial-gradient(circle,#3b82f6,transparent 70%)' }} />
      <div className="ce-dark__glow" style={{ width: 420, height: 420, bottom: -160, left: -100, background: 'radial-gradient(circle,#8b5cf6,transparent 70%)' }} />
      <div className="ce-container">
        <div className="ce-ai">
          <div>
            <Reveal as="span" className="ce-eyebrow ce-eyebrow--light"><Sparkles size={14} /> CampusEngine AI</Reveal>
            <Reveal as="h2" className="ce-h2" delay={1} style={{ margin: '18px 0 16px' }}>Ask your campus anything.</Reveal>
            <Reveal as="p" className="ce-lead" delay={2}>Your data already knows the answers. Ask in plain English and CampusEngine AI returns charts, insights and the next best action — built from the same widgets you use every day.</Reveal>
            <div className="ce-ai__chips">
              {AI_EXAMPLES.map((e, idx) => (
                <button key={idx} className={`ce-ai__chip ${i === idx ? 'ce-ai__chip--active' : ''}`} onClick={() => setI(idx)}>{e.q}</button>
              ))}
            </div>
          </div>
          <Reveal className="ce-ai__panel" delay={1}>
            <div className="ce-ai__q"><span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#1a56e8,#8b5cf6)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Sparkles size={15} color="#fff" /></span>{ex.q}</div>
            <div className="ce-ai__a">{ex.render()}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
              {ex.actions.map(a => (
                <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', padding: '8px 13px', borderRadius: 10 }}><Send size={13} /> {a}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── 7. Role experience ───────────────────────────────────────────────────────
const ROLE_UI = {
  principal: () => (
    <div>
      <div className="ce-grid ce-grid--3" style={{ gap: 12 }}>
        <Tile label="Students" value="1,248" color="#1a56e8" bg="#eff6ff" />
        <Tile label="Attendance" value="94%" color="#10b981" bg="#ecfdf5" />
        <Tile label="Fees (mo)" value="₹18.4L" color="#f59e0b" bg="#fffbeb" />
      </div>
      <div style={{ marginTop: 14, background: '#fff', border: '1px solid #eef2f8', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Attendance — last 7 days</div>
        <Sparkline data={[88, 91, 89, 93, 90, 95, 94]} color="#1a56e8" />
      </div>
    </div>
  ),
  admin: () => (
    <div>
      <div className="ce-grid ce-grid--2" style={{ gap: 12 }}>
        <Tile label="New admissions" value="36" color="#1a56e8" bg="#eff6ff" />
        <Tile label="Pending fees" value="₹2.9L" color="#ef4444" bg="#fef2f2" />
      </div>
      <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
        {[['Overdue fees', '54', '#ef4444'], ['Pending leave requests', '7', '#f59e0b'], ['Visitors today', '12', '#1a56e8']].map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f9fc', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            <span style={{ color: '#475569' }}>{l}</span><b style={{ color: c }}>{v}</b>
          </div>
        ))}
      </div>
    </div>
  ),
  teacher: () => (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>My classes today</div>
      {[['Grade 8-A', 'Mathematics', 'P1'], ['Grade 9-B', 'Mathematics', 'P3'], ['Grade 10-A', 'Mathematics', 'P5']].map(([c, s, p]) => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
          <span><b>{c}</b> <span style={{ color: '#94a3b8' }}>· {s}</span></span>
          <Pill color="#1a56e8" bg="#eff6ff">{p}</Pill>
        </div>
      ))}
      <button className="ce-btn ce-btn--primary" style={{ width: '100%', marginTop: 12 }}>Mark attendance</button>
    </div>
  ),
  parent: () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#1a56e8,#8b5cf6)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>AS</span>
        <div><div style={{ fontWeight: 800 }}>Aarav Sharma</div><div style={{ fontSize: 12, color: '#94a3b8' }}>Grade 8 — A</div></div>
      </div>
      <div className="ce-grid ce-grid--2" style={{ gap: 12 }}>
        <Tile label="Attendance" value="96%" color="#10b981" bg="#ecfdf5" />
        <Tile label="Fee due" value="₹4,500" color="#ef4444" bg="#fef2f2" />
      </div>
      <div style={{ marginTop: 12, background: '#f7f9fc', borderRadius: 10, padding: '10px 12px', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#475569' }}>Term 1 result</span><b style={{ color: '#1a56e8' }}>90.3% · A+</b>
      </div>
    </div>
  ),
  student: () => (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Donut pct={96} size={96} color="#10b981" label="96%" sub="attendance" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Next class</div>
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontWeight: 800, color: '#1a56e8' }}>Mathematics</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Period 1 · Room 204</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, background: '#fffbeb', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#92400e' }}>📘 Homework: Algebra worksheet due tomorrow</div>
    </div>
  ),
};

export function RoleExperience() {
  const [role, setRole] = useState('principal');
  return (
    <section id="roles" className="ce-section">
      <div className="ce-container">
        <Head eyebrow="Built for everyone" title="One platform, an experience for every role" lead="Principals, admins, teachers, parents and students each get a focused view with exactly what they need — nothing they don’t." />
        <div className="ce-tabs">
          {ROLES.map(r => (
            <button key={r.key} className={`ce-tab ${role === r.key ? 'ce-tab--active' : ''}`} onClick={() => setRole(r.key)}>{r.label}</button>
          ))}
        </div>
        <Reveal className="ce-grid ce-grid--2" style={{ alignItems: 'center', gap: 'clamp(24px,4vw,48px)' }}>
          <div className="ce-roleui">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>{ROLES.find(r => r.key === role).label} view</div>
            {ROLE_UI[role]()}
          </div>
          <div>
            <h3 className="ce-h3">{ROLE_DESC[role].title}</h3>
            <p className="ce-lead" style={{ fontSize: 16.5, marginTop: 12 }}>{ROLE_DESC[role].text}</p>
            <Link to={REG} className="ce-btn ce-btn--ghost" style={{ marginTop: 20 }}>See it live <ArrowRight size={16} /></Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
const ROLE_DESC = {
  principal: { title: 'A campus cockpit', text: 'Attendance, finances and academics at a glance — with trends and AI alerts that flag what needs attention before it becomes a problem.' },
  admin: { title: 'Run daily operations', text: 'Admissions, fee collection, approvals and the front desk — every routine task streamlined into a single action centre.' },
  teacher: { title: 'Less paperwork, more teaching', text: 'See today’s classes, mark attendance in seconds, set homework and enter marks — all from one clean workspace.' },
  parent: { title: 'Always in the loop', text: 'Live attendance, fee dues, results and instant SMS updates in your preferred language — for every child, in one place.' },
  student: { title: 'Your school in your pocket', text: 'Timetable, attendance, homework and exam results — everything a student needs, beautifully simple.' },
};

// ── 8. Campus Operating System ───────────────────────────────────────────────
export function OperatingSystem() {
  const cols = [
    { head: 'School', icon: Building2, items: [['Campus profile'], ['Academic year'], ['Branding & policies']] },
    { head: 'Departments', icon: FolderTree, items: [['Academics'], ['Finance'], ['Operations'], ['Library & transport']] },
    { head: 'Users', icon: Users2, items: [['Principal & admin'], ['Teachers'], ['Parents & students'], ['Custom staff logins']] },
    { head: 'Reports', icon: FileBarChart, items: [['Live dashboards'], ['AI insights'], ['Exports & receipts']] },
  ];
  return (
    <section id="os" className="ce-section ce-dark">
      <div className="ce-dark__glow" style={{ width: 520, height: 520, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle,#1e3a8a,transparent 70%)', opacity: .5 }} />
      <div className="ce-container">
        <Head light eyebrow="Architecture" title="Your campus operating system" lead="Every entity connects to the next — so data flows automatically from your school, through departments and users, into live reports." />
        <Reveal className="ce-os">
          {cols.map((c, ci) => (
            <div key={c.head} className="ce-os__col">
              <div className="ce-os__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><c.icon size={16} color="#9fb0d0" /> {c.head}</div>
              {c.items.map((it, i) => (
                <Reveal key={i} delay={(i % 4) + 1} className="ce-os__node"><span style={{ width: 7, height: 7, borderRadius: 7, background: '#3b82f6', flexShrink: 0 }} /> {it[0]}</Reveal>
              ))}
              {ci < cols.length - 1 && <ArrowRight size={18} color="rgba(255,255,255,.35)" style={{ position: 'absolute', right: -9, top: 38 }} className="ce-os__arrow" />}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ── 9. ROI ───────────────────────────────────────────────────────────────────
export function ROISection() {
  return (
    <section className="ce-section">
      <div className="ce-container">
        <Head eyebrow="The impact" title="Real results, from day one" lead="Schools on CampusEngine reclaim hours every week and collect fees faster — here’s the difference it makes." />
        <div className="ce-roi">
          {ROI.map((r, i) => (
            <Reveal key={r.label} delay={(i % 4) + 1} className="ce-roi__card">
              <div className="ce-roi__num" style={{ color: r.color }}>{r.num}</div>
              <div style={{ marginTop: 12, color: '#475569', fontSize: 14.5 }}>{r.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 10. Pricing ──────────────────────────────────────────────────────────────
export function Pricing() {
  return (
    <section id="pricing" className="ce-section ce-soft">
      <div className="ce-container">
        <Head eyebrow="Pricing" title="Simple, transparent pricing" lead="Start free for 15 days. Scale from a single school to a multi-campus institution — pay only for what you need." />
        <div className="ce-pricing">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={(i % 3) + 1} className={`ce-plan ${p.featured ? 'ce-plan--featured' : ''}`}>
              {p.featured && <span className="ce-plan__badge">Most popular</span>}
              <div style={{ fontWeight: 800, fontSize: 19 }}>{p.name}</div>
              <div style={{ color: '#64748b', fontSize: 13.5, margin: '4px 0 18px' }}>{p.tagline}</div>
              <div className="ce-plan__price">{p.price}<small> {p.cadence}</small></div>
              <ul className="ce-plan__feat">
                {p.feats.map(f => (
                  <li key={f}><Check size={17} color={p.featured ? '#1a56e8' : '#10b981'} /> {f}</li>
                ))}
              </ul>
              {p.cta === 'Book a demo'
                ? <a href="mailto:hello@campusengine.in" className="ce-btn ce-btn--ghost" style={{ marginTop: 'auto', width: '100%' }}>{p.cta}</a>
                : <Link to={REG} className={`ce-btn ${p.featured ? 'ce-btn--primary' : 'ce-btn--ghost'}`} style={{ marginTop: 'auto', width: '100%' }}>{p.cta}</Link>}
            </Reveal>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13.5, marginTop: 22 }}>All plans include the parent app, automatic SMS and free updates. GST applicable.</p>
      </div>
    </section>
  );
}

// ── 11. FAQ ──────────────────────────────────────────────────────────────────
export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="ce-section">
      <div className="ce-container">
        <Head eyebrow="FAQ" title="Questions, answered" />
        <div className="ce-faq">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} className={`ce-faq__item ${open === i ? 'ce-faq__item--open' : ''}`}>
              <button className="ce-faq__q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                {f.q} <ChevronDown size={20} />
              </button>
              <div className="ce-faq__a" style={{ maxHeight: open === i ? 240 : 0 }}><p>{f.a}</p></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 12. Final CTA ────────────────────────────────────────────────────────────
export function FinalCTA() {
  return (
    <section className="ce-section ce-dark">
      <div className="ce-dark__glow" style={{ width: 520, height: 360, top: -80, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle,#3b82f6,transparent 70%)' }} />
      <div className="ce-container">
        <div className="ce-finalcta">
          <Reveal as="h2" className="ce-h2">Ready to run your campus smarter?</Reveal>
          <Reveal as="p" className="ce-lead" delay={1} style={{ margin: '18px auto 0', maxWidth: 560 }}>Join the schools that replaced their registers, spreadsheets and disconnected tools with one platform. Free for 15 days.</Reveal>
          <Reveal className="ce-hero__cta" delay={2}>
            <Link to={REG} className="ce-btn ce-btn--light ce-btn--lg">Start free trial <ArrowRight size={18} /></Link>
            <a href="mailto:hello@campusengine.in" className="ce-btn ce-btn--ondark ce-btn--lg">Book a demo</a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
