import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { School, CheckCircle } from 'lucide-react';

export default function Register() {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authRegister(data);
      toast.success('School registered! 15-day free trial started.');
      navigate('/school-setup');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a56e8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 500, background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ background: 'linear-gradient(160deg, #1a56e8, #0f172a)', padding: '32px 40px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <School size={32} color="white" />
          </div>
          <h2 className="text-24-bold" style={{ color: 'white' }}>Register Your School</h2>
          <p className="text-14-regular" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Start your 15-day free trial today</p>
        </div>

        <div style={{ padding: 40 }}>
          {/* Trial highlights */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
            <div className="text-14-semibold" style={{ color: '#16a34a', marginBottom: 6 }}>✅ What you get:</div>
            {['15-day free trial', 'All features unlocked', '₹200/month after trial', 'Cancel anytime'].map(f => (
              <div key={f} className="text-12-regular" style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <CheckCircle size={12} />{f}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label className="form-label">School Name *</label>
              <input
                className="form-control"
                {...register('schoolName', { required: 'School name is required', minLength: { value: 3, message: 'Minimum 3 characters' } })}
                placeholder="e.g. Sri Vidya Mandir School"
              />
              {errors.schoolName && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.schoolName.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Admin Name *</label>
              <input
                className="form-control"
                {...register('adminName', { required: 'Admin name is required' })}
                placeholder="Your full name"
              />
              {errors.adminName && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.adminName.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                className="form-control"
                type="email"
                {...register('email', { required: 'Email is required' })}
                placeholder="admin@school.com"
              />
              {errors.email && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                className="form-control"
                {...register('phone', { required: 'Phone is required', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter valid 10-digit Indian mobile number' } })}
                placeholder="9876543210"
                maxLength={10}
              />
              {errors.phone && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.phone.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                className="form-control"
                type="password"
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })}
                placeholder="Create a strong password"
              />
              {errors.password && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} />Creating Account...</> : 'Start Free Trial →'}
            </button>
          </form>

          <p className="text-14-regular" style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)' }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
