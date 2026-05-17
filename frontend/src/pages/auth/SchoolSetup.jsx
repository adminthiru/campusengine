import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Building2, MapPin, Phone, Cpu, Clock, ChevronRight, ChevronLeft, Check } from 'lucide-react';

const steps = [
  { title: 'School Info', icon: Building2 },
  { title: 'Address & Contact', icon: MapPin },
  { title: 'Academic Setup', icon: Clock },
  { title: 'Finish', icon: Check },
];

export default function SchoolSetup() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    defaultValues: {
      board: 'State Board',
      periodsPerDay: 8,
      periodDuration: 45,
      schoolStartTime: '08:00',
      language: 'en',
      'academicYear.current': `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      'academicYear.startMonth': 6,
      'academicYear.endMonth': 3,
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/school/setup', data);
      updateUser({ school: { ...user?.school, profileCompleted: true, name: data.name } });
      toast.success('School setup complete! 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 700 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 className="text-30-bold" style={{ marginBottom: 8 }}>Setup Your School</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Complete your school profile to get started</p>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, gap: 0 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? 'var(--primary)' : i === step ? 'var(--primary)' : 'white',
                border: `2px solid ${i <= step ? 'var(--primary)' : 'var(--border)'}`,
                color: i <= step ? 'white' : 'var(--text-muted)',
                transition: 'all 0.3s', flexShrink: 0
              }}>
                {i < step ? <Check size={16} /> : <s.icon size={16} />}
              </div>
              <div style={{ display: i < steps.length - 1 ? 'block' : 'none', width: 80, height: 2, background: i < step ? 'var(--primary)' : 'var(--border)', transition: 'background 0.3s' }} />
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="text-20-bold" style={{ marginBottom: 24 }}>
            {steps[step].title}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 0: School Info */}
            {step === 0 && (
              <div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">School Name *</label>
                    <input className="form-control" {...register('name', { required: 'Required' })} defaultValue={user?.school?.name} />
                    {errors.name && <p className="text-12-regular" style={{ color: '#ef4444', marginTop: 4 }}>{errors.name.message}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Affiliation Number</label>
                    <input className="form-control" {...register('affiliationNumber')} placeholder="e.g. CBSE1234567" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Board / Syllabus *</label>
                    <select className="form-control" {...register('board')}>
                      {['CBSE', 'ICSE', 'State Board', 'IB', 'Other'].map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Established Year</label>
                    <input className="form-control" type="number" {...register('establishedYear')} placeholder="1990" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Principal Name</label>
                    <input className="form-control" {...register('principalName')} placeholder="Mr. / Mrs." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Language Preference</label>
                    <select className="form-control" {...register('language')}>
                      <option value="en">English</option>
                      <option value="ta">Tamil</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Address */}
            {step === 1 && (
              <div>
                <div className="form-group">
                  <label className="form-label">Street Address *</label>
                  <input className="form-control" {...register('address.street', { required: 'Required' })} placeholder="123, School Street" />
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input className="form-control" {...register('address.city', { required: 'Required' })} placeholder="Chennai" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input className="form-control" {...register('address.state')} placeholder="Tamil Nadu" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pincode</label>
                    <input className="form-control" {...register('address.pincode')} placeholder="600001" maxLength={6} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input className="form-control" {...register('phone', { required: 'Required' })} placeholder="044-12345678" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" {...register('email')} placeholder="school@domain.com" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input className="form-control" {...register('website')} placeholder="https://yourschool.com" />
                </div>
              </div>
            )}

            {/* Step 2: Academic */}
            {step === 2 && (
              <div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Academic Year *</label>
                    <input className="form-control" {...register('academicYear.current')} placeholder="2024-2025" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">School Start Time</label>
                    <input className="form-control" type="time" {...register('schoolStartTime')} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Periods Per Day</label>
                    <input className="form-control" type="number" {...register('periodsPerDay')} min={1} max={12} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Period Duration (mins)</label>
                    <input className="form-control" type="number" {...register('periodDuration')} min={30} max={120} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Working Days</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['monday','tuesday','wednesday','thursday','friday','saturday'].map(day => (
                      <label key={day} className="text-14-medium" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', textTransform: 'capitalize' }}>
                        <input type="checkbox" defaultChecked={day !== 'saturday'} {...register(`workingDays.${day}`)} />
                        {day.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Default Grade Configuration</label>
                  <div className="text-14-regular" style={{ background: '#f8fafc', padding: 14, borderRadius: 10, color: 'var(--text-secondary)' }}>
                    Standard % → Grade mapping will be applied: A+ (90-100), A (80-89), B+ (70-79), B (60-69), C (50-59), D (40-49), F (below 40). You can customize this in Settings.
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Finish */}
            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 80, height: 80, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Check size={36} color="#16a34a" />
                </div>
                <h3 className="text-24-bold" style={{ marginBottom: 8 }}>You're all set!</h3>
                <p className="text-16-regular" style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
                  Your school profile is complete. Click "Finish Setup" to go to your dashboard.
                </p>
                <div className="text-14-regular" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, textAlign: 'left' }}>
                  <strong style={{ color: 'var(--primary)' }}>Next steps:</strong>
                  <ol style={{ marginTop: 8, paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 2 }}>
                    <li>Add your classes & sections</li>
                    <li>Add subjects for each class</li>
                    <li>Add employees (teachers, staff)</li>
                    <li>Enroll students</li>
                    <li>Set up timetable</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-secondary" onClick={prevStep} disabled={step === 0}>
                <ChevronLeft size={16} /> Back
              </button>
              {step < steps.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={nextStep}>
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                  {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} />Saving...</> : 'Finish Setup →'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
