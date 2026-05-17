import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, School, Key, CreditCard, Bell, Plus, Trash2, Check, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import { PageLoader, FormRow, StatCard } from '../../components/ui';

const TABS = [
  { id: 'school', label: 'School Profile', icon: School },
  { id: 'grades', label: 'Grade Config', icon: Bell },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'password', label: 'Change Password', icon: Key },
  { id: 'profile', label: 'My Profile', icon: SettingsIcon },
];

export default function Settings() {
  const [params] = useSearchParams();
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'school');
  const { user } = useAuth();

  const isAdmin = ['admin', 'correspondent', 'principal'].includes(user?.role);

  const visibleTabs = isAdmin ? TABS : TABS.filter(t => ['password', 'profile'].includes(t.id));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Sidebar tabs */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div className="card" style={{ padding: 8 }}>
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id ? 'text-14-semibold' : 'text-14-regular'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 14px', border: 'none', background: activeTab === tab.id ? '#eff6ff' : 'none',
                    color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.15s', textAlign: 'left'
                  }}>
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'school' && isAdmin && <SchoolSettings />}
          {activeTab === 'grades' && isAdmin && <GradeSettings />}
          {activeTab === 'subscription' && isAdmin && <SubscriptionSettings />}
          {activeTab === 'password' && <PasswordSettings />}
          {activeTab === 'profile' && <ProfileSettings />}
        </div>
      </div>
    </div>
  );
}

function SchoolSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = data?.school;
  const { register, handleSubmit } = useForm();
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (d) => {
    setSaving(true);
    try {
      if (logoFile) {
        const form = new FormData();
        form.append('logo', logoFile);
        await api.post('/school/upload-logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await api.put('/school', d);
      qc.invalidateQueries(['school']);
      toast.success('School settings saved!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="card">
      <h2 className="text-18-bold" style={{ marginBottom: 24 }}>School Profile</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Logo upload */}
        <div className="form-group">
          <label className="form-label">School Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, border: '2px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {school?.logo ? <img src={school.logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <School size={28} color="var(--text-muted)" />}
            </div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Upload Logo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setLogoFile(e.target.files[0])} />
            </label>
          </div>
        </div>

        <FormRow>
          <div className="form-group">
            <label className="form-label">School Name</label>
            <input className="form-control" {...register('name')} defaultValue={school?.name} />
          </div>
          <div className="form-group">
            <label className="form-label">Board / Syllabus</label>
            <select className="form-control" {...register('board')} defaultValue={school?.board}>
              {['CBSE','ICSE','State Board','IB','Other'].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
        </FormRow>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Principal Name</label>
            <input className="form-control" {...register('principalName')} defaultValue={school?.principalName} />
          </div>
          <div className="form-group">
            <label className="form-label">Affiliation No.</label>
            <input className="form-control" {...register('affiliationNumber')} defaultValue={school?.affiliationNumber} />
          </div>
        </FormRow>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" {...register('phone')} defaultValue={school?.phone} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" {...register('email')} defaultValue={school?.email} />
          </div>
        </FormRow>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="form-control" {...register('address.street')} defaultValue={school?.address?.street} placeholder="Street" style={{ marginBottom: 8 }} />
          <FormRow>
            <input className="form-control" {...register('address.city')} defaultValue={school?.address?.city} placeholder="City" />
            <input className="form-control" {...register('address.state')} defaultValue={school?.address?.state} placeholder="State" />
            <input className="form-control" {...register('address.pincode')} defaultValue={school?.address?.pincode} placeholder="Pincode" maxLength={6} />
          </FormRow>
        </div>
        <FormRow>
          <div className="form-group">
            <label className="form-label">Periods Per Day</label>
            <input className="form-control" type="number" {...register('periodsPerDay')} defaultValue={school?.periodsPerDay} />
          </div>
          <div className="form-group">
            <label className="form-label">Language (SMS)</label>
            <select className="form-control" {...register('language')} defaultValue={school?.language}>
              <option value="en">English</option>
              <option value="ta">Tamil</option>
            </select>
          </div>
        </FormRow>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

function GradeSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = data?.school;
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      system: 'percentage',
      grades: school?.gradeConfig?.grades || [
        { label: 'A+', minScore: 90, maxScore: 100, gpa: 10, remarks: 'Outstanding' },
        { label: 'A', minScore: 80, maxScore: 89, gpa: 9, remarks: 'Excellent' },
        { label: 'B+', minScore: 70, maxScore: 79, gpa: 8, remarks: 'Very Good' },
        { label: 'B', minScore: 60, maxScore: 69, gpa: 7, remarks: 'Good' },
        { label: 'C', minScore: 50, maxScore: 59, gpa: 6, remarks: 'Average' },
        { label: 'D', minScore: 40, maxScore: 49, gpa: 5, remarks: 'Below Average' },
        { label: 'F', minScore: 0, maxScore: 39, gpa: 0, remarks: 'Fail' },
      ]
    }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'grades' });

  const onSubmit = async (d) => {
    try {
      await api.put('/school/grade-config', d);
      qc.invalidateQueries(['school']);
      toast.success('Grade config saved!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 className="text-18-bold">Grade Configuration</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ label: '', minScore: 0, maxScore: 0, gpa: 0, remarks: '' })}>
          <Plus size={14} /> Add Grade
        </button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Grading System</label>
          <select className="form-control" {...register('system')} style={{ maxWidth: 200 }}>
            <option value="percentage">Percentage</option>
            <option value="gpa">GPA</option>
            <option value="letter">Letter Grade</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'left' }}>Grade Label</th>
                <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'left' }}>Min Score (%)</th>
                <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'left' }}>Max Score (%)</th>
                <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'left' }}>GPA</th>
                <th className="text-12-regular" style={{ padding: '8px 12px', textAlign: 'left' }}>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={field.id}>
                  <td style={{ padding: '4px 8px' }}><input className="form-control" {...register(`grades.${i}.label`)} placeholder="A+" style={{ maxWidth: 80 }} /></td>
                  <td style={{ padding: '4px 8px' }}><input className="form-control" type="number" {...register(`grades.${i}.minScore`)} style={{ maxWidth: 90 }} /></td>
                  <td style={{ padding: '4px 8px' }}><input className="form-control" type="number" {...register(`grades.${i}.maxScore`)} style={{ maxWidth: 90 }} /></td>
                  <td style={{ padding: '4px 8px' }}><input className="form-control" type="number" step="0.1" {...register(`grades.${i}.gpa`)} style={{ maxWidth: 80 }} /></td>
                  <td style={{ padding: '4px 8px' }}><input className="form-control" {...register(`grades.${i}.remarks`)} placeholder="e.g. Excellent" /></td>
                  <td style={{ padding: '4px 8px' }}><button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => remove(i)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit" className="btn btn-primary">Save Grade Config</button>
      </form>
    </div>
  );
}

