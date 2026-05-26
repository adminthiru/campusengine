import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, School, Key, CreditCard, Bell, Plus, Trash2, Check, Upload, CalendarCheck, ListOrdered, ShieldCheck, GraduationCap, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import { PageLoader, FormRow, StatCard } from '../../components/ui';

const TABS = [
  { id: 'school',       label: 'School Profile',   icon: School },
  { id: 'grades',       label: 'Grade Config',     icon: Bell },
  { id: 'leaves',       label: 'Leave Config',     icon: CalendarCheck },
  { id: 'feeterms',     label: 'Fee Terms',        icon: ListOrdered },
  { id: 'teacherroles', label: 'Teacher Roles',    icon: ShieldCheck },
  { id: 'subscription', label: 'Subscription',     icon: CreditCard },
  { id: 'password',     label: 'Change Password',  icon: Key },
  { id: 'profile',      label: 'My Profile',       icon: SettingsIcon },
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
          {activeTab === 'school'       && isAdmin && <SchoolSettings />}
          {activeTab === 'grades'       && isAdmin && <GradeSettings />}
          {activeTab === 'leaves'       && isAdmin && <LeaveSettings />}
          {activeTab === 'feeterms'     && isAdmin && <FeeTermsSettings />}
          {activeTab === 'teacherroles' && isAdmin && <TeacherRolesSettings />}
          {activeTab === 'subscription' && isAdmin && <SubscriptionSettings />}
          {activeTab === 'password' && <PasswordSettings />}
          {activeTab === 'profile'  && <ProfileSettings />}
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
        await api.post('/school/upload-logo', form, { headers: { 'Content-Type': undefined } });
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
            <input className="form-control" type="number" min={1} max={15} {...register('periodsPerDay', { min: 1, max: 15, valueAsNumber: true })} defaultValue={school?.periodsPerDay ?? 8} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Controls the number of period columns in the Timetable module</div>
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

const DEFAULT_LEAVE_TYPES = [
  { code: 'od', label: 'On Duty',      color: '#0ea5e9', enabled: true, daysPerMonth: 0, note: 'Employee working outside school premises' },
  { code: 'cl', label: 'Casual Leave', color: '#8b5cf6', enabled: true, daysPerMonth: 1, note: 'Short-notice personal leave' },
  { code: 'sl', label: 'Sick Leave',   color: '#ec4899', enabled: true, daysPerMonth: 1, note: 'Medical / health-related absence' },
];

function Toggle({ on, color, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      background: on ? color : '#cbd5e1', position: 'relative',
      transition: 'background 0.2s', flexShrink: 0
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </button>
  );
}

function LeaveSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = data?.school;

  const [leaves, setLeaves] = useState(null);
  const [saving, setSaving] = useState(false);

  const leaveTypes = leaves ?? (
    school?.leaveTypes?.length
      ? DEFAULT_LEAVE_TYPES.map(def => {
          const saved = school.leaveTypes.find(l => l.code === def.code);
          return saved ? { ...def, ...saved } : def;
        })
      : DEFAULT_LEAVE_TYPES
  );

  const update = (code, field, value) =>
    setLeaves(leaveTypes.map(l => l.code === code ? { ...l, [field]: value } : l));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/school/leave-config', {
        leaveTypes: leaveTypes.map(({ color, note, ...rest }) => rest)
      });
      qc.invalidateQueries(['school']);
      toast.success('Leave configuration saved!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="card">
      <div style={{ marginBottom: 24 }}>
        <h2 className="text-18-bold">Leave Configuration</h2>
        <p className="text-14-regular" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Set monthly leave entitlement per employee. Disabled types won't appear in attendance marking.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {leaveTypes.map(lt => (
          <div key={lt.code} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px', borderRadius: 10,
            border: `1px solid ${lt.enabled ? lt.color + '44' : 'var(--border)'}`,
            background: lt.enabled ? lt.color + '08' : '#fafafa',
            opacity: lt.enabled ? 1 : 0.65,
            transition: 'all 0.2s'
          }}>
            {/* Badge + info */}
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              background: lt.color + '22', color: lt.color, letterSpacing: '0.05em', flexShrink: 0
            }}>{lt.code.toUpperCase()}</span>
            <div style={{ flex: 1 }}>
              <div className="text-14-semibold">{lt.label}</div>
              <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 1 }}>{lt.note}</div>
            </div>

            {/* Monthly input + yearly calculated total */}
            {lt.code !== 'od' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                {/* Per month */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Days / month</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number" min={0} step={0.5} className="form-control"
                      style={{ width: 60, textAlign: 'center', padding: '4px 6px', fontSize: 16, fontWeight: 700, color: lt.color }}
                      value={lt.daysPerMonth ?? ''}
                      placeholder="0"
                      disabled={!lt.enabled}
                      onChange={e => update(lt.code, 'daysPerMonth', Number(e.target.value))}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
                  </div>
                </div>
                {/* Arrow + yearly total */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>= Per year</label>
                  <div style={{
                    padding: '4px 14px', borderRadius: 6, background: lt.color + '18',
                    fontSize: 16, fontWeight: 700, color: lt.color, minWidth: 60, textAlign: 'center'
                  }}>
                    {(lt.daysPerMonth || 0) * 12}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ minWidth: 80, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                No limit
              </div>
            )}

            {/* Toggle */}
            <Toggle on={lt.enabled} color={lt.color} onChange={() => update(lt.code, 'enabled', !lt.enabled)} />
          </div>
        ))}
      </div>

      {/* Summary: only CL and SL (leave types with limits) */}
      {leaveTypes.some(lt => lt.enabled && lt.code !== 'od') && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {leaveTypes.filter(lt => lt.enabled && lt.code !== 'od').map(lt => (
            <div key={lt.code} style={{
              flex: 1, padding: '14px 16px', borderRadius: 10,
              background: lt.color + '10', border: `1px solid ${lt.color}33`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span className="text-14-semibold" style={{ color: lt.color }}>{lt.label}</span>
                <span style={{ fontSize: 11, background: lt.color + '22', color: lt.color, padding: '1px 7px', borderRadius: 4, fontWeight: 700 }}>
                  {lt.code.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: lt.color, lineHeight: 1 }}>
                  {lt.daysPerMonth || 0}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>days / month</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                = <strong style={{ color: lt.color }}>{(lt.daysPerMonth || 0) * 12}</strong> days / year
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Leave Config'}
      </button>
    </div>
  );
}

function FeeTermsSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = data?.school;

  const [terms, setTerms] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const currentTerms = terms ?? (school?.feeTerms?.length ? school.feeTerms : []);

  const addTerm = () => {
    const name = newName.trim();
    if (!name) return;
    if (currentTerms.some(t => t.name === name)) return toast.error('Term name already exists');
    setTerms([...currentTerms, { name }]);
    setNewName('');
  };

  const removeTerm = (name) => setTerms(currentTerms.filter(t => t.name !== name));

  const renameTerm = (idx, value) => {
    const updated = currentTerms.map((t, i) => i === idx ? { ...t, name: value } : t);
    setTerms(updated);
  };

  const save = async () => {
    if (currentTerms.some(t => !t.name.trim())) return toast.error('All term names must be filled');
    setSaving(true);
    try {
      await api.put('/school/fee-terms', { feeTerms: currentTerms.map(t => ({ name: t.name.trim() })) });
      qc.invalidateQueries(['school']);
      toast.success('Fee terms saved!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="card">
      <div style={{ marginBottom: 24 }}>
        <h2 className="text-18-bold">Fee Terms</h2>
        <p className="text-14-regular" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Define how many terms your school collects fees. These will appear when creating fee records.
        </p>
      </div>

      {/* Term list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {currentTerms.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, border: '1px dashed var(--border)', borderRadius: 8 }}>
            No terms configured. Add at least one term below.
          </div>
        )}
        {currentTerms.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', color: 'var(--primary)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <input
              className="form-control"
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '2px 4px', fontWeight: 500 }}
              value={t.name}
              onChange={e => renameTerm(i, e.target.value)}
              placeholder="Term name"
            />
            <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeTerm(t.name)} title="Remove term">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add term input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          className="form-control"
          placeholder='e.g. Term 1, Q2, Annual...'
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTerm()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary" onClick={addTerm} disabled={!newName.trim()}>
          <Plus size={14} /> Add Term
        </button>
      </div>

      {/* Example preview */}
      {currentTerms.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 24 }}>
          <div className="text-13-regular" style={{ color: '#15803d', fontWeight: 600, marginBottom: 6 }}>Preview — fee collection options</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {currentTerms.map(t => (
              <span key={t.name} style={{ padding: '3px 12px', background: '#dcfce7', color: '#166534', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{t.name}</span>
            ))}
            <span style={{ padding: '3px 12px', background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Pay All</span>
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Fee Terms'}
      </button>
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

// ─── Teacher Roles & Permissions ────────────────────────────────────────────

const CLASS_TEACHER_PERMS = [
  {
    key: 'markStudentAttendance',
    label: 'Mark Class Student Attendance',
    desc: 'Can mark daily attendance for students in their assigned class'
  },
  {
    key: 'markOwnAttendance',
    label: 'Mark Own Attendance',
    desc: 'Can mark their own daily attendance as an employee'
  },
  {
    key: 'viewStudents',
    label: 'View Students',
    desc: 'Can view students of their own class + students in classes they go to as subject teacher'
  },
  {
    key: 'viewFeeStatus',
    label: 'View Fee Status',
    desc: 'Can see the exam fee payment status of students in their assigned class'
  },
  {
    key: 'assignHomework',
    label: 'Assign Homework',
    desc: 'Can assign homework for their class students and also for subject teacher classes they are assigned to'
  },
  {
    key: 'viewAndEnterExamMarks',
    label: 'View & Enter Exam Marks',
    desc: 'Can view exam results of all subjects for their class, and enter marks for their own subject across class and subject teacher classes'
  },
  {
    key: 'viewTimetable',
    label: 'View Timetable',
    desc: 'Can view their own timetable and the class-wise overall school timetable'
  },
];

const SUBJECT_TEACHER_PERMS = [
  {
    key: 'markOwnAttendance',
    label: 'Mark Own Attendance',
    desc: 'Can mark their own daily attendance only — cannot mark student attendance'
  },
  {
    key: 'assignHomework',
    label: 'Assign Homework',
    desc: 'Can assign homework for the classes they are assigned to as a subject teacher'
  },
  {
    key: 'viewSubjectStudents',
    label: 'View Subject Class Students',
    desc: 'Can view students of the classes they go to as a subject teacher (assigned in Classes module)'
  },
  {
    key: 'enterExamMarks',
    label: 'Enter Subject Exam Marks',
    desc: 'Can enter marks for their subject across all classes assigned to them as subject teacher — can select class and enter marks'
  },
  {
    key: 'viewTimetable',
    label: 'View Timetable',
    desc: 'Can view their own timetable and the class-wise overall school timetable'
  },
];

function PermToggle({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
      background: checked ? 'var(--primary)' : '#cbd5e1',
      position: 'relative', transition: 'background 0.2s'
    }}>
      <div style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s'
      }} />
    </div>
  );
}

function PermissionCard({ icon: Icon, title, subtitle, color, bg, perms, permDefs, onChange }) {
  const enabledCount = perms ? Object.values(perms).filter(Boolean).length : 0;
  const total = permDefs.length;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', flex: '1 1 0', minWidth: 320 }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', background: bg, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color }}>{enabledCount}/{total}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>enabled</div>
        </div>
      </div>

      {/* Permission rows */}
      <div style={{ padding: '8px 0' }}>
        {permDefs.map((p, i) => {
          const isOn = perms?.[p.key] ?? true;
          return (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px',
              borderBottom: i < permDefs.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: isOn ? 'white' : '#f8fafc',
              transition: 'background 0.15s'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
              </div>
              <PermToggle checked={isOn} onChange={() => onChange(p.key, !isOn)} />
            </div>
          );
        })}
      </div>

      {/* Enable all / Disable all footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: '#f8fafc' }}>
        <button type="button" className="btn btn-secondary btn-sm"
          onClick={() => permDefs.forEach(p => onChange(p.key, true))}>
          Enable All
        </button>
        <button type="button" className="btn btn-secondary btn-sm"
          onClick={() => permDefs.forEach(p => onChange(p.key, false))}>
          Disable All
        </button>
      </div>
    </div>
  );
}

function TeacherRolesSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const school = data?.school;

  const defaultPerms = (defs, saved) => {
    const out = {};
    defs.forEach(p => { out[p.key] = saved?.[p.key] ?? true; });
    return out;
  };

  const [classTeacherPerms, setClassTeacherPerms] = useState(null);
  const [subjectTeacherPerms, setSubjectTeacherPerms] = useState(null);

  // Populate once school loads
  useState(() => {}, []); // avoid stale closure — use effect-like pattern below

  const savedCT = school?.teacherPermissions?.classTeacher;
  const savedST = school?.teacherPermissions?.subjectTeacher;

  const ctPerms = classTeacherPerms ?? defaultPerms(CLASS_TEACHER_PERMS, savedCT);
  const stPerms = subjectTeacherPerms ?? defaultPerms(SUBJECT_TEACHER_PERMS, savedST);

  const updateCT = (key, val) => setClassTeacherPerms(prev => ({ ...(prev ?? defaultPerms(CLASS_TEACHER_PERMS, savedCT)), [key]: val }));
  const updateST = (key, val) => setSubjectTeacherPerms(prev => ({ ...(prev ?? defaultPerms(SUBJECT_TEACHER_PERMS, savedST)), [key]: val }));

  const saveMutation = useMutation({
    mutationFn: () => api.put('/school', {
      teacherPermissions: { classTeacher: ctPerms, subjectTeacher: stPerms }
    }),
    onSuccess: () => { qc.invalidateQueries(['school']); toast.success('Teacher permissions saved!'); },
    onError: () => toast.error('Failed to save')
  });

  if (isLoading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Teacher Roles & Permissions</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Control what class teachers and subject teachers can access in their portal.
          Changes apply school-wide immediately after saving.
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 10,
        background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 20, alignItems: 'flex-start'
      }}>
        <ShieldCheck size={18} color="#1a56e8" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#1e40af' }}>
            <strong>Class Teacher</strong> is assigned per class in the Classes module (Class Teacher field).{' '}
          <strong>Subject Teacher</strong> is assigned via Subject Teachers mapping per class (also in Classes module).{' '}
          An employee can be both — they get class teacher access for their class and subject teacher access for other classes they visit.
          Login credentials are automatically emailed when a new employee is added.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <PermissionCard
          icon={GraduationCap}
          title="Class Teacher"
          subtitle="Manages their assigned class + teaches subjects in other classes"
          color="#1a56e8"
          bg="#f0f7ff"
          perms={ctPerms}
          permDefs={CLASS_TEACHER_PERMS}
          onChange={updateCT}
        />
        <PermissionCard
          icon={BookOpen}
          title="Subject Teacher"
          subtitle="Visits multiple classes to teach their subject — no class management access"
          color="#7c3aed"
          bg="#f5f3ff"
          perms={stPerms}
          permDefs={SUBJECT_TEACHER_PERMS}
          onChange={updateST}
        />
      </div>

      <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Saving...' : 'Save Permissions'}
      </button>
    </div>
  );
}
