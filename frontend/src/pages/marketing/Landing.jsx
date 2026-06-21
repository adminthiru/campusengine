// ============================================================================
// CampusEngine — marketing landing page.
// Public front door. "Sign in" → /login, "Start free trial" / signup → /register
// (the school-admin auth screens).
// ============================================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight, Check, GraduationCap, TrendingUp, Bell } from 'lucide-react';
import './landing.css';
import { BRAND, FOOTER, Reveal, Donut, MiniBars, AppChrome } from './_ui';
import {
  TrustBar, WhyCampusEngine, ModuleShowcase, HowItWorks, AISection,
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

// ── Hero product preview (recreated dashboard) ───────────────────────────────
function HeroVisual() {
  return (
    <div className="ce-hero__visual">
      <Reveal delay={2}>
        <AppChrome title="CampusEngine · Dashboard" style={{ boxShadow: '0 30px 80px rgba(15,23,42,.16)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['Students', '1,248', '#1a56e8', '#eff6ff'], ['Attendance', '94%', '#10b981', '#ecfdf5'], ['Fees (mo)', '₹18.4L', '#f59e0b', '#fffbeb']].map(([l, v, c, b]) => (
              <div key={l} style={{ background: b, borderRadius: 11, padding: '11px 12px' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c, letterSpacing: '-0.03em', marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10, marginTop: 10 }}>
            <div style={{ border: '1px solid #eef2f8', borderRadius: 12, padding: 13 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Revenue vs Expenses</div>
              <MiniBars data={[40, 58, 46, 70, 60, 88]} highlight={5} color="#1a56e8" height={70} />
            </div>
            <div style={{ border: '1px solid #eef2f8', borderRadius: 12, padding: 13, display: 'grid', placeItems: 'center' }}>
              <Donut pct={86} size={104} color="#10b981" label="86%" sub="collected" />
            </div>
          </div>
        </AppChrome>
      </Reveal>

      {/* floating widgets */}
      <div className="ce-floaty" style={{ position: 'absolute', top: -18, left: -14, zIndex: 2 }}>
        <div style={{ background: '#fff', border: '1px solid #e6ebf3', borderRadius: 13, boxShadow: '0 14px 34px rgba(15,23,42,.12)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: '#ecfdf5', display: 'grid', placeItems: 'center' }}><TrendingUp size={17} color="#10b981" /></span>
          <div><div style={{ fontSize: 11, color: '#64748b' }}>Collected today</div><div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>₹1,24,500</div></div>
        </div>
      </div>
      <div className="ce-floaty ce-floaty--slow ce-floaty--delay" style={{ position: 'absolute', bottom: -16, right: -10, zIndex: 2 }}>
        <div style={{ background: '#0f172a', color: '#fff', borderRadius: 13, boxShadow: '0 14px 34px rgba(15,23,42,.28)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center' }}><Bell size={16} color="#fbbf24" /></span>
          <div><div style={{ fontSize: 11, color: '#9fb0d0' }}>Absentee alert</div><div style={{ fontSize: 13, fontWeight: 700 }}>SMS sent to 4 parents</div></div>
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
      <TrustBar />
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
