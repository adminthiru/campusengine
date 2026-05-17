// Exams Page
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, FileText, Download, Eye, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, StatusBadge, PageLoader, EmptyState, FormRow } from '../../components/ui';
import { useAuth } from '../../store/AuthContext';

export function Exams() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [marksModal, setMarksModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classData?.classes || [];

  const { data, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => api.get('/exams')
  });
  const exams = data?.exams || [];

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/exams', { ...d, academicYear: user?.school?.academicYear?.current }),
    onSuccess: () => { qc.invalidateQueries(['exams']); toast.success('Exam created!'); setShowCreate(false); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.post(`/exams/${id}/publish`),
    onSuccess: () => { qc.invalidateQueries(['exams']); toast.success('Results published! SMS sent to parents.'); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Exams</h1><p className="page-subtitle">{exams.length} exams</p></div>
        <button className="btn btn-primary" onClick={() => { reset(); setShowCreate(true); }}><Plus size={16} /> Create Exam</button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid-2">
          {exams.length === 0 && (
            <div style={{ gridColumn: '1/-1' }}><div className="card"><EmptyState icon={FileText} message="No exams scheduled." /></div></div>
          )}
          {exams.map(exam => (
            <div key={exam._id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div className="text-16-bold">{exam.name}</div>
                  <div className="text-14-regular" style={{ color: 'var(--text-secondary)', marginTop: 4, textTransform: 'capitalize' }}>{exam.type?.replace('_', ' ')} · {exam.academicYear}</div>
                </div>
                <StatusBadge status={exam.status} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {exam.classes?.slice(0, 4).map(c => <span key={c._id} className="badge badge-info">{c.name} {c.section}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setMarksModal(exam)}><Eye size={14} /> Results</button>
                {!exam.isResultPublished && exam.status !== 'cancelled' && (
                  <button className="btn btn-success btn-sm" onClick={() => publishMutation.mutate(exam._id)}>
                    <Send size={14} /> Publish Results
                  </button>
                )}
                {exam.isResultPublished && <span className="badge badge-success" style={{ alignSelf: 'center' }}>Published</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Exam"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => createMutation.mutate({ ...d, classes: d.classes ? [d.classes] : [] }))}>Create</button>
        </>}>
        <form>
          <FormRow>
            <div className="form-group"><label className="form-label">Exam Name *</label>
              <input className="form-control" {...register('name', { required: true })} placeholder="e.g. First Term Exam" /></div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-control" {...register('type')}>
                {['unit_test','mid_term','final','quarterly','half_yearly','annual','other'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select></div>
          </FormRow>
          <div className="form-group"><label className="form-label">Classes</label>
            <select className="form-control" {...register('classes')} multiple style={{ height: 100 }}>
              {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
            </select></div>
          <FormRow>
            <div className="form-group"><label className="form-label">Term</label>
              <select className="form-control" {...register('term')}>
                <option value="">Select term</option>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-control" {...register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select></div>
          </FormRow>
        </form>
      </Modal>

      {marksModal && <ResultsModal exam={marksModal} classes={classes} onClose={() => setMarksModal(null)} />}
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
    <Modal open onClose={onClose} title={`${exam.name} - Results`} size="lg">
      <div className="form-group">
        <label className="form-label">Select Class</label>
        <select className="form-control" value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Select class</option>
          {exam.classes?.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
      </div>
      {classId && (
        <div className="table-container">
          <table>
            <thead><tr><th>Student</th><th>Total</th><th>%</th><th>Grade</th><th>Rank</th><th>PDF</th></tr></thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No results yet</td></tr>}
              {results.map(r => (
                <tr key={r._id}>
                  <td className="text-14-medium">{r.student?.name}</td>
                  <td>{r.totalMarksObtained}/{r.totalMaxMarks}</td>
                  <td>{r.percentage?.toFixed(1)}%</td>
                  <td><span className="badge badge-info">{r.grade || '—'}</span></td>
                  <td>{r.rank ? `#${r.rank}` : '—'}</td>
                  <td><button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadPDF(r._id)}><Download size={14} /></button></td>
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
