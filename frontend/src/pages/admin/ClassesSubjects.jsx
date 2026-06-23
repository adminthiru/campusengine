import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Select as AntSelect } from 'antd';
import { Plus, Trash2, BookOpen, Users, Edit, GripVertical, Eye, ChevronLeft, ChevronRight, UserCheck, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, EmptyState, PageLoader, FormRow, StatusBadge, Select, SearchInput } from '../../components/ui';

const CLASS_ORDER_KEY = 'sklproj_class_order';

export function Classes() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [viewClass, setViewClass] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectTeacherMap, setSubjectTeacherMap] = useState({});
  const [classTab, setClassTab] = useState('details');
  const [orderedClasses, setOrderedClasses] = useState([]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const defaultClassValues = { name: '', section: '', capacity: 40, classTeacher: '', room: '', 'fees.feeType': 'yearly', 'fees.yearly': '', 'fees.lateFee': 0, saturdaySchedule: 'school_default' };
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({ defaultValues: defaultClassValues });

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
      'fees.feeType': cls.fees?.feeType || 'yearly', 'fees.lateFee': cls.fees?.lateFee,
      saturdaySchedule: cls.saturdaySchedule || 'school_default',
    });
    setSelectedSubjects(cls.subjects?.map(s => s._id || s) || []);
    const map = {};
    (cls.subjectTeachers || []).forEach(st => {
      const subId = st.subject?._id || st.subject;
      const teachId = st.teacher?._id || st.teacher;
      if (subId && teachId) map[subId] = teachId;
    });
    setSubjectTeacherMap(map);
    setClassTab('details');
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
        <button className="btn btn-primary" onClick={() => { setEditClass(null); reset(); setSelectedSubjects([]); setSubjectTeacherMap({}); setClassTab('details'); setShowModal(true); }}>
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
          {orderedClasses.map((cls, idx) => {
            const count = cls.studentCount || 0;
            const cap = cls.capacity || 0;
            const pct = cap ? Math.round((count / cap) * 100) : 0;
            const occColor = pct >= 100 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#1a56e8';
            const feeAmt = cls.fees?.yearly || cls.fees?.monthly || 0;
            const badge = (cls.name.match(/\d+/) || [])[0] || (cls.name || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '#';
            const satLabel = cls.saturdaySchedule && cls.saturdaySchedule !== 'school_default'
              ? ({ all_working: 'All Working', all_holiday: 'All Holiday', alternate: 'Alternate', one_in_three: '1-in-3' }[cls.saturdaySchedule] || cls.saturdaySchedule)
              : null;
            return (
            <div key={cls._id} className="card"
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ padding: 18, cursor: 'grab', opacity: draggingIdx === idx ? 0.5 : 1, transition: 'opacity 0.15s', userSelect: 'none' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 16 }}>
                <GripVertical size={16} style={{ color: '#cbd5e1', marginTop: 13, flexShrink: 0 }} />
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#eff6ff,#dbe8ff)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0, letterSpacing: '-0.02em' }}>
                  {badge}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="text-16-bold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls.name}</span>
                    {cls.section && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: '#eff6ff', padding: '1px 9px', borderRadius: 20, flexShrink: 0 }}>{cls.section}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <UserCheck size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {cls.classTeacher ? cls.classTeacher.name : <span style={{ color: 'var(--text-muted)' }}>No class teacher</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={e => { e.stopPropagation(); setViewClass(cls); }} title="View details"><Eye size={14} /></button>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={e => { e.stopPropagation(); openEdit(cls); }} title="Edit"><Edit size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); setDeleteId(cls._id); }} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Enrolment */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Enrolment</span>
                  <span style={{ fontSize: 13 }}>
                    <b style={{ color: 'var(--text-primary)' }}>{count}</b>
                    <span style={{ color: 'var(--text-muted)' }}> / {cap || '—'}</span>
                    {cap > 0 && <span style={{ color: occColor, fontWeight: 700, marginLeft: 8 }}>{pct}%</span>}
                  </span>
                </div>
                <div style={{ height: 7, background: '#eef2f8', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: occColor, borderRadius: 7, transition: 'width .4s' }} />
                </div>
              </div>

              {/* Meta strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                  <DoorOpen size={14} style={{ color: 'var(--text-muted)' }} /> Room <b style={{ color: 'var(--text-primary)' }}>{cls.room || '—'}</b>
                </span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fee</span>
                  <b style={{ fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>₹{feeAmt.toLocaleString('en-IN')}</b>
                </span>
              </div>

              {/* Subjects + Saturday */}
              {(cls.subjects?.length > 0 || satLabel) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
                  {satLabel && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fffbeb', padding: '3px 9px', borderRadius: 20 }}>Sat · {satLabel}</span>
                  )}
                  {cls.subjects?.slice(0, 5).map(s => (
                    <span key={s._id || s} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', background: '#fff', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 20, borderLeft: s.color ? `3px solid ${s.color}` : '1px solid var(--border)' }}>
                      {s.name || s}
                    </span>
                  ))}
                  {cls.subjects?.length > 5 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>+{cls.subjects.length - 5}</span>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Class Detail Modal */}
      <Modal open={!!viewClass} onClose={() => setViewClass(null)} title="Class Details" size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setViewClass(null)}>Close</button>
          <button className="btn btn-primary" onClick={() => { const c = viewClass; setViewClass(null); openEdit(c); }}>
            <Edit size={14} /> Edit Class
          </button>
        </>}>
        {viewClass && (
          <div>
            {/* Class name header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{viewClass.name}</div>
              {viewClass.section && (
                <span style={{ fontSize: 14, background: '#eff6ff', color: 'var(--primary)', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
                  {viewClass.section}
                </span>
              )}
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Class Teacher', value: viewClass.classTeacher?.name || '—' },
                { label: 'Students', value: `${viewClass.studentCount || 0} / ${viewClass.capacity}` },
                { label: 'Room', value: viewClass.room || '—' },
                { label: 'Fee Type', value: viewClass.fees?.feeType ? viewClass.fees.feeType.charAt(0).toUpperCase() + viewClass.fees.feeType.slice(1) : '—' },
                { label: 'Fee Amount', value: `₹${(viewClass.fees?.yearly || viewClass.fees?.monthly || 0).toLocaleString('en-IN')}` },
                { label: 'Late Fee / Day', value: viewClass.fees?.lateFee ? `₹${viewClass.fees.lateFee}` : '—' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Subjects & Teachers */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Subjects & Assigned Teachers ({viewClass.subjects?.length || 0})
            </div>
            {viewClass.subjects?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {viewClass.subjects.map(sub => {
                  const subId = sub._id || sub;
                  const assignment = (viewClass.subjectTeachers || []).find(st => String(st.subject?._id || st.subject) === String(subId));
                  const teacherName = assignment?.teacher?.name || null;
                  return (
                    <div key={subId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8, background: '#f8fafc',
                      border: '1px solid var(--border)', borderLeft: `3px solid ${sub.color || 'var(--primary)'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{sub.name || sub}</span>
                        {sub.code && <span className="badge badge-secondary" style={{ fontSize: 11 }}>{sub.code}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: teacherName ? 'var(--text-secondary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Users size={13} />
                        {teacherName || 'No teacher assigned'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                No subjects assigned to this class
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditClass(null); reset(); setClassTab('details'); }}
        title={editClass ? 'Edit Class' : 'Add Class'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditClass(null); setClassTab('details'); }}>Cancel</button>
          {classTab === 'details'
            ? <button type="button" className="btn btn-secondary" onClick={() => setClassTab('teachers')}>Subject Teachers <ChevronRight size={15} /></button>
            : <button type="button" className="btn btn-secondary" onClick={() => setClassTab('details')}><ChevronLeft size={15} /> Back</button>}
          <button className="btn btn-primary" onClick={handleSubmit(d => {
            if (!d.classTeacher) delete d.classTeacher;
            const subjectTeachers = Object.entries(subjectTeacherMap)
              .filter(([, teachId]) => teachId)
              .map(([subId, teachId]) => ({ subject: subId, teacher: teachId }));
            createMutation.mutate({ ...d, subjects: selectedSubjects, subjectTeachers });
          })}>
            {createMutation.isLoading ? 'Saving...' : editClass ? 'Update Class' : 'Add Class'}
          </button>
        </>}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 18 }}>
          {[['details', 'Details'], ['teachers', 'Subject Teachers']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setClassTab(k)}
              style={{
                padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', marginBottom: -2,
                fontSize: 14, fontWeight: classTab === k ? 700 : 500,
                color: classTab === k ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${classTab === k ? 'var(--primary)' : 'transparent'}`,
              }}>
              {l}{k === 'teachers' && selectedSubjects.length > 0 ? ` (${selectedSubjects.length})` : ''}
            </button>
          ))}
        </div>
        <form>
          {classTab === 'details' && (<>
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
              <Controller
                name="classTeacher"
                control={control}
                render={({ field }) => (
                  <AntSelect
                    {...field}
                    style={{ width: '100%' }}
                    placeholder="Select teacher"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={teachers.map(t => ({ value: t._id, label: t.name }))}
                  />
                )}
              />
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
              <label className="form-label">Fee (₹)</label>
              <input className="form-control" type="number" {...register('fees.yearly')} placeholder="e.g. 40000" />
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
          </>)}

          {classTab === 'teachers' && (
            selectedSubjects.length > 0 ? (
            <div className="form-group">
              <label className="form-label">Assign a teacher to each subject</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allSubjects.filter(s => selectedSubjects.includes(s._id)).map(sub => {
                  const subTeachers = sub.teachers?.length > 0
                    ? sub.teachers
                    : sub.teacher ? [sub.teacher] : [];
                  return (
                    <div key={sub._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        minWidth: 150, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                        borderLeft: `3px solid ${sub.color || 'var(--primary)'}`, paddingLeft: 8,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0
                      }}>
                        {sub.name}{sub.code ? ` · ${sub.code}` : ''}
                      </div>
                      <div style={{ flex: 1 }}>
                        {subTeachers.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 2px' }}>
                            No teachers assigned to this subject
                          </div>
                        ) : (
                          <AntSelect
                            style={{ width: '100%' }}
                            placeholder="Assign teacher..."
                            allowClear
                            value={subjectTeacherMap[sub._id] || undefined}
                            onChange={val => setSubjectTeacherMap(prev => ({ ...prev, [sub._id]: val ?? '' }))}
                            options={subTeachers.map(t => ({ value: t._id || t, label: t.name || t }))}
                            optionRender={(option) => (
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>{option.data.label}</div>
                                {option.data.designation && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{option.data.designation}</div>}
                              </div>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Select subjects in the <b>Details</b> tab first to assign teachers.
              </div>
            )
          )}
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
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm();
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
  // Client-side search over subject name, code or teacher name
  const q = search.trim().toLowerCase();
  const displaySubjects = q
    ? subjects.filter(sub =>
        (sub.name || '').toLowerCase().includes(q) ||
        (sub.code || '').toLowerCase().includes(q) ||
        (sub.teachers?.length ? sub.teachers : [sub.teacher]).some(t => (t?.name || '').toLowerCase().includes(q)))
    : subjects;

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/subjects', d),
    onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject added!'); setShowModal(false); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/subjects/${id}`),
    onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject removed'); }
  });

  const bulkDeleteMutation = async () => {
    await Promise.all(selected.map(id => api.delete(`/subjects/${id}`)));
    qc.invalidateQueries(['subjects']);
    setSelected([]);
    setBulkDeleteConfirm(false);
    toast.success(`${selected.length} subject(s) removed`);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/subjects/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject updated!'); setEditSubject(null); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const openEdit = (sub) => {
    codeAutoFill.current = false;
    setEditSubject(sub);
    reset({ name: sub.name, code: sub.code, type: sub.type, teachers: (sub.teachers?.map(t => t._id || t) || (sub.teacher ? [sub.teacher._id || sub.teacher] : [])), color: sub.color });
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
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { codeAutoFill.current = true; reset(); setShowModal(true); }}>
            <Plus size={16} /> Add Subject
          </button>
        </div>
      </div>

      {isLoading ? <PageLoader /> : (
        <>
        {subjects.length > 0 && (
          <div className="filter-bar">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by subject, code or teacher..." />
          </div>
        )}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox"
                      checked={displaySubjects.length > 0 && selected.length === displaySubjects.length}
                      onChange={e => setSelected(e.target.checked ? displaySubjects.map(s => s._id) : [])} />
                  </th>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Teachers</th>
                  <th>Classes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displaySubjects.length === 0 && (
                  <tr><td colSpan={7}>
                    <EmptyState icon={BookOpen}
                      message={subjects.length === 0 ? 'No subjects yet.' : 'No subjects match your search.'}
                      action={subjects.length === 0 ? <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Subject</button> : undefined} />
                  </td></tr>
                )}
                {displaySubjects.map((sub, idx) => {
                  const subTeachers = (sub.teachers?.length > 0 ? sub.teachers : [sub.teacher]).map(t => t?.name).filter(Boolean);
                  return (
                    <tr key={sub._id}>
                      <td>
                        <input type="checkbox" checked={selected.includes(sub._id)}
                          onChange={e => setSelected(p => e.target.checked ? [...p, sub._id] : p.filter(id => id !== sub._id))} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 4, height: 28, borderRadius: 4, background: sub.color || SUBJECT_COLORS[idx % 8], flexShrink: 0 }} />
                          <span className="text-14-semibold">{sub.name}</span>
                        </div>
                      </td>
                      <td>{sub.code ? <span className="badge badge-secondary">{sub.code}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{sub.type}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{subTeachers.length ? subTeachers.join(', ') : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {sub.classes?.length
                            ? <>
                                {sub.classes.slice(0, 4).map(c => <span key={c._id} className="badge badge-info" style={{ fontSize: 11 }}>{c.name} {c.section}</span>)}
                                {sub.classes.length > 4 && <span className="badge badge-secondary" style={{ fontSize: 11 }}>+{sub.classes.length - 4}</span>}
                              </>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(sub)}><Edit size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      <Modal open={showModal || !!editSubject} onClose={() => { setShowModal(false); setEditSubject(null); reset(); }} title={editSubject ? 'Edit Subject' : 'Add Subject'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditSubject(null); reset(); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => {
            if (!d.code) delete d.code;
            if (!d.teachers?.length) d.teachers = [];
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
              <Controller
                name="type"
                control={control}
                defaultValue="theory"
                render={({ field }) => (
                  <AntSelect
                    {...field}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'theory', label: 'Theory' },
                      { value: 'practical', label: 'Practical' },
                      { value: 'both', label: 'Theory + Practical' },
                    ]}
                  />
                )}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Assign to Teachers</label>
              <AntSelect
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="Select teachers"
                allowClear
                showSearch
                optionFilterProp="label"
                value={watch('teachers') || []}
                onChange={val => setValue('teachers', val)}
                options={teachers.map(t => ({ value: t._id, label: t.name, designation: t.designation }))}
                optionRender={(option) => (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{option.data.label}</div>
                    {option.data.designation && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{option.data.designation}</div>
                    )}
                  </div>
                )}
              />
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

      <ConfirmDialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={bulkDeleteMutation}
        title="Remove Subjects" message={`This will permanently delete ${selected.length} subject(s) and cannot be undone.`} danger />
    </div>
  );
}
