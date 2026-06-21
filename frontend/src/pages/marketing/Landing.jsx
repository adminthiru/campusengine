// ============================================================================
// CampusEngine — marketing landing page.
// Public front door. "Sign in" → /login, "Start free trial" / signup → /register
// (the school-admin auth screens).
// ============================================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight, Check, GraduationCap, TrendingUp, Bell } from 'lucide-react';
import './landing.css';
import { BRAND, FOOTER, Reveal, Donut } from './_ui';
import {
  WhyCampusEngine, ModuleShowcase, HowItWorks, AISection,
  RoleExperience, OperatingSystem, ROISection, Pricing, FAQ, FinalCTA,
} from './sections';

const NAV_LINKS = [
  ['Product', '#modules'],
  ['How it works', '#how'],
  ['CampusEngine AI', '#ai'],
  ['Pricing', '#pricing'],
  ['FAQ', '#faq'],
];

// ── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <Link to="/" className="ce-logo">
      <span className="ce-logo__mark"><GraduationCap size={19} /></span>
      {BRAND.name}
    </Link>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={`ce-nav ${scrolled ? 'ce-nav--scrolled' : ''}`}>
      <div className="ce-container ce-nav__inner">
        <Logo />
        <div className="ce-nav__links">
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} className="ce-nav__link">{label}</a>
          ))}
        </div>
        <div className="ce-nav__actions">
          <Link to="/login" className="ce-btn ce-btn--ghost ce-nav__desk">Sign in</Link>
          <Link to="/register" className="ce-btn ce-btn--primary">Start free trial</Link>
          <button className="ce-nav__toggle" onClick={() => setMenu(m => !m)} aria-label="Menu">
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menu && (
        <div className="ce-nav__mobile">
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>
          ))}
          <a href="/login" onClick={() => setMenu(false)}>Sign in</a>
        </div>
      )}
    </nav>
  );
}

// ── Hero product preview (polished, aligned recreation of the dashboard) ──────
const KPIS = [
  { label: 'Students', val: '1,248', color: '#1a56e8', bg: '#eff6ff', chip: '+12', chipColor: '#1a56e8', chipBg: '#dbe8ff' },
  { label: 'Attendance', val: '94%', color: '#10b981', bg: '#ecfdf5', chip: '↑ 2%', chipColor: '#16a34a', chipBg: '#d1fae5' },
  { label: 'Fees · month', val: '₹18.4L', color: '#f59e0b', bg: '#fffbeb', chip: '↑ 8%', chipColor: '#d97706', chipBg: '#fef0c7' },
];
const REV = [42, 58, 47, 70, 61, 88];
const EXP = [30, 39, 34, 47, 43, 53];

