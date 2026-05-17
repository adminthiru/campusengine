import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Eye, EyeOff, School, GraduationCap } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const user = await login({ ...data, isSuperAdmin });
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'super_admin') navigate('/super-admin');
      else if (user.firstLogin) navigate('/settings/password?first=true');
      else navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a56e8 100%)',
      alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      {/* Background circles */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'rgba(26,86,232,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      </div>

      <div style={{ display: 'flex', width: '100%', maxWidth: 900, background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.3)' }}>
        {/* Left panel */}
        <div style={{
          flex: 1, background: 'linear-gradient(160deg, #1a56e8, #0f172a)', padding: '50px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0
        }} className="hide-mobile">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
              <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School size={28} color="white" />
              </div>
              <span className="text-24-bold" style={{ color: 'white' }}>School ERP</span>
            </div>
            <h2 className="text-32-regular" style={{ color: 'white', marginBottom: 16 }}>
              Complete School Management System
            </h2>
            <p className="text-16-regular" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Manage students, staff, fees, attendance, exams and more — all in one powerful platform designed for Indian schools.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['Students', 'Attendance', 'Fees', 'Salary', 'Exams', 'SMS Alerts'].map(f => (
              <div key={f} className="text-14-regular" style={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, background: '#60a5fa', borderRadius: '50%' }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 32 }}>
            <h2 className="text-24-bold" style={{ marginBottom: 6 }}>Welcome back</h2>
            <p className="text-16-regular" style={{ color: 'var(--text-secondary)' }}>Sign in to your school portal</p>
          </div>

          {/* Admin type toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button
              onClick={() => setIsSuperAdmin(false)}
              className="text-14-semibold"
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: !isSuperAdmin ? 'white' : 'transparent',
                color: !isSuperAdmin ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: !isSuperAdmin ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >School Login</button>
            <button
              onClick={() => setIsSuperAdmin(true)}
              className="text-14-semibold"
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: isSuperAdmin ? 'white' : 'transparent',
                color: isSuperAdmin ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: isSuperAdmin ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >Super Admin</button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {!isSuperAdmin && (
              <div className="form-group">
                <label className="form-label">School Code (optional)</label>
                <input className="form-control" {...register('schoolCode')} placeholder="e.g. SRI12345" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-control"
                {...register('email', { required: 'Email is required' })}
                type="email" placeholder="admin@school.com"
              />
              {errors.email && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.email.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  {...register('password', { required: 'Password is required' })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} />Signing in...</> : 'Sign In'}
            </button>
          </form>

          <p className="text-14-regular" style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-secondary)' }}>
            New school?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
