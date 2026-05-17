import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, BookOpen, Users, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, EmptyState, PageLoader, FormRow, StatusBadge } from '../../components/ui';

export function Classes() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: empData } = useQuery({ queryKey: ['employees-teachers'], queryFn: () => api.get('/employees?role=teacher&limit=100') });
  const teachers = empData?.employees || [];

  const { data, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes')
  });
  const classes = data?.classes || [];

  const createMutation = useMutation({
    mutationFn: (d) => editClass ? api.put(`/classes/${editClass._id}`, d) : api.post('/classes', d),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success(editClass ? 'Class updated!' : 'Class added!'); setShowModal(false); reset(); setEditClass(null); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/classes/${id}`),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success('Class removed'); }
  });

  const currentAcademicYear = () => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 5 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
  };

  const openEdit = (cls) => {
    setEditClass(cls);
    reset({
      name: cls.name, section: cls.section, capacity: cls.capacity,
      classTeacher: cls.classTeacher?._id || '', room: cls.room,
      academicYear: cls.academicYear,
      'fees.yearly': cls.fees?.yearly, 'fees.monthly': cls.fees?.monthly,
      'fees.feeType': cls.fees?.feeType || 'yearly', 'fees.lateFee': cls.fees?.lateFee
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">{classes.length} classes configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditClass(null); reset(); setShowModal(true); }}>
          <Plus size={16} /> Add Class
        </button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid-3">
          {classes.length === 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="card">
                <EmptyState icon={BookOpen} message="No classes yet. Create your first class!"
                  action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Class</button>} />
              </div>
            </div>
          )}
          {classes.map(cls => (
            <div key={cls._id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div className="text-20-bold" style={{ color: 'var(--primary)' }}>
                    {cls.name}
                    <span style={{ fontSize: 14, background: '#eff6ff', padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>{cls.section}</span>
                  </div>
                  {cls.classTeacher && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Teacher: {cls.classTeacher.name}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(cls)}><Edit size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(cls._id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>STUDENTS</div>
                  <div style={{ fontWeight: 600 }}>{cls.studentCount || 0} / {cls.capacity}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>ROOM</div>
                  <div style={{ fontWeight: 600 }}>{cls.room || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>FEE TYPE</div>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{cls.fees?.feeType || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>FEE AMT</div>
                  <div style={{ fontWeight: 600 }}>₹{(cls.fees?.yearly || cls.fees?.monthly || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditClass(null); reset(); }}
        title={editClass ? 'Edit Class' : 'Add Class'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditClass(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => {
            if (!d.classTeacher) delete d.classTeacher;
            createMutation.mutate(d);
          })}>
            {createMutation.isLoading ? 'Saving...' : editClass ? 'Update Class' : 'Add Class'}
          </button>
        </>}>
        <form>
          <FormRow cols={3}>
            <div className="form-group">
              <label className="form-label">Class Name *</label>
              <input className="form-control" {...register('name', { required: 'Required' })} placeholder="e.g. Grade 10, Class 10, Std X" />
              {errors.name && <p style={{ color: '#ef4444', fontSize: 12 }}>{errors.name.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Section *</label>
              <input className="form-control" {...register('section', { required: 'Required' })} placeholder="e.g. A, B, C" />
              {errors.section && <p style={{ color: '#ef4444', fontSize: 12 }}>{errors.section.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year *</label>
              <input className="form-control" {...register('academicYear', { required: 'Required' })} placeholder="e.g. 2025-26" defaultValue={currentAcademicYear()} />
              {errors.academicYear && <p style={{ color: '#ef4444', fontSize: 12 }}>{errors.academicYear.message}</p>}
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Class Teacher</label>
              <select className="form-control" {...register('classTeacher')}>
                <option value="">Select teacher</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <input className="form-control" type="number" {...register('capacity')} defaultValue={40} />
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Room No / Name</label>
              <input className="form-control" {...register('room')} placeholder="e.g. Room 101" />
            </div>
            <div className="form-group">
              <label className="form-label">Fee Type</label>
              <select className="form-control" {...register('fees.feeType')}>
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
                <option value="installment">Installment</option>
              </select>
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Yearly Fee (₹)</label>
              <input className="form-control" type="number" {...register('fees.yearly')} />
            </div>
            <div className="form-group">
              <label className="form-label">Late Fee per Day (₹)</label>
              <input className="form-control" type="number" {...register('fees.lateFee')} defaultValue={0} />
            </div>
          </FormRow>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Remove Class" message="This will deactivate the class." danger />
    </div>
  );
}

export function Subjects() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const { data: empData } = useQuery({ queryKey: ['employees-teachers'], queryFn: () => api.get('/employees?role=teacher&limit=100') });
  const classes = classData?.classes || [];
  const teachers = empData?.employees || [];

  const { data, isLoading } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/subjects') });
  const subjects = data?.subjects || [];

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/subjects', d),
    onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject added!'); setShowModal(false); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/subjects/${id}`),
    onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject removed'); }
  });

  const SUBJECT_COLORS = ['#1a56e8','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#ec4899','#14b8a6'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { reset(); setShowModal(true); }}>
          <Plus size={16} /> Add Subject
        </button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid-3">
          {subjects.length === 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="card">
                <EmptyState icon={BookOpen} message="No subjects yet." action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Subject</button>} />
              </div>
            </div>
          )}
          {subjects.map((sub, idx) => (
            <div key={sub._id} className="card" style={{ padding: 20, borderLeft: `4px solid ${sub.color || SUBJECT_COLORS[idx % 8]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div className="text-16-bold">{sub.name}</div>
                  {sub.code && <span className="badge badge-secondary" style={{ marginTop: 4 }}>{sub.code}</span>}
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(sub._id)}><Trash2 size={14} /></button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                <span>Max: {sub.maxMarks}</span>
                <span>Pass: {sub.passingMarks}</span>
                <span style={{ textTransform: 'capitalize' }}>{sub.type}</span>
              </div>
              {sub.teacher && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Teacher: {sub.teacher.name}</div>}
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sub.classes?.slice(0, 4).map(c => <span key={c._id} className="badge badge-info" style={{ fontSize: 11 }}>{c.name} {c.section}</span>)}
                {sub.classes?.length > 4 && <span className="badge badge-secondary" style={{ fontSize: 11 }}>+{sub.classes.length - 4}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Subject"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => {
            if (!d.teacher) delete d.teacher;
            if (!d.code) delete d.code;
            d.classes = Array.isArray(d.classes) ? d.classes : (d.classes ? [d.classes] : []);
            createMutation.mutate(d);
          })}>
            {createMutation.isLoading ? 'Saving...' : 'Add Subject'}
          </button>
        </>}>
        <form>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Subject Name *</label>
              <input className="form-control" {...register('name', { required: 'Required' })} placeholder="e.g. Mathematics" />
              {errors.name && <p style={{ color: '#ef4444', fontSize: 12 }}>{errors.name.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Subject Code</label>
              <input className="form-control" {...register('code')} placeholder="e.g. MATH01" />
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-control" {...register('type')}>
                <option value="theory">Theory</option>
                <option value="practical">Practical</option>
                <option value="both">Theory + Practical</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assign to Teacher</label>
              <select className="form-control" {...register('teacher')}>
                <option value="">Select teacher</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Max Marks</label>
              <input className="form-control" type="number" {...register('maxMarks')} defaultValue={100} />
            </div>
            <div className="form-group">
              <label className="form-label">Passing Marks</label>
              <input className="form-control" type="number" {...register('passingMarks')} defaultValue={35} />
            </div>
          </FormRow>
          <div className="form-group">
            <label className="form-label">Assign to Classes</label>
            <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {classes.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No classes available</span>
              ) : classes.map(c => (
                <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" {...register('classes')} value={c._id} />
                  {c.name} {c.section}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SUBJECT_COLORS.map(c => (
                <label key={c} style={{ cursor: 'pointer' }}>
                  <input type="radio" {...register('color')} value={c} style={{ display: 'none' }} />
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer' }} />
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Remove Subject" message="This will deactivate the subject." danger />
    </div>
  );
}
