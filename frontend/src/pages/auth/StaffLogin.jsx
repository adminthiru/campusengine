import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Eye, EyeOff, School, Lock, LogIn } from 'lucide-react';
import { MODULES } from '../../config/modules';

// A dedicated, identity-locked login page reached via the share link generated
// when a staff login is created. It always renders the login form (even if some
// other account is already signed in on this browser) and pins the email + school
// code so the link is specific to that staff member.
export default function StaffLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  // `id` = the login identifier (email / admission number / mobile). `email` kept
  // for backward-compatibility with earlier staff links.
  const lockedId = params.get('id') || params.get('email') || '';
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: lockedId, schoolCode: code },
  });

  const firstModulePath = (u) => {
    const m = MODULES.find(mm => u?.permissions?.[mm.key]?.view);
    return m ? m.path : '/settings/profile';
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const u = await login({ email: lockedId || data.email, schoolCode: code || data.schoolCode, password: data.password });
      toast.success(`Welcome, ${u.name}!`);
      if (u.firstLogin) navigate('/settings/password?first=true');
      else if (u.accessType === 'custom' || u.role === 'staff') navigate(firstModulePath(u));
      else navigate('/');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  const alreadySignedIn = !!user && user.email !== lockedId;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a56e8 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(160deg, #1a56e8, #0f172a)', padding: '28px 32px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <School size={22} color="white" />
            </div>
            <span className="text-18-semibold" style={{ color: 'white' }}>App Sign In</span>
          </div>
          <p className="text-14-regular" style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            Sign in to your school portal with the credentials shared with you.
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: '28px 32px' }}>
          {alreadySignedIn && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', marginBottom: 18, fontSize: 12.5, color: '#92400e' }}>
              You’re currently signed in as <strong>{user.email}</strong>. Signing in here will switch this browser to the staff account.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {code ? (
              <div className="form-group">
                <label className="form-label">School Code</label>
                <input className="form-control" value={code} readOnly disabled style={{ background: '#f8fafc', color: 'var(--text-secondary)' }} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">School Code</label>
                <input className="form-control" {...register('schoolCode')} placeholder="e.g. SRI12345" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Login ID {lockedId && <Lock size={11} color="var(--text-muted)" />}
              </label>
              {lockedId ? (
                <input className="form-control" value={lockedId} readOnly disabled style={{ background: '#f8fafc', color: 'var(--text-secondary)', fontWeight: 600 }} />
              ) : (
                <input className="form-control" {...register('email', { required: 'Login ID is required' })} placeholder="Email / admission no. / mobile" />
              )}
              {errors.email && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-control" type={showPass ? 'text' : 'password'} autoFocus
                  {...register('password', { required: 'Password is required' })}
                  placeholder="Enter your password" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }} disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Signing in...</> : <><LogIn size={17} /> Sign In</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
