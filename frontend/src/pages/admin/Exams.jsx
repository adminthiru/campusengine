// Exams Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, FileText, Download, Send, Edit2, Trash2, EyeOff, ChevronRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, StatusBadge, PageLoader, EmptyState, FormRow } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';

export function Exams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editExam, setEditExam] = useState(null); // null = create, object = edit
  const [deleteId, setDeleteId] = useState(null);
  const [marksModal, setMarksModal] = useState(null);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const { register, handleSubmit, reset } = useForm();

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data, isLoading } = useQuery({ queryKey: ['exams'], queryFn: () => api.get('/exams') });
  const exams = data?.exams || [];

  // Pre-fill form when editing
  useEffect(() => {
    if (editExam) {
      reset({ name: editExam.name, type: editExam.type, examDate: editExam.examDate?.split('T')[0] || '', status: editExam.status });
      setSelectedClasses(editExam.classes?.map(c => c._id || c) || []);
    } else {
      reset({ name: '', type: '', examDate: '', status: 'scheduled' });
      setSelectedClasses([]);
    }
  }, [editExam, reset]);

  const openCreate = () => { setEditExam(null); setShowModal(true); };
  const openEdit = (exam) => { setEditExam(exam); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditExam(null); };

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/exams', d),
    onSuccess: () => { qc.invalidateQueries(['exams']); toast.success('Exam created!'); closeModal(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/exams/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['exams']); toast.success('Exam updated!'); closeModal(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/exams/${id}`),
    onSuccess: () => { qc.invalidateQueries(['exams']); toast.success('Exam deleted!'); setDeleteId(null); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.post(`/exams/${id}/publish`),
    onSuccess: () => { qc.invalidateQueries(['exams']); toast.success('Results published! SMS sent to parents.'); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const handleSubmitForm = handleSubmit((d) => {
    const payload = { ...d, classes: selectedClasses };
    if (editExam) {
      updateMutation.mutate({ id: editExam._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  });

  const toggleClass = (id) => {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exams</h1>
          <p className="page-subtitle">{exams.length} exams</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Create Exam
        </button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid-2">
          {exams.length === 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="card"><EmptyState icon={FileText} message="No exams scheduled." /></div>
            </div>
          )}
          {exams.map(exam => (
            <div key={exam._id} className="card"
              onClick={() => navigate(`/exams/${exam._id}`)}
              style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-16-bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {exam.name}
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                  <div className="text-13-regular" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                    {exam.type || 'No type'} · {exam.examDate ? new Date(exam.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'} · {exam.academicYear}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <StatusBadge status={exam.status} />
                  <button className="btn btn-secondary btn-sm btn-icon" title="Edit exam"
                    onClick={e => { e.stopPropagation(); openEdit(exam); }}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" title="Delete exam"
                    onClick={e => { e.stopPropagation(); setDeleteId(exam._id); }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {exam.classes?.slice(0, 4).map(c => (
                  <span key={c._id} className="badge badge-info">{c.name} {c.section}</span>
                ))}
                {exam.classes?.length > 4 && (
                  <span className="badge badge-secondary">+{exam.classes.length - 4} more</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!exam.isResultPublished && exam.status !== 'cancelled' && (
                  <button
                    onClick={e => { e.stopPropagation(); publishMutation.mutate(exam._id); }}
                    disabled={publishMutation.isPending}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: '#16a34a', color: 'white',
                      opacity: publishMutation.isPending ? 0.7 : 1
                    }}>
                    <Send size={13} /> Publish Results
                  </button>
                )}
                {exam.isResultPublished && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 13, fontWeight: 600, color: '#16a34a'
                  }}>
                    <CheckCircle size={14} /> Published
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal}
        title={editExam ? 'Edit Exam' : 'Create Exam'}
        footer={<>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmitForm} disabled={isPending}>
            {isPending ? 'Saving...' : editExam ? 'Save Changes' : 'Create Exam'}
          </button>
        </>}>
        <form onSubmit={e => e.preventDefault()}>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Exam Name *</label>
              <input className="form-control" {...register('name', { required: true })}
                placeholder="e.g. First Term Exam" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <input className="form-control" {...register('type')}
                placeholder="e.g. Unit Test, Mid Term, Annual..." />
            </div>
          </FormRow>

          <div className="form-group">
            <label className="form-label">Classes</label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'white',
              maxHeight: 140, overflowY: 'auto'
            }}>
              {classes.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No classes available</span>
              )}
              {classes.map(c => {
                const selected = selectedClasses.includes(c._id);
                return (
                  <button key={c._id} type="button" onClick={() => toggleClass(c._id)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                      background: selected ? '#eff6ff' : 'white',
                      color: selected ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: selected ? 600 : 400, transition: 'all 0.15s'
                    }}>
                    {c.name} {c.section}
                  </button>
                );
              })}
            </div>
            {selectedClasses.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {selectedClasses.length} class{selectedClasses.length > 1 ? 'es' : ''} selected
              </p>
            )}
          </div>

          <FormRow>
            <div className="form-group">
              <label className="form-label">Exam Date</label>
              <input className="form-control" type="date" {...register('examDate')} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" {...register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </FormRow>

          {/* Unpublish section — only shown when editing a published exam */}
          {editExam?.isResultPublished && (
            <div style={{
              marginTop: 8, padding: '14px 16px', borderRadius: 8,
              background: '#fffbeb', border: '1px solid #fde68a'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div className="text-14-semibold" style={{ color: '#92400e' }}>Results Published</div>
                  <div className="text-12-regular" style={{ color: '#a16207', marginTop: 2 }}>
                    Unpublishing will hide results from students and parents.
                  </div>
                </div>
                <button type="button" className="btn btn-sm"
                  style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', flexShrink: 0 }}
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    id: editExam._id,
                    data: { isResultPublished: false, status: 'ongoing' }
                  })}>
                  <EyeOff size={14} /> Unpublish
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Exam"
        message="This will permanently delete the exam and all its results. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteMutation.mutate(deleteId)}
        onClose={() => setDeleteId(null)}
      />

      {marksModal && (
        <ResultsModal exam={marksModal} classes={classes} onClose={() => setMarksModal(null)} />
      )}
    </div>
  );
}

function ResultsModal({ exam, classes, onClose }) {
  const [classId, setClassId] = useState('');
  const { data } = useQuery({
    queryKey: ['results', exam._id, classId], enabled: !!classId,
    queryFn: () => api.get(`/exams/results?examId=${exam._id}&classId=${classId}`)
  });
  const results = data?.results || [];

  const downloadPDF = async (id) => {
    try {
      const res = await fetch(`/api/exams/results/${id}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'result.pdf'; a.click();
    } catch { toast.error('Failed'); }
  };

  return (
    <Modal open onClose={onClose} title={`${exam.name} — Results`} size="lg">
      <div className="form-group">
        <label className="form-label">Select Class</label>
        <select className="form-control" value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Select class</option>
          {exam.classes?.map(c => (
            <option key={c._id} value={c._id}>{c.name} {c.section}</option>
          ))}
        </select>
      </div>
      {classId && (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Student</th><th>Total</th><th>%</th><th>Grade</th><th>Rank</th><th>PDF</th></tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No results yet</td></tr>
              )}
              {results.map(r => (
                <tr key={r._id}>
                  <td className="text-14-medium">{r.student?.name}</td>
                  <td>{r.totalMarksObtained}/{r.totalMaxMarks}</td>
                  <td>{r.percentage?.toFixed(1)}%</td>
                  <td><span className="badge badge-info">{r.grade || '—'}</span></td>
                  <td>{r.rank ? `#${r.rank}` : '—'}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadPDF(r._id)}>
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default Exams;