function SubscriptionSettings() {
  const { user, updateUser } = useAuth();
  const sub = user?.subscription;
  const now = new Date();
  const trialEnd = sub?.trialEndDate ? new Date(sub.trialEndDate) : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0;

  const handleSubscribe = async () => {
    try {
      const res = await api.post('/subscription/create-order');
      const { order, key } = res;
      const options = {
        key,
        amount: order.amount,
        currency: 'INR',
        name: 'School ERP',
        description: 'Monthly Subscription',
        order_id: order.id,
        handler: async (response) => {
          await api.post('/subscription/verify', {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          });
          toast.success('Subscription activated!');
          updateUser({ subscription: { ...sub, status: 'active' } });
        },
        theme: { color: '#1a56e8' }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error('Failed to initiate payment');
    }
  };

  return (
    <div className="card">
      <h2 className="text-18-bold" style={{ marginBottom: 24 }}>Subscription</h2>
      
      <div style={{ background: sub?.status === 'active' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${sub?.status === 'active' ? '#bbf7d0' : '#fde68a'}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="text-16-bold" style={{ textTransform: 'capitalize', color: sub?.status === 'active' ? '#16a34a' : '#92400e' }}>
              {sub?.status === 'active' ? '✅ Active Subscription' : sub?.status === 'trial' ? `⏱ Trial (${daysLeft} days left)` : '❌ Subscription Expired'}
            </div>
            <div className="text-14-regular" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
              {sub?.status === 'trial' && trialEnd && `Trial ends: ${trialEnd.toLocaleDateString('en-IN')}`}
              {sub?.status === 'active' && sub?.currentPeriodEnd && `Renews: ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}`}
            </div>
          </div>
          <span className="text-24-bold" style={{ color: '#1a56e8' }}>₹200<span className="text-12-regular" style={{ color: 'var(--text-secondary)' }}>/month</span></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {['All Features Unlocked', 'SMS Notifications', 'PDF Generation', 'Unlimited Students', 'Multi-role Access', 'Priority Support'].map(f => (
          <div key={f} className="text-14-regular" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Check size={14} color="#10b981" />
            <span>{f}</span>
          </div>
        ))}
      </div>

      {sub?.status !== 'active' && (
        <button onClick={handleSubscribe} className="btn btn-primary btn-lg">
          <CreditCard size={16} /> Subscribe Now — ₹200/month
        </button>
      )}
      {sub?.status === 'active' && (
        <p className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>Your subscription is active. For billing queries, contact support.</p>
      )}
    </div>
  );
}

function PasswordSettings() {
  const [searchParams] = useSearchParams();
  const isFirst = searchParams.get('first') === 'true';
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (d) => {
    if (d.newPassword !== d.confirmPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/change-password', { currentPassword: d.currentPassword, newPassword: d.newPassword });
      toast.success('Password changed successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 className="text-18-bold" style={{ marginBottom: 8 }}>Change Password</h2>
      {isFirst && (
        <div className="text-14-regular" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#92400e' }}>
          ⚠️ This is your first login. Please change your temporary password.
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Current Password *</label>
          <input className="form-control" type="password" {...register('currentPassword', { required: 'Required' })} />
          {errors.currentPassword && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.currentPassword.message}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">New Password *</label>
          <input className="form-control" type="password" {...register('newPassword', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
          {errors.newPassword && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.newPassword.message}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">Confirm New Password *</label>
          <input className="form-control" type="password" {...register('confirmPassword', { required: 'Required' })} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}

function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const { register, handleSubmit } = useForm();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (d) => {
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', d);
      updateUser(res.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 className="text-18-bold" style={{ marginBottom: 24 }}>My Profile</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-control" {...register('name')} defaultValue={user?.name} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-control" {...register('phone')} defaultValue={user?.phone} />
        </div>
        <div className="form-group">
          <label className="form-label">SMS Language</label>
          <select className="form-control" {...register('language')} defaultValue={user?.language}>
            <option value="en">English</option>
            <option value="ta">Tamil</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
}