function HeroVisual() {
  const max = Math.max(...REV, ...EXP);
  return (
    <div className="ce-hero__visual">
      <Reveal delay={2}>
        <div className="ce-happ">
          <div className="ce-happ__bar">
            <span className="ce-happ__brand"><span className="m"><GraduationCap size={14} /></span> CampusEngine</span>
            <span className="ce-happ__pill">This month</span>
          </div>
          <div className="ce-happ__body">
            <div className="ce-happ__kpis">
              {KPIS.map(k => (
                <div key={k.label} className="ce-kpi" style={{ background: k.bg }}>
                  <div className="ce-kpi__top">
                    <span className="ce-kpi__label">{k.label}</span>
                    <span className="ce-kpi__chip" style={{ color: k.chipColor, background: k.chipBg }}>{k.chip}</span>
                  </div>
                  <div className="ce-kpi__val" style={{ color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>
            <div className="ce-happ__charts">
              <div className="ce-happ__chart">
                <div className="ce-happ__chart-h">
                  <span className="ce-happ__chart-t">Revenue vs Expenses</span>
                  <span className="ce-legend">
                    <span><i style={{ background: '#1a56e8' }} />Revenue</span>
                    <span><i style={{ background: '#f9a8a8' }} />Expenses</span>
                  </span>
                </div>
                <div className="ce-bars">
                  {REV.map((v, i) => (
                    <span key={i} className="ce-bars__g">
                      <i style={{ height: `${(v / max) * 100}%`, background: '#1a56e8' }} />
                      <i style={{ height: `${(EXP[i] / max) * 100}%`, background: '#f9a8a8' }} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="ce-happ__chart">
                <div className="ce-happ__chart-h"><span className="ce-happ__chart-t">Fee collection</span></div>
                <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                  <Donut pct={86} size={92} color="#10b981" label="86%" sub="collected" />
                </div>
                <span className="ce-legend" style={{ justifyContent: 'center', marginTop: 10 }}>
                  <span><i style={{ background: '#10b981' }} />Collected</span>
                  <span><i style={{ background: '#e6ebf3' }} />Pending</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* refined floating widgets — edge-aligned, clear of the panel title */}
      <div className="ce-fcard ce-fcard--light ce-floaty" style={{ bottom: 28, left: -26 }}>
        <span className="ce-fcard__ic" style={{ background: '#ecfdf5' }}><TrendingUp size={16} color="#10b981" /></span>
        <div>
          <div className="ce-fcard__l">Collected today</div>
          <div className="ce-fcard__v" style={{ color: '#10b981' }}>₹1,24,500</div>
        </div>
      </div>
      <div className="ce-fcard ce-fcard--dark ce-floaty ce-floaty--slow ce-floaty--delay" style={{ top: -16, right: -10 }}>
        <span className="ce-fcard__ic" style={{ background: 'rgba(255,255,255,.1)' }}><Bell size={15} color="#fbbf24" /></span>
        <div>
          <div className="ce-fcard__l">Absentee alert</div>
          <div className="ce-fcard__v">SMS sent to 4 parents</div>
        </div>
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <header className="ce-hero">
      <div className="ce-hero__bg">
        <div className="ce-blob ce-blob--1" />
        <div className="ce-blob ce-blob--2" />
        <div className="ce-blob ce-blob--3" />
        <div className="ce-hero__grid" />
      </div>
      <div className="ce-container ce-hero__inner">
        <div className="ce-hero__copy">
          <Reveal as="span" className="ce-eyebrow">✨ The complete school operating system</Reveal>
          <Reveal as="h1" className="ce-h1" delay={1}>
            One platform to run your <span className="ce-grad-text">entire campus.</span>
          </Reveal>
          <Reveal as="p" className="ce-lead ce-hero__lead" delay={2}>
            CampusEngine unifies admissions, attendance, fees, exams, HR, library and 13 more
            modules into one beautifully simple system — so your team spends less time on
            admin and more time on students.
          </Reveal>
          <Reveal className="ce-hero__cta" delay={3}>
            <Link to="/register" className="ce-btn ce-btn--primary">Start free trial <ArrowRight size={17} /></Link>
            <a href="mailto:hello@campusengine.in" className="ce-btn ce-btn--ghost">Book a demo</a>
          </Reveal>
          <Reveal className="ce-hero__trust" delay={4}>
            <span><Check size={15} color="#10b981" /> 15-day free trial</span>
            <span><Check size={15} color="#10b981" /> No credit card</span>
            <span><Check size={15} color="#10b981" /> Setup in minutes</span>
          </Reveal>
        </div>
        <HeroVisual />
      </div>
    </header>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="ce-footer">
      <div className="ce-container">
        <div className="ce-footer__top">
          <div>
            <Logo />
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: '14px 0 0', maxWidth: 280 }}>
              {BRAND.tagline} The modern operating system for schools.
            </p>
          </div>
          {Object.entries(FOOTER).map(([title, links]) => (
            <div key={title} className="ce-footer__col">
              <h4>{title}</h4>
              {links.map(([label, href]) => (
                href.startsWith('#') || href.startsWith('mailto')
                  ? <a key={label} href={href}>{label}</a>
                  : <a key={label} href={href}>{label}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="ce-footer__bottom">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span style={{ display: 'flex', gap: 18 }}>
            <Link to="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Sign in</Link>
            <Link to="/register" style={{ color: 'inherit', textDecoration: 'none' }}>Start free trial</Link>
            <Link to="/staff-login" style={{ color: 'inherit', textDecoration: 'none' }}>Staff login</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="ce">
      <Nav />
      <Hero />
      <WhyCampusEngine />
      <ModuleShowcase />
      <HowItWorks />
      <AISection />
      <RoleExperience />
      <OperatingSystem />
      <ROISection />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
