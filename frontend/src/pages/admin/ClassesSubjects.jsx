import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, BookOpen, Users, Edit, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, EmptyState, PageLoader, FormRow, StatusBadge, Select } from '../../components/ui';

const CLASS_ORDER_KEY = 'sklproj_class_order';

export function Classes() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [orderedClasses, setOrderedClasses] = useState([]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const defaultClassValues = { name: '', section: '', capacity: 40, classTeacher: '', room: '', 'fees.feeType': 'yearly', 'fees.yearly': '', 'fees.lateFee': 0 };
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: defaultClassValues });

  const { data: empData } = useQuery({ queryKey: ['employees-teachers'], queryFn: () => api.get('/employees?role=teacher&limit=100') });
  const teachers = empData?.employees || [];

  const { data: subjectsData } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/subjects') });
  const allSubjects = subjectsData?.subjects || [];

  const { data, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes')
  });

  const createMutation = useMutation({
    mutationFn: (d) => editClass ? api.put(`/classes/${editClass._id}`, d) : api.post('/classes', d),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success(editClass ? 'Class updated!' : 'Class added!'); setShowModal(false); reset(); setEditClass(null); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/classes/${id}`),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success('Class removed'); }
  });

  const classes = data?.classes || [];

  useEffect(() => {
    if (!classes.length) return;
    const saved = JSON.parse(localStorage.getItem(CLASS_ORDER_KEY) || '[]');
    if (saved.length) {
      const sorted = [...classes].sort((a, b) => {
        const ai = saved.indexOf(a._id);
        const bi = saved.indexOf(b._id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      });
      setOrderedClasses(sorted);
    } else {
      setOrderedClasses(classes);
    }
  }, [classes]);

  const handleDragStart = (idx) => { dragItem.current = idx; setDraggingIdx(idx); };
  const handleDragEnter = (idx) => {
    dragOverItem.current = idx;
    if (dragItem.current === idx) return;
    const next = [...orderedClasses];
    const [moved] = next.splice(dragItem.current, 1);
    next.splice(idx, 0, moved);
    dragItem.current = idx;
    setOrderedClasses(next);
  };
  const handleDragEnd = () => {
    setDraggingIdx(null);
    dragItem.current = null;
    dragOverItem.current = null;
    localStorage.setItem(CLASS_ORDER_KEY, JSON.stringify(orderedClasses.map(c => c._id)));
  };

  const openEdit = (cls) => {
    setEditClass(cls);
    reset({
      name: cls.name, section: cls.section, capacity: cls.capacity,
      classTeacher: cls.classTeacher?._id || '', room: cls.room,
      'fees.yearly': cls.fees?.yearly, 'fees.monthly': cls.fees?.monthly,
      'fees.feeType': cls.fees?.feeType || 'yearly', 'fees.lateFee': cls.fees?.lateFee
    });
    setSelectedSubjects(cls.subjects?.map(s => s._id || s) || []);
    setShowModal(true);
  };

  const toggleSubject = (id) =>
    setSelectedSubjects(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">{orderedClasses.length} classes configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditClass(null); reset(); setSelectedSubjects([]); setShowModal(true); }}>
          <Plus size={16} /> Add Class
        </button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid-3">
          {orderedClasses.length === 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="card">
                <EmptyState icon={BookOpen} message="No classes yet. Create your first class!"
                  action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Class</button>} />
              </div>
            </div>
          )}
          {orderedClasses.map((cls, idx) => (
            <div key={cls._id} className="card"
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ padding: 20, cursor: 'grab', opacity: draggingIdx === idx ? 0.5 : 1, transition: 'opacity 0.15s', userSelect: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <GripVertical size={16} style={{ color: 'var(--text-muted)', marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div className="text-20-bold" style={{ color: 'var(--primary)' }}>
                      {cls.name}
                      <span style={{ fontSize: 14, background: '#eff6ff', padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>{cls.section}</span>
                    </div>
                    {cls.classTeacher && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Teacher: {cls.classTeacher.name}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={e => { e.stopPropagation(); openEdit(cls); }}><Edit size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); setDeleteId(cls._id); }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: cls.subjects?.length ? 10 : 0 }}>
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
              {cls.subjects?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {cls.subjects.slice(0, 5).map(s => (
                    <span key={s._id || s} className="badge badge-secondary"
                      style={{ fontSize: 11, borderLeft: s.color ? `3px solid ${s.color}` : undefined }}>
                      {s.name || s}
                    </span>
                  ))}
                  {cls.subjects.length > 5 && (
                    <span className="badge badge-secondary" style={{ fontSize: 11 }}>+{cls.subjects.length - 5}</span>
                  )}
                </div>
              )}
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
            createMutation.mutate({ ...d, subjects: selectedSubjects });
          })}>
            {createMutation.isLoading ? 'Saving...' : editClass ? 'Update Class' : 'Add Class'}
          </button>
        </>}>
        <form>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Class Name *</label>
              <input className="form-control" {...register('name', { required: 'Required' })} placeholder="e.g. Grade 10, Class 10, Std X" />
              {errors.name && <p style={{ color: '#ef4444', fontSize: 12 }}>{errors.name.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Section</label>
              <input className="form-control" {...register('section')} placeholder="e.g. A, B, C (optional)" />
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
              <input className="form-control" type="number" {...register('capacity')} />
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
              <input className="form-control" type="number" {...register('fees.lateFee')} />
            </div>
          </FormRow>

          <div className="form-group">
            <label className="form-label">
              Subjects
              {selectedSubjects.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
                  {selectedSubjects.length} selected
                </span>
              )}
            </label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'white',
              maxHeight: 150, overflowY: 'auto'
            }}>
              {allSubjects.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  No subjects yet — add subjects in the Subjects tab first
                </span>
              )}
              {allSubjects.map(s => {
                const selected = selectedSubjects.includes(s._id);
                return (
                  <button key={s._id} type="button" onClick={() => toggleSubject(s._id)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${selected ? (s.color || 'var(--primary)') : 'var(--border)'}`,
                      background: selected ? `${s.color || 'var(--primary)'}18` : 'white',
                      color: selected ? (s.color || 'var(--primary)') : 'var(--text-secondary)',
                      fontWeight: selected ? 600 : 400, transition: 'all 0.15s'
                    }}>
                    {s.name}{s.code ? ` · ${s.code}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Remove Class" message="This will permanently delete the class." danger />
    </div>
  );
}

export function Subjects() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
  const [customColor, setCustomColor] = useState('#000000');

  const codeAutoFill = useRef(true);
  const watchedName = watch('name');

  const generateCode = (name) => {
    if (!name?.trim()) return '';
    const words = name.trim().split(/\s+/).filter(Boolean);
    const prefix = words.length >= 2
      ? words.map(w => w[0]).join('').toUpperCase().substring(0, 4)
      : name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
    return (prefix.length >= 2 ? prefix : name.substring(0, 4).toUpperCase()) + '01';
  };

  useEffect(() => {
    if (codeAutoFill.current && watchedName) setValue('code', generateCode(watchedName));
  }, [watchedName]);

  const { data: empData } = useQuery({ queryKey: ['employees-teachers'], queryFn: () => api.get('/employees?role=teacher&limit=100') });
  const teachers = empData?.employees || [];
  const selectedColor = watch('color');

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/subjects/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject updated!'); setEditSubject(null); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const openEdit = (sub) => {
    codeAutoFill.current = false;
    setEditSubject(sub);
    reset({ name: sub.name, code: sub.code, type: sub.type, teacher: sub.teacher?._id || '', maxMarks: sub.maxMarks, passingMarks: sub.passingMarks, color: sub.color });
    if (sub.color && !['#1a56e8','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#ec4899','#14b8a6'].includes(sub.color)) {
      setCustomColor(sub.color);
    }
  };

  const SUBJECT_COLORS = ['#1a56e8','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#ec4899','#14b8a6'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { codeAutoFill.current = true; reset(); setShowModal(true); }}>
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(sub)}><Edit size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(sub._id)}><Trash2 size={14} /></button>
                </div>
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

      <Modal open={showModal || !!editSubject} onClose={() => { setShowModal(false); setEditSubject(null); reset(); }} title={editSubject ? 'Edit Subject' : 'Add Subject'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditSubject(null); reset(); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => {
            if (!d.teacher) delete d.teacher;
            if (!d.code) delete d.code;
            if (editSubject) { updateMutation.mutate({ id: editSubject._id, data: d }); }
            else { createMutation.mutate(d); }
          })}>
            {(createMutation.isLoading || updateMutation.isLoading) ? 'Saving...' : editSubject ? 'Save Changes' : 'Add Subject'}
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
              <input className="form-control" {...register('code')} placeholder="e.g. MATH01"
                onKeyDown={() => { codeAutoFill.current = false; }} />
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
              <Select
                options={teachers.map(t => ({ value: t._id, label: t.name, designation: t.designation }))}
                value={watch('teacher') || ''}
                onChange={val => setValue('teacher', val)}
                placeholder="Select teacher"
                isClearable
                formatOptionLabel={opt => (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</div>
                    {opt.designation && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{opt.designation}</div>
                    )}
                  </div>
                )}
              />
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
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {SUBJECT_COLORS.map(c => (
                <label key={c} style={{ cursor: 'pointer' }}>
                  <input type="radio" {...register('color')} value={c} style={{ display: 'none' }} />
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: selectedColor === c ? '3px solid #fff' : '3px solid transparent',
                    outline: selectedColor === c ? `3px solid ${c}` : '3px solid transparent',
                    boxSizing: 'border-box', transition: 'outline 0.15s, border 0.15s'
                  }} />
                </label>
              ))}
              <label style={{ cursor: 'pointer', position: 'relative' }} title="Custom color">
                <input type="radio" {...register('color')} value={customColor} style={{ display: 'none' }} />
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: customColor, cursor: 'pointer',
                  border: selectedColor === customColor ? '3px solid #fff' : '3px solid transparent',
                  outline: selectedColor === customColor ? `3px solid ${customColor}` : '3px solid #ccc',
                  boxSizing: 'border-box', transition: 'outline 0.15s, border 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}>
                  <input type="color" value={customColor} onChange={e => {
                    setCustomColor(e.target.value);
                    setValue('color', e.target.value);
                  }} style={{ opacity: 0, position: 'absolute', width: 30, height: 30, cursor: 'pointer', border: 'none', padding: 0 }} />
                </div>
              </label>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>Last circle = custom</span>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Remove Subject" message="This will permanently delete the subject." danger />
    </div>
  );
}
