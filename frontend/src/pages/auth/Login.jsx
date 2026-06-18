import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useForm, Controller } from 'react-hook-form';
import { Select } from 'antd';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, GraduationCap, TrendingUp, CheckCircle2, IndianRupee,
  Award, MessageSquare, Smartphone, CreditCard, Banknote,
} from 'lucide-react';

// ── Shared flat card style (no shadows) ──────────────────────────────────────
const card = { background: 'white', borderRadius: 14, border: '1px solid rgba(15,23,42,0.06)' };

function MiniBars() {
  const data = [42, 60, 38, 72, 55, 88, 64];
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 50, marginTop: 12 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ height: `${(v / max) * 100}%`, borderRadius: 5, background: i === 5 ? '#1a56e8' : '#dbe4f3' }} />
        </div>
      ))}
    </div>
  );
}

function Pill({ icon: Icon, color, bg, title, value, style }) {
  return (
    <div style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color={color} />
      </div>
      <div style={{ whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

function Badge({ icon: Icon, text, style }) {
  return (
    <div style={{ background: '#0f172a', color: 'white', fontSize: 11, fontWeight: 700, padding: '6px 11px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', ...style }}>
      {Icon && <Icon size={12} color="#fbbf24" />} {text}
    </div>
  );
}

// ── Slide 1: Insights / Attendance ───────────────────────────────────────────
function SlideInsights() {
  return (
    <>
      <div className="lg-float" style={{ position: 'absolute', top: '20%', left: 6, width: 286 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Today's Overview</span>
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingUp size={12} /> +8.2%</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#15803d' }}>Present</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>1,186</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#b91c1c' }}>Absent</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.5px' }}>62</div>
            </div>
          </div>
          <MiniBars />
        </div>
      </div>
      <Pill icon={CheckCircle2} color="#16a34a" bg="#dcfce7" title="Attendance Marked" value="Class 8-A · just now"
        style={{ position: 'absolute', bottom: '16%', right: 8, zIndex: 2 }} />
      <div className="lg-float d1" style={{ position: 'absolute', top: 0, left: 40 }}>
        <Badge icon={Award} text="Results Published" />
      </div>
    </>
  );
}

// ── Slide 2: Fees / Payments ─────────────────────────────────────────────────
function SlideFees() {
  return (
    <>
      <div className="lg-float" style={{ position: 'absolute', top: '20%', left: 6, width: 286 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Fee Collection</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>Term 1</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Collected</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.6px' }}>₹4,28,500</div>
          <div style={{ height: 8, borderRadius: 5, background: '#eef2f7', marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: '87%', height: '100%', background: 'linear-gradient(90deg,#1a56e8,#3b82f6)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 7 }}>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>87% collected</span>
            <span style={{ color: '#64748b' }}>Pending ₹62,000</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {[{ i: Smartphone, t: 'UPI' }, { i: CreditCard, t: 'Card' }, { i: Banknote, t: 'Cash' }].map(m => (
              <div key={m.t} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#f1f5f9', borderRadius: 8, padding: '7px 0', fontSize: 11, fontWeight: 600, color: '#475569' }}>
                <m.i size={13} /> {m.t}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Pill icon={IndianRupee} color="#16a34a" bg="#dcfce7" title="Fee Payment Received" value="+ ₹12,500"
        style={{ position: 'absolute', top: '8%', right: 14, zIndex: 2 }} />
      <Pill icon={CheckCircle2} color="#1a56e8" bg="#dbeafe" title="Receipt Sent" value="Auto · WhatsApp"
        style={{ position: 'absolute', bottom: '14%', right: 8, zIndex: 2 }} />
    </>
  );
}

// ── Slide 3: Exams / Communication ───────────────────────────────────────────
function SlideExams() {
  const subjects = [['Mathematics', 95], ['Science', 92], ['English', 88]];
  return (
    <>
      <div className="lg-float" style={{ position: 'absolute', top: '18%', left: 6, width: 286 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', color: '#1a56e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>AS</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Aarav Sharma</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Class 10 · Term 1 Result</div>
            </div>
          </div>
          {subjects.map(([s, m]) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', color: '#334155' }}>
              <span>{s}</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{m}/100</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #eef2f7' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Overall 91.6%</span>
            <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 800, padding: '3px 12px', borderRadius: 20 }}>Grade A+</span>
          </div>
        </div>
      </div>
      <Pill icon={MessageSquare} color="#1a56e8" bg="#dbeafe" title="SMS Sent" value="248 parents notified"
        style={{ position: 'absolute', bottom: '16%', right: 8, zIndex: 2 }} />
      <div className="lg-float d1" style={{ position: 'absolute', top: 4, right: 24 }}>
        <Badge icon={Award} text="Results Published" />
      </div>
    </>
  );
}

const STUDENT_RANGES = ['0 - 500', '500 - 1000', '1000 - 1500', '1500 - 2000', '2000 - 2500', '2500 - 3000', '3000+'];

const SLIDES = [
  { Widgets: SlideInsights, headline: ['Run your school,', 'effortlessly.'], sub: 'Live attendance, admissions and insights — your whole campus at a glance.' },
  { Widgets: SlideFees, headline: ['Fees, collected', 'with ease.'], sub: 'Online or cash, track every rupee, send reminders and auto-receipts.' },
  { Widgets: SlideExams, headline: ['Exams to results,', 'in minutes.'], sub: 'Enter marks, publish report cards and notify parents instantly by SMS.' },
];

export default function Login({ initialMode = 'login' }) {
  const { login, register: signupAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(initialMode);     // 'login' | 'signup'
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(1);               // signup wizard step (1 | 2)
  const loginForm = useForm({
    defaultValues: { schoolCode: params.get('code') || '', email: params.get('email') || '' },
  });
  const signupForm = useForm();

  // Auto-advance the concept carousel (pauses on hover).
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive(a => (a + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, [paused]);

  const onLogin = async (data) => {
    setLoading(true);
    try {
      const user = await login(data);
      toast.success(`Welcome back, ${user.name}!`);
      if (user.firstLogin) navigate('/settings/password?first=true');
      else navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const onSignup = async (data) => {
    setLoading(true);
    try {
      await signupAccount(data);
      toast.success('School account created! Your 15-day free trial has started.');
      navigate('/school-setup');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setMode(m); setShowPass(false); setStep(1); };
  const nextStep = async () => {
    if (await signupForm.trigger(['schoolCode', 'schoolName', 'email', 'password'])) setStep(2);
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', background: '#ffffff', padding: 22, boxSizing: 'border-box' }}>
      <style>{`
        @keyframes floaty { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-9px) } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .lg-float { animation: floaty 5s ease-in-out infinite; }
        .lg-float.d1 { animation-delay: 1.2s; }
        .lg-dots { background-image: radial-gradient(rgba(255,255,255,0.22) 1.5px, transparent 1.5px); background-size: 18px 18px; }
        /* Match antd Select to .form-control height/border */
        .ce-select .ant-select-selector { height: 43px !important; padding: 0 14px !important; border: 1.5px solid var(--border) !important; border-radius: var(--radius-md) !important; }
        .ce-select .ant-select-selection-item, .ce-select .ant-select-selection-placeholder { line-height: 40px !important; font-size: 14px; }
        .ce-select.ant-select-focused .ant-select-selector { border-color: var(--primary) !important; box-shadow: 0 0 0 3px rgba(26,86,232,0.08) !important; }
      `}</style>

      {/* ── Left: branded blue panel with auto-carousel of concepts ── */}
      <div
        className="hide-mobile"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          flex: 1.05, position: 'relative', overflow: 'hidden', borderRadius: 8,
          background: 'linear-gradient(160deg, #1d4ed8 0%, #1a56e8 50%, #1e40af 100%)',
          padding: '42px 44px', display: 'flex', flexDirection: 'column',
        }}
      >
        <div className="lg-dots" style={{ position: 'absolute', top: 26, right: 30, width: 110, height: 80, opacity: 0.8 }} />

        {/* brand */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.16)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={23} color="white" />
          </div>
          <span style={{ fontSize: 21, fontWeight: 800, color: 'white', letterSpacing: '-0.4px' }}>CampusEngine</span>
        </div>

        {/* carousel stage — fixed width so widgets cluster (don't spread across the panel) */}
        <div style={{ position: 'relative', flex: 1, width: '100%', maxWidth: 470, margin: '14px 0' }}>
          {SLIDES.map((s, i) => (
            <div key={i} style={{
              position: 'absolute', inset: 0,
              opacity: i === active ? 1 : 0,
              transform: i === active ? 'none' : 'translateY(16px)',
              transition: 'opacity .65s ease, transform .65s ease',
              pointerEvents: i === active ? 'auto' : 'none',
            }}>
              <s.Widgets />
            </div>
          ))}
        </div>

        {/* headline (changes per slide) + progress dots */}
        <div style={{ position: 'relative', minHeight: 150 }}>
          <div key={active} style={{ animation: 'slideUp .6s ease' }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1.12, letterSpacing: '-0.8px', margin: 0 }}>
              {SLIDES[active].headline[0]}<br />{SLIDES[active].headline[1]}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: '14px 0 20px', maxWidth: 380 }}>
              {SLIDES[active].sub}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setActive(i)} aria-label={`Slide ${i + 1}`} style={{
                width: i === active ? 26 : 7, height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0,
                background: i === active ? 'white' : 'rgba(255,255,255,0.4)', transition: 'width .35s ease',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: login / signup forms on plain white (toggled in place) ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div key={mode} style={{ width: '100%', maxWidth: 410, animation: 'slideUp .4s ease' }}>
          {mode === 'login' ? (
            <>
              <div style={{ marginBottom: 30 }}>
                <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.6px', margin: 0 }}>Welcome back</h2>
                <p style={{ fontSize: 15, color: '#64748b', marginTop: 7 }}>Sign in to your school portal</p>
              </div>

              <form onSubmit={loginForm.handleSubmit(onLogin)}>
                <div className="form-group">
                  <label className="form-label">School Code</label>
                  <input className="form-control" {...loginForm.register('schoolCode', { required: 'School code is required' })} placeholder="e.g. SRIVIDYA" style={{ textTransform: 'uppercase' }} />
                  {loginForm.formState.errors.schoolCode && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{loginForm.formState.errors.schoolCode.message}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-control" {...loginForm.register('email', { required: 'Email is required' })} type="email" placeholder="admin@school.com" />
                  {loginForm.formState.errors.email && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{loginForm.formState.errors.email.message}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-control" {...loginForm.register('password', { required: 'Password is required' })} type={showPass ? 'text' : 'password'} placeholder="Enter your password" style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{loginForm.formState.errors.password.message}</p>}
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }} disabled={loading}>
                  {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} />Signing in...</> : 'Sign In'}
                </button>
              </form>

              <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 22 }}>
                New to CampusEngine?{' '}
                <button type="button" onClick={() => switchMode('signup')} style={{ color: 'var(--primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14 }}>Create your school account</button>
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                Staff member? Use the login link shared by your school admin.
              </p>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.6px', margin: 0 }}>Create your account</h2>
                <p style={{ fontSize: 15, color: '#64748b', marginTop: 7 }}>Start your 15-day free trial — no card required</p>
              </div>

              {/* step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                {[1, 2].map(n => (
                  <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: step >= n ? 'white' : '#94a3b8', background: step >= n ? 'var(--primary)' : '#e2e8f0' }}>{n}</div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: step >= n ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>{n === 1 ? 'School & Login' : 'School Details'}</span>
                    {n === 1 && <div style={{ flex: 1, height: 2, background: step > 1 ? 'var(--primary)' : '#e2e8f0', borderRadius: 2 }} />}
                  </div>
                ))}
              </div>

              <form onSubmit={signupForm.handleSubmit(onSignup)} onKeyDown={(e) => { if (e.key === 'Enter' && step === 1) { e.preventDefault(); nextStep(); } }}>
                {step === 1 ? (
                  <div key="s1" style={{ animation: 'slideUp .35s ease' }}>
                    <div className="form-group">
                      <label className="form-label">School Code</label>
                      <input className="form-control" {...signupForm.register('schoolCode', { required: 'School code is required', minLength: { value: 3, message: 'Minimum 3 characters' } })} placeholder="e.g. SRIVIDYA" style={{ textTransform: 'uppercase' }} />
                      {signupForm.formState.errors.schoolCode && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.schoolCode.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">School Name</label>
                      <input className="form-control" {...signupForm.register('schoolName', { required: 'School name is required', minLength: { value: 3, message: 'Minimum 3 characters' } })} placeholder="e.g. Sri Vidya Mandir School" />
                      {signupForm.formState.errors.schoolName && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.schoolName.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(used to sign in)</span></label>
                      <input className="form-control" {...signupForm.register('email', { required: 'Email is required', pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: 'Enter a valid email' } })} type="email" placeholder="admin@school.com" />
                      {signupForm.formState.errors.email && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <div style={{ position: 'relative' }}>
                        <input className="form-control" {...signupForm.register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })} type={showPass ? 'text' : 'password'} placeholder="Create a strong password" style={{ paddingRight: 44 }} />
                        <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {signupForm.formState.errors.password && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.password.message}</p>}
                    </div>

                    <button type="button" onClick={nextStep} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                      Continue →
                    </button>
                  </div>
                ) : (
                  <div key="s2" style={{ animation: 'slideUp .35s ease' }}>
                    <div className="form-group">
                      <label className="form-label">Number of Students</label>
                      <Controller
                        name="studentsRange"
                        control={signupForm.control}
                        rules={{ required: 'Please select your school size' }}
                        render={({ field }) => (
                          <Select
                            {...field}
                            className="ce-select"
                            placeholder="Select student strength"
                            style={{ width: '100%' }}
                            options={STUDENT_RANGES.map(r => ({ value: r, label: `${r} students` }))}
                          />
                        )}
                      />
                      {signupForm.formState.errors.studentsRange && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.studentsRange.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Admin Phone Number</label>
                      <input className="form-control" {...signupForm.register('phone', { required: 'Phone is required', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number' } })} placeholder="9876543210" maxLength={10} />
                      {signupForm.formState.errors.phone && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.phone.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">School Location</label>
                      <input className="form-control" {...signupForm.register('location', { required: 'Location is required' })} placeholder="City / Town" />
                      {signupForm.formState.errors.location && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{signupForm.formState.errors.location.message}</p>}
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="button" onClick={() => setStep(1)} className="btn btn-secondary btn-lg" style={{ justifyContent: 'center' }}>← Back</button>
                      <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
                        {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} />Creating...</> : 'Start Free Trial'}
                      </button>
                    </div>
                  </div>
                )}
              </form>

              <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 22 }}>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')} style={{ color: 'var(--primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14 }}>Sign in</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
