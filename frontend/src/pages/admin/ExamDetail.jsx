import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, Save, Send, CheckCircle, Edit2, EyeOff, FileDown, Search, CalendarDays, Ticket } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageLoader, StatusBadge, Modal, FormRow } from '../../components/ui';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BORDER = ['#fbbf24', '#94a3b8', '#fb923c'];

export default function ExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeClassId, setActiveClassId] = useState(null);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [marksState, setMarksState] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSelectedClasses, setEditSelectedClasses] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportClassId, setReportClassId] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportDownloading, setReportDownloading] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleState, setScheduleState] = useState({});
  const [hallTicketDownloading, setHallTicketDownloading] = useState(null);
  const fileInputRefs = useRef({});
  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit } = useForm();

  const { data: examData, isLoading } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => api.get(`/exams/${id}`)
  });
  const exam = examData?.exam;

  // Set first class as default once exam loads
  useEffect(() => {
    if (exam?.classes?.length > 0 && !activeClassId) {
      setActiveClassId(exam.classes[0]._id);
    }
  }, [exam]);

  const { data: schoolData } = useQuery({
    queryKey: ['school'],
    queryFn: () => api.get('/school')
  });
  const gradeConfig = schoolData?.school?.gradeConfig;

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const allClasses = classData?.classes || [];

  const updateExamMutation = useMutation({
    mutationFn: (payload) => api.put(`/exams/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries(['exam', id]);
      setShowEditModal(false);
      toast.success('Exam updated!');
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const openEditModal = () => {
    resetEdit({
      name: exam.name,
      type: exam.type || '',
      examDate: exam.examDate?.split('T')[0] || '',
      status: exam.status
    });
    setEditSelectedClasses(exam.classes?.map(c => c._id || c) || []);
    setShowEditModal(true);
  };

  const toggleEditClass = (cid) =>
    setEditSelectedClasses(prev => prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]);

  const openScheduleModal = () => {
    const classSchedule = exam?.schedule?.filter(e =>
      (e.class?._id || e.class)?.toString() === activeClassId
    ) || [];
    const hasAnySchedule = classSchedule.length > 0;
    const init = {};
    for (const s of classSubjects) {
      const entry = classSchedule.find(e =>
        (e.subject?._id || e.subject)?.toString() === s._id
      );
      // If schedule exists: included = whether subject has an entry. If no schedule yet: all included.
      init[s._id] = {
        included: hasAnySchedule ? !!entry : true,
        date: entry?.date ? new Date(entry.date).toISOString().split('T')[0] : '',
        startTime: entry?.startTime || '',
        endTime: entry?.endTime || '',
        room: entry?.room || ''
      };
    }
    setScheduleState(init);
    setShowScheduleModal(true);
  };

  const saveScheduleMutation = useMutation({
    mutationFn: (schedule) => api.put(`/exams/${id}`, { schedule }),
    onSuccess: () => {
      qc.invalidateQueries(['exam', id]);
      setShowScheduleModal(false);
      toast.success('Exam schedule saved!');
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const handleSaveSchedule = () => {
    // Merge updated entries for this class into the full existing schedule
    const existingSchedule = (exam?.schedule || [])
      .filter(e => (e.class?._id || e.class)?.toString() !== activeClassId)
      .map(e => ({
        class: e.class?._id || e.class,
        subject: e.subject?._id || e.subject,
        date: e.date, startTime: e.startTime, endTime: e.endTime, room: e.room,
        maxMarks: e.maxMarks, passingMarks: e.passingMarks
      }));
    const newEntries = classSubjects
      .filter(s => scheduleState[s._id]?.included !== false)
      .map(s => ({
        class: activeClassId,
        subject: s._id,
        date: scheduleState[s._id]?.date || null,
        startTime: scheduleState[s._id]?.startTime || '',
        endTime: scheduleState[s._id]?.endTime || '',
        room: scheduleState[s._id]?.room || ''
      }));
    saveScheduleMutation.mutate([...existingSchedule, ...newEntries]);
  };

  const downloadHallTicket = async (studentId, studentName) => {
    setHallTicketDownloading(studentId);
    try {
      const res = await fetch(`/api/exams/${id}/hall-ticket/${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to generate hall ticket');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HallTicket_${studentName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Download failed');
    } finally {
      setHallTicketDownloading(null);
    }
  };

  const { data: reportStudentsData } = useQuery({
    queryKey: ['students-class', reportClassId],
    queryFn: () => api.get(`/students?classId=${reportClassId}&status=active`),
    enabled: !!reportClassId
  });
  const reportStudents = reportStudentsData?.students || [];

  const { data: reportResultsData } = useQuery({
    queryKey: ['results', id, reportClassId],
    queryFn: () => api.get(`/exams/results?examId=${id}&classId=${reportClassId}`),
    enabled: !!reportClassId
  });

  const downloadReportPDF = async (resultId, studentName) => {
    setReportDownloading(resultId);
    try {
      const res = await fetch(`/api/exams/results/${resultId}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${studentName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Download failed');
    } finally {
      setReportDownloading(null);
    }
  };

  const { data: studentsData } = useQuery({
    queryKey: ['students-class', activeClassId],
    queryFn: () => api.get(`/students?classId=${activeClassId}&status=active`),
    enabled: !!activeClassId
  });
  const students = studentsData?.students || [];

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-class', activeClassId],
    queryFn: () => api.get(`/subjects?classId=${activeClassId}`),
    enabled: !!activeClassId
  });
  const classSubjects = subjectsData?.subjects || [];

  // Auto-select first subject when subjects load or class changes
  useEffect(() => {
    if (classSubjects.length > 0 && !activeSubjectId) {
      setActiveSubjectId(classSubjects[0]._id);
    }
  }, [classSubjects]);

  const { data: resultsData, refetch: refetchResults } = useQuery({
    queryKey: ['results', id, activeClassId],
    queryFn: () => api.get(`/exams/results?examId=${id}&classId=${activeClassId}`),
    enabled: !!activeClassId
  });

  // Populate marksState from DB whenever results load/reload — useEffect replaces deprecated onSuccess
  useEffect(() => {
    if (!resultsData?.results) return;
    setMarksState(prev => {
      const next = { ...prev };
      for (const r of resultsData.results) {
        const studentId = r.student?._id || r.student;
        for (const m of r.marks || []) {
          const subjectId = m.subject?._id || m.subject;
          next[`${studentId}_${subjectId}`] = {
            theoryMarks: m.theoryMarks ?? '',
            practicalMarks: m.practicalMarks ?? '',
            isAbsent: m.isAbsent || false,
            remarks: m.remarks || ''
          };
        }
      }
      return next;
    });
  }, [resultsData]);

  const saveMarksMutation = useMutation({
    mutationFn: (payload) => api.post('/exams/marks', payload),
    onSuccess: () => {
      qc.invalidateQueries(['results', id, activeClassId]);
      toast.success('Marks saved!');
    },
    onError: (err) => toast.error(err.message || 'Failed to save marks')
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post(`/exams/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries(['exam', id]);
      toast.success('Results published! SMS sent to parents.');
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const unpublishMutation = useMutation({
    mutationFn: () => api.put(`/exams/${id}`, { isResultPublished: false, status: 'ongoing' }),
    onSuccess: () => {
      qc.invalidateQueries(['exam', id]);
      toast.success('Results unpublished.');
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteAnswerPaperMutation = useMutation({
    mutationFn: ({ resultId, subjectId }) => api.delete(`/exams/results/${resultId}/answer-paper`, { data: { subjectId } }),
    onSuccess: () => { refetchResults(); toast.success('Answer paper removed'); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const uploadAnswerPaper = async (studentId, file) => {
    const formData = new FormData();
    formData.append('answerPaper', file);
    formData.append('examId', id);
    formData.append('studentId', studentId);
    formData.append('classId', activeClassId);
    formData.append('subjectId', activeSubjectId);
    try {
      await api.post('/exams/answer-paper', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Answer paper uploaded');
      refetchResults();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const getScheduleEntry = (subjectId) => {
    if (!exam || !activeClassId) return null;
    return exam.schedule?.find(s =>
      (s.class?._id || s.class)?.toString() === activeClassId?.toString() &&
      (s.subject?._id || s.subject)?.toString() === subjectId?.toString()
    );
  };

  const calcGrade = (total, maxM) => {
    if (!gradeConfig?.grades?.length || !maxM) return '';
    const pct = (total / maxM) * 100;
    return gradeConfig.grades.find(g => pct >= g.minScore && pct <= g.maxScore)?.label || '';
  };

  const getMark = (studentId, field) => {
    const v = marksState[`${studentId}_${activeSubjectId}`]?.[field];
    return v !== undefined ? v : (field === 'isAbsent' ? false : '');
  };

  const setMark = (studentId, field, value) => {
    const key = `${studentId}_${activeSubjectId}`;
    setMarksState(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
  };

  const handleSaveMarks = () => {
    if (!activeSubjectId) return toast.error('Select a subject first');
    const marksData = students.map(s => {
      const m = marksState[`${s._id}_${activeSubjectId}`] || {};
      return {
        studentId: s._id,
        theoryMarks: parseFloat(m.theoryMarks) || 0,
        practicalMarks: parseFloat(m.practicalMarks) || 0,
        isAbsent: !!m.isAbsent,
        remarks: m.remarks || ''
      };
    });
    saveMarksMutation.mutate({
      examId: id, classId: activeClassId, subjectId: activeSubjectId,
      academicYear: exam?.academicYear, marksData
    });
  };

  const getResultForStudent = (studentId) =>
    resultsData?.results?.find(r => (r.student?._id || r.student) === studentId);

  if (isLoading) return <PageLoader />;
  if (!exam) return <div style={{ padding: 32 }}>Exam not found.</div>;

  const scheduleEntry = activeSubjectId ? getScheduleEntry(activeSubjectId) : null;
  const maxMarks = scheduleEntry?.maxMarks || 100;
  const activeSubject = classSubjects.find(s => s._id === activeSubjectId);

  // Only show subjects that are included in this exam's schedule for this class.
  // If no schedule has been set yet, show all subjects.
  const classScheduleEntries = exam?.schedule?.filter(e =>
    (e.class?._id || e.class)?.toString() === activeClassId
  ) || [];
  const examSubjects = classScheduleEntries.length > 0
    ? classSubjects.filter(s => classScheduleEntries.some(e =>
        (e.subject?._id || e.subject)?.toString() === s._id
      ))
    : classSubjects;

  // Only show toppers when actual marks have been entered (not just 0s)
  const top3 = resultsData?.results
    ? [...resultsData.results]
        .filter(r => r.totalMarksObtained > 0 || r.marks?.some(m => m.isAbsent))
        .sort((a, b) => (a.rank || 999) - (b.rank || 999))
        .slice(0, 3)
    : [];

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate('/exams')}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>{exam.name}</h1>
            {[exam.type, exam.examDate ? new Date(exam.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null, exam.academicYear].filter(Boolean).map((text, i) => (
              <span key={i} style={{
                fontSize: 12, color: 'var(--text-secondary)', background: '#f1f5f9',
                border: '1px solid var(--border)', borderRadius: 20,
                padding: '2px 10px', fontWeight: 500
              }}>{text}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm btn-icon" title="Edit exam" onClick={openEditModal}>
            <Edit2 size={14} />
          </button>
          <StatusBadge status={exam.status} />
          {!exam.isResultPublished ? (
            <button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: '#16a34a', color: 'white',
                opacity: publishMutation.isPending ? 0.7 : 1
              }}>
              <Send size={14} /> {publishMutation.isPending ? 'Publishing...' : 'Publish Results'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 13, fontWeight: 600, color: '#16a34a'
              }}>
                <CheckCircle size={14} /> Published
              </span>
              <button onClick={() => unpublishMutation.mutate()} disabled={unpublishMutation.isPending}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)'
                }}>
                <EyeOff size={13} /> {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Class tabs */}
      <div style={{ borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        <div style={{ display: 'flex', overflowX: 'auto', marginBottom: -2 }}>
          {exam.classes?.map(cls => (
            <button key={cls._id}
              onClick={() => { setActiveClassId(cls._id); setActiveSubjectId(null); setEditMode(false); }}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: activeClassId === cls._id ? 700 : 500,
                color: activeClassId === cls._id ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${activeClassId === cls._id ? 'var(--primary)' : 'transparent'}`,
                transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0
              }}>
              {cls.name} {cls.section}
            </button>
          ))}
        </div>
      </div>

      {activeClassId && (
        <div>
          {/* Class Toppers — shown above dropdown only when marks exist */}
          {top3.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              {top3.map((r, i) => (
                <div key={r._id} className="card" style={{
                  flex: '1 1 0', padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{MEDALS[i]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.student?.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: MEDAL_BORDER[i] }}>{r.percentage?.toFixed(1)}%</span>
                      {r.grade && <span className="badge badge-info" style={{ fontSize: 10 }}>{r.grade}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subject selector + Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 240 }}>
              <select className="form-control" value={activeSubjectId || ''}
                onChange={e => { setActiveSubjectId(e.target.value); setEditMode(false); }}>
                {examSubjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                ))}
              </select>
            </div>
            {scheduleEntry && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Max: <strong>{maxMarks}</strong> · Passing: <strong>{scheduleEntry.passingMarks || 35}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="btn btn-secondary btn-sm" onClick={openScheduleModal}>
                <CalendarDays size={14} /> Set Exam Dates
              </button>
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setReportClassId(activeClassId || ''); setReportSearch(''); setShowReportModal(true); }}>
                <FileDown size={14} /> Download Report
              </button>
              {activeSubjectId && !editMode && (
                <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>
                  <Edit2 size={14} /> Edit Marks
                </button>
              )}
            </div>
            {activeSubjectId && editMode && (
              <button className="btn btn-success btn-sm"
                onClick={() => { handleSaveMarks(); setEditMode(false); }}
                disabled={saveMarksMutation.isPending}>
                <Save size={14} /> {saveMarksMutation.isPending ? 'Saving...' : 'Save Marks'}
              </button>
            )}
          </div>

          {/* Subject label above table */}
          {activeSubject && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeSubject.name}
              </span>
              {activeSubject.code && (
                <span className="badge badge-secondary" style={{ fontSize: 12 }}>{activeSubject.code}</span>
              )}
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                — Max: {maxMarks} marks
              </span>
            </div>
          )}

          {/* Marks table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Student</th>
                    <th style={{ width: 65, textAlign: 'center' }}>Absent</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Theory</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Practical</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Total</th>
                    <th style={{ width: 70, textAlign: 'center' }}>Grade</th>
                    <th style={{ width: 70, textAlign: 'center' }}>%</th>
                    <th style={{ width: 160 }}>Remarks</th>
                    <th style={{ width: 200 }}>Answer Paper</th>
                    <th style={{ width: 120 }}>Hall Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No active students in this class</td></tr>
                  )}
                  {students.map((student, idx) => {
                    const isAbsent = getMark(student._id, 'isAbsent');
                    const theory = parseFloat(getMark(student._id, 'theoryMarks')) || 0;
                    const practical = parseFloat(getMark(student._id, 'practicalMarks')) || 0;
                    const total = isAbsent ? 0 : theory + practical;
                    const percent = maxMarks ? Math.round((total / maxMarks) * 100 * 10) / 10 : 0;
                    const grade = isAbsent ? 'AB' : calcGrade(total, maxMarks);
                    const result = getResultForStudent(student._id);
                    const subjectMark = result?.marks?.find(m => (m.subject?._id || m.subject) === activeSubjectId);
                    const hasAnswerPaper = subjectMark?.answerPaper?.url;
                    const hasMarks = theory > 0 || practical > 0 || isAbsent;
                    const canEdit = editMode;

                    return (
                      <tr key={student._id} style={{ opacity: isAbsent ? 0.6 : 1 }}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{student.rollNumber || idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{student.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{student.admissionNumber}</div>
                        </td>

                        {/* Absent */}
                        <td style={{ textAlign: 'center' }}>
                          {canEdit ? (
                            <input type="checkbox" checked={isAbsent}
                              onChange={e => setMark(student._id, 'isAbsent', e.target.checked)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          ) : isAbsent ? (
                            <span className="badge badge-danger" style={{ fontSize: 11 }}>AB</span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>

                        {/* Theory */}
                        <td style={{ textAlign: 'right' }}>
                          {canEdit ? (
                            <input type="number" className="form-control" min={0} max={maxMarks}
                              disabled={isAbsent}
                              value={getMark(student._id, 'theoryMarks')}
                              onChange={e => setMark(student._id, 'theoryMarks', e.target.value)}
                              style={{ fontSize: 13, padding: '4px 8px', textAlign: 'right', width: '100%' }}
                              placeholder="0" />
                          ) : (
                            <span style={{ fontSize: 14, color: hasMarks ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {isAbsent ? '—' : (theory > 0 ? theory : '—')}
                            </span>
                          )}
                        </td>

                        {/* Practical */}
                        <td style={{ textAlign: 'right' }}>
                          {canEdit ? (
                            <input type="number" className="form-control" min={0} max={maxMarks}
                              disabled={isAbsent}
                              value={getMark(student._id, 'practicalMarks')}
                              onChange={e => setMark(student._id, 'practicalMarks', e.target.value)}
                              style={{ fontSize: 13, padding: '4px 8px', textAlign: 'right', width: '100%' }}
                              placeholder="0" />
                          ) : (
                            <span style={{ fontSize: 14, color: hasMarks ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {isAbsent ? '—' : (practical > 0 ? practical : '—')}
                            </span>
                          )}
                        </td>

                        {/* Total */}
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                          {hasMarks && !isAbsent ? (
                            <>{total}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>/{maxMarks}</span></>
                          ) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                        </td>

                        {/* Grade */}
                        <td style={{ textAlign: 'center' }}>
                          {isAbsent ? (
                            <span className="badge badge-danger">AB</span>
                          ) : hasMarks ? (
                            <span className={`badge ${grade ? 'badge-info' : 'badge-secondary'}`}>{grade || '—'}</span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>

                        {/* % */}
                        <td style={{ textAlign: 'center', fontSize: 13, fontWeight: hasMarks && !isAbsent ? 600 : 400, color: hasMarks && !isAbsent ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {hasMarks && !isAbsent ? `${percent}%` : '—'}
                        </td>

                        {/* Remarks */}
                        <td>
                          {canEdit ? (
                            <input className="form-control"
                              value={getMark(student._id, 'remarks')}
                              onChange={e => setMark(student._id, 'remarks', e.target.value)}
                              style={{ fontSize: 12, padding: '4px 8px' }}
                              placeholder="Remarks..." />
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              {getMark(student._id, 'remarks') || '—'}
                            </span>
                          )}
                        </td>

                        {/* Answer Paper */}
                        <td>
                          <input type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                            ref={el => fileInputRefs.current[student._id] = el}
                            onChange={e => { const f = e.target.files[0]; if (f) uploadAnswerPaper(student._id, f); e.target.value = ''; }} />

                          {/* View mode with paper: show filename chip */}
                          {!canEdit && hasAnswerPaper && (
                            <a href={hasAnswerPaper} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none',
                                padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)',
                                background: '#f8fafc', fontSize: 12, color: 'var(--primary)',
                                maxWidth: 160, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                              }}>
                              <Upload size={11} style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {subjectMark?.answerPaper?.fileName || 'View PDF'}
                              </span>
                            </a>
                          )}

                          {/* View mode without paper: dash */}
                          {!canEdit && !hasAnswerPaper && (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}

                          {/* Edit mode with paper: View + Replace + Delete */}
                          {canEdit && hasAnswerPaper && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <a href={hasAnswerPaper} target="_blank" rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ textDecoration: 'none', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                View
                              </a>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}
                                onClick={() => fileInputRefs.current[student._id]?.click()}>
                                Replace
                              </button>
                              <button className="btn btn-danger btn-sm" style={{ fontSize: 12 }}
                                disabled={deleteAnswerPaperMutation.isPending}
                                onClick={() => deleteAnswerPaperMutation.mutate({ resultId: result._id, subjectId: activeSubjectId })}>
                                Delete
                              </button>
                            </div>
                          )}

                          {/* Edit mode without paper: Upload */}
                          {canEdit && !hasAnswerPaper && (
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}
                              onClick={() => fileInputRefs.current[student._id]?.click()}>
                              <Upload size={12} /> Upload
                            </button>
                          )}
                        </td>

                        {/* Hall Ticket */}
                        <td>
                          <button
                            disabled={hallTicketDownloading === student._id}
                            onClick={() => downloadHallTicket(student._id, student.name)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 7,
                              border: '1.5px solid var(--border)', background: 'white',
                              cursor: hallTicketDownloading === student._id ? 'not-allowed' : 'pointer',
                              fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                              opacity: hallTicketDownloading === student._id ? 0.6 : 1
                            }}>
                            <Ticket size={12} />
                            {hallTicketDownloading === student._id ? '...' : 'Hall Ticket'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Download Report Modal */}
      {showReportModal && (() => {
        const filteredStudents = reportStudents.filter(s =>
          !reportSearch || s.name.toLowerCase().includes(reportSearch.toLowerCase()) ||
          s.admissionNumber?.toLowerCase().includes(reportSearch.toLowerCase())
        );
        return (
          <Modal open onClose={() => setShowReportModal(false)} title="Download Student Report">
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Class</label>
                <select className="form-control" value={reportClassId}
                  onChange={e => { setReportClassId(e.target.value); setReportSearch(''); }}>
                  <option value="">Select class</option>
                  {exam.classes?.map(c => (
                    <option key={c._id} value={c._id}>{c.name} {c.section}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2, margin: 0 }}>
                <label className="form-label">Search Student</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input className="form-control" placeholder="Name or admission no..."
                    value={reportSearch} onChange={e => setReportSearch(e.target.value)}
                    style={{ paddingLeft: 32 }} />
                </div>
              </div>
            </div>

            {!reportClassId ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Select a class to see students
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No students found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {filteredStudents.map(student => {
                  const result = reportResultsData?.results?.find(
                    r => (r.student?._id || r.student) === student._id
                  );
                  const hasResult = !!result;
                  return (
                    <div key={student._id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10,
                      border: '1.5px solid var(--border)', background: 'white', gap: 12
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{student.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {student.admissionNumber}
                          {hasResult && (
                            <span style={{ marginLeft: 10 }}>
                              <span className="badge badge-info" style={{ fontSize: 11 }}>
                                {result.percentage?.toFixed(1)}% · {result.grade || '—'} · Rank #{result.rank || '—'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      {hasResult ? (
                        <button
                          disabled={reportDownloading === result._id}
                          onClick={() => downloadReportPDF(result._id, student.name)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '6px 14px', borderRadius: 8, border: 'none',
                            cursor: reportDownloading === result._id ? 'not-allowed' : 'pointer',
                            fontSize: 13, fontWeight: 600,
                            background: reportDownloading === result._id ? '#e2e8f0' : '#1a56e8',
                            color: reportDownloading === result._id ? 'var(--text-muted)' : 'white',
                            flexShrink: 0
                          }}>
                          <FileDown size={13} />
                          {reportDownloading === result._id ? 'Downloading...' : 'Download PDF'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>No result yet</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* Schedule Modal */}
      <Modal open={showScheduleModal} onClose={() => setShowScheduleModal(false)}
        title={`Set Exam Dates — ${exam?.classes?.find(c => c._id === activeClassId)?.name || ''} ${exam?.classes?.find(c => c._id === activeClassId)?.section || ''}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={saveScheduleMutation.isPending} onClick={handleSaveSchedule}>
            {saveScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
          </button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 140px 90px 90px 90px',
            gap: 8, padding: '6px 0', borderBottom: '2px solid var(--border)',
            marginBottom: 4
          }}>
            {['', 'Subject', 'Exam Date', 'Start', 'End', 'Room'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
            {classSubjects.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                No subjects assigned to this class
              </div>
            )}
            {classSubjects.map(s => {
              const included = scheduleState[s._id]?.included !== false;
              const toggle = () => setScheduleState(prev => ({
                ...prev, [s._id]: { ...prev[s._id], included: !included }
              }));
              const setField = (field, val) => setScheduleState(prev => ({
                ...prev, [s._id]: { ...prev[s._id], [field]: val }
              }));
              return (
                <div key={s._id} style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 140px 90px 90px 90px',
                  gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8,
                  background: included ? '#f8fafc' : '#f1f5f9',
                  border: `1px solid ${included ? 'var(--border)' : '#cbd5e1'}`,
                  opacity: included ? 1 : 0.55,
                  transition: 'all 0.15s'
                }}>
                  {/* Include toggle */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <input type="checkbox" checked={included} onChange={toggle}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: included ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.name}</div>
                    {s.code && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.code}</div>}
                  </div>
                  <input type="date" className="form-control" disabled={!included} style={{ fontSize: 12, padding: '5px 8px' }}
                    value={scheduleState[s._id]?.date || ''}
                    onChange={e => setField('date', e.target.value)} />
                  <input type="time" className="form-control" disabled={!included} style={{ fontSize: 12, padding: '5px 8px' }}
                    value={scheduleState[s._id]?.startTime || ''}
                    onChange={e => setField('startTime', e.target.value)} />
                  <input type="time" className="form-control" disabled={!included} style={{ fontSize: 12, padding: '5px 8px' }}
                    value={scheduleState[s._id]?.endTime || ''}
                    onChange={e => setField('endTime', e.target.value)} />
                  <input type="text" className="form-control" disabled={!included} placeholder="Room" style={{ fontSize: 12, padding: '5px 8px' }}
                    value={scheduleState[s._id]?.room || ''}
                    onChange={e => setField('room', e.target.value)} />
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Edit Exam Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Exam"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={updateExamMutation.isPending}
            onClick={handleEditSubmit(d => updateExamMutation.mutate({ ...d, classes: editSelectedClasses }))}>
            {updateExamMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </>}>
        <form onSubmit={e => e.preventDefault()}>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Exam Name *</label>
              <input className="form-control" {...regEdit('name', { required: true })} placeholder="e.g. First Term Exam" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <input className="form-control" {...regEdit('type')} placeholder="e.g. Unit Test, Mid Term..." />
            </div>
          </FormRow>

          <div className="form-group">
            <label className="form-label">Classes</label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'white',
              maxHeight: 130, overflowY: 'auto'
            }}>
              {allClasses.map(c => {
                const sel = editSelectedClasses.includes(c._id);
                return (
                  <button key={c._id} type="button" onClick={() => toggleEditClass(c._id)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                    border: `1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                    background: sel ? '#eff6ff' : 'white',
                    color: sel ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: sel ? 600 : 400
                  }}>{c.name} {c.section}</button>
                );
              })}
            </div>
          </div>

          <FormRow>
            <div className="form-group">
              <label className="form-label">Exam Date</label>
              <input className="form-control" type="date" {...regEdit('examDate')} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" {...regEdit('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </FormRow>
        </form>
      </Modal>
    </div>
  );
}
