import { useState, useRef, useEffect, useMemo } from 'react';
import { useYear } from '../../store/YearContext';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { Select, DatePicker, Dropdown } from 'antd';
import dayjs from 'dayjs';
import {
  Plus, Download, Trash2, GraduationCap, ArrowLeft,
  Edit, Phone, Mail, MapPin, BookOpen, Camera, ChevronLeft, ChevronRight, ChevronDown, Upload,
  IndianRupee, CreditCard, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import { Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput, Avatar, EmptyState, PageLoader, FormRow, ColumnSelector, useColumnSelector } from '../../components/ui';
import { BulkUploadModal } from '../../components/ui/BulkUploadModal';
import { format } from 'date-fns';

const STUDENT_COLS = [
  { key: 'classSection',      label: 'Class & Section',       required: true },
  { key: 'admissionNumber',   label: 'Admission Number',      required: true },
  { key: 'rollNumber',        label: 'Roll Number',           required: true },
  { key: 'gender',            label: 'Gender',                required: true },
  { key: 'dob',               label: 'Date of Birth',         required: true },
  { key: 'promotionStatus',   label: 'Promotion',             required: true },
  { key: 'status',            label: 'Status',                required: true },
  { key: 'parentName',        label: 'Parent Name',           required: true },
  { key: 'parentRelation',    label: 'Relationship',          required: true },
  { key: 'mobile',            label: 'Parent Mobile Number',  required: true },
  { key: 'alternateMobile',   label: 'Alternate Mobile Number' },
  { key: 'admissionDate',     label: 'Admission Date',        default: false },
  { key: 'transport',         label: 'Transport',             default: false },
  { key: 'address',           label: 'Home Address',          default: false },
];

const FORM_TABS = [
  { key: 'personal',  label: 'Personal Details' },
  { key: 'academics', label: 'Academics' },
  { key: 'parents',   label: 'More Contacts' },
  { key: 'others',    label: 'Others' },
];

const DETAIL_TABS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'more',        label: 'More Info' },
  { key: 'attendance',  label: 'Attendance' },
  { key: 'exams',       label: 'Exam Results' },
  { key: 'homeworks',   label: 'Home Works' },
  { key: 'fees',        label: 'Fees' },
];

export default function Students() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showTransferred, setShowTransferred] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [viewStudent, setViewStudent] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [promoteModal, setPromoteModal] = useState(false);
  const [promoteResult, setPromoteResult] = useState(null);
  const [transferModal, setTransferModal] = useState(false);
  const [rejoinModal, setRejoinModal] = useState(null); // student object
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [formTab, setFormTab] = useState('personal');
  const [studentStatus, setStudentStatus] = useState('active');

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const studentId = searchParams.get('student');
    if (!studentId) return;
    api.get(`/students/${studentId}`).then(res => {
      const stu = res.student || res;
      if (stu?._id) setViewStudent(stu);
    }).catch(() => {});
  }, [searchParams]);

  // Parents managed outside react-hook-form for card UX
  const [parents, setParents] = useState([]);
  const [parentForm, setParentForm] = useState(null); // null | 'add' | index(number)
  const [parentDraft, setParentDraft] = useState({ name: '', relationship: 'father', mobile: '', alternativeMobile: '' });

  // Profile image preview
  const [profilePreview, setProfilePreview] = useState(null);
  const imgInputRef = useRef(null);

  const { data: classesData } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });
  const classes = classesData?.classes || [];

  const { data: transportData } = useQuery({ queryKey: ['transport'], queryFn: () => api.get('/transport') });
  const transports = (transportData?.routes || []).filter(r => r.isActive);

  const [selectedTransport, setSelectedTransport] = useState('');
  const [busStop, setBusStop] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search, classFilter, showTransferred],
    queryFn: () => api.get(`/students?page=${page}&limit=20&search=${search}&classId=${classFilter}${showTransferred ? '&status=transferred' : ''}`),
    keepPreviousData: true
  });

  const students = data?.students || [];
  const total = data?.total || 0;
  // Plan usage cap (0 = unlimited). Hard-block Add once reached; backend enforces too.
  const studentCap = user?.subscription?.limits?.maxStudents || 0;
  const atStudentCap = studentCap > 0 && total >= studentCap;
  const pages = data?.pages || 1;

  const { register, handleSubmit, reset, watch, control, setValue, formState: { errors } } = useForm();

  const watchedClassGroup = watch('classGroup');
  const uniqueClassNames = [...new Set(classes.map(c => c.name))];
  const filteredSections = classes.filter(c => c.name === watchedClassGroup);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/students', data),
    onSuccess: () => { qc.invalidateQueries(['students']); toast.success('Student added!'); closeModal(); },
    onError: (err) => toast.error(err.message || 'Failed to add student')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/students/${id}`, data),
    onSuccess: (res) => {
      qc.invalidateQueries(['students']);
      toast.success('Student updated!');
      if (viewStudent) setViewStudent(res.student || res);
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to update student')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/students/${id}`),
    onSuccess: () => { qc.invalidateQueries(['students']); toast.success('Student deleted'); setDeleteId(null); }
  });

  const bulkDeleteMutation = async () => {
    await Promise.all(selected.map(id => api.delete(`/students/${id}`)));
    qc.invalidateQueries(['students']);
    setSelected([]);
    setBulkDeleteConfirm(false);
    toast.success(`${selected.length} student(s) deleted`);
  };

  const buildPayload = (data) => {
    const firstName = (data.firstName || '').trim();
    const lastName  = (data.lastName  || '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ');
    const classDoc = data.section
      ? classes.find(c => c.name === data.classGroup && c.section === data.section)
      : classes.find(c => c.name === data.classGroup);

    // Explicitly build a plain array to avoid React dev-mode Proxy serialisation issues
    // Primary guardian always comes from personal tab fields
    const guardiansPayload = [];
    if (data.parentName?.trim()) {
      guardiansPayload.push({
        name: data.parentName.trim(),
        relation: data.parentRelationship || 'father',
        phone: data.mobile || '',
        alternatePhone: data.alternativeMobile || '',
        email: '',
        language: 'en',
      });
    }
    // Additional guardians from "More Contacts" tab
    for (const p of Array.from(parents || [])) {
      guardiansPayload.push({
        name: p.name || '',
        relation: p.relationship || 'father',
        phone: p.mobile || '',
        alternatePhone: p.alternativeMobile || '',
        email: '',
        language: 'en',
      });
    }

    return {
      name,
      photo: profilePreview || undefined,
      status: studentStatus,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      phone: data.mobile,
      alternativeMobile: data.alternativeMobile || undefined,
      address: { street: data.address },
      admissionNumber: data.admissionNumber,
      admissionDate: data.admissionDate,
      currentClass: classDoc?._id,
      rollNumber: data.rollNumber,
      rollNumberManual: !!data.rollNumberManual,
      guardians: guardiansPayload,
      nationality: data.nationality,
      religion: data.religion,
      motherTongue: data.motherTongue,
      previousSchool: data.previousSchool,
      identificationMark: data.identificationMark,
      medicalInfo: { conditions: data.medicalIssue ? data.medicalIssue.split(',').map(s => s.trim()).filter(Boolean) : [] },
      remarks: data.remarks,
      transportRoute: selectedTransport || undefined,
      busStop: busStop.trim() || undefined,
    };
  };

  const onSubmit = (data) => {
    const payload = buildPayload(data);
    if (!payload.currentClass) delete payload.currentClass;
    if (!payload.phone) delete payload.phone;
    if (!payload.admissionDate) delete payload.admissionDate;
    if (!payload.admissionNumber) delete payload.admissionNumber;   // blank → server auto-generates
    if (!payload.rollNumber) delete payload.rollNumber;             // blank → server auto-assigns (A–Z)
    if (editStudent) {
      updateMutation.mutate({ id: editStudent._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditStudent(null);
    setFormTab('personal');
    setStudentStatus('active');
    setParents([]);
    setParentForm(null);
    setProfilePreview(null);
    setSelectedTransport('');
    setBusStop('');
    reset({});
  };

  const openAdd = () => {
    setEditStudent(null);
    setFormTab('personal');
    setSelectedTransport('');
    setBusStop('');
    setParents([]);
    setParentForm(null);
    setProfilePreview(null);
    reset({});
    setShowModal(true);
  };

  const openEdit = (stu) => {
    setEditStudent(stu);
    setFormTab('personal');
    const classDoc = classes.find(c => c._id === (stu.currentClass?._id || stu.currentClass));
    const nameParts = (stu.name || '').split(' ');
    reset({
      firstName: nameParts[0] || '',
      lastName:  nameParts.slice(1).join(' ') || '',
      gender: stu.gender || '',
      dateOfBirth: stu.dateOfBirth ? stu.dateOfBirth.slice(0, 10) : '',
      parentName: stu.guardians?.[0]?.name || '',
      parentRelationship: stu.guardians?.[0]?.relation || 'father',
      mobile: stu.phone || '',
      alternativeMobile: stu.alternativeMobile || '',
      address: stu.address?.street || '',
      admissionNumber: stu.admissionNumber || '',
      admissionDate: stu.admissionDate ? stu.admissionDate.slice(0, 10) : '',
      classGroup: classDoc?.name || '',
      section: classDoc?.section || '',
      rollNumber: stu.rollNumber || '',
      rollNumberManual: stu.rollNumberManual || false,
      nationality: stu.nationality || '',
      religion: stu.religion || '',
      motherTongue: stu.motherTongue || '',
      previousSchool: stu.previousSchool || '',
      identificationMark: stu.identificationMark || '',
      medicalIssue: stu.medicalInfo?.conditions?.join(', ') || '',
      remarks: stu.remarks || '',
    });
    setParents((stu.guardians || []).slice(1).map(g => ({
      name: g.name || '',
      relationship: g.relation || 'father',
      mobile: g.phone || '',
      alternativeMobile: g.alternatePhone || g.alternativeMobile || ''
    })));
    setStudentStatus(stu.status || 'active');
    setProfilePreview(stu.photo || null);
    setSelectedTransport(stu.transportRoute?._id || stu.transportRoute || '');
    setBusStop(stu.busStop || '');
    setParentForm(null);
    setShowModal(true);
  };

  const downloadAdmissionLetter = async (id) => {
    try {
      const res = await fetch(`/api/students/${id}/admission-letter-pdf`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ message: `Error ${res.status}` })); throw new Error(err.message); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'admission-letter.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message || 'Failed to generate PDF'); }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;
  const tabIdx = FORM_TABS.findIndex(t => t.key === formTab);
  const [visibleCols, setVisibleCols] = useColumnSelector('students', STUDENT_COLS);
  const col = (key) => visibleCols.has(key);

  // ── Detail page view ──────────────────────────────────────────────────
  if (viewStudent) {
    return (
      <>
        <StudentDetail
          student={viewStudent}
          classes={classes}
          onBack={() => setViewStudent(null)}
          onDelete={(id) => { setDeleteId(id); setViewStudent(null); }}
          onDownload={downloadAdmissionLetter}
          onEdit={(stu) => { openEdit(stu); setViewStudent(null); }}
          onRejoin={(stu) => setRejoinModal(stu)}
          onTransfer={(stu) => { setSelected([stu._id]); setTransferModal(true); }}
        />
        <ConfirmDialog
          open={!!deleteId} onClose={() => setDeleteId(null)}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          title="Delete Student" message="This will permanently delete the student and cannot be undone." danger
        />
        {/* Edit modal also needs to work from detail page */}
        <AddEditModal
          open={showModal} onClose={closeModal}
          editStudent={editStudent} isMutating={isMutating}
          formTab={formTab} setFormTab={setFormTab} tabIdx={tabIdx}
          register={register} errors={errors} handleSubmit={handleSubmit} onSubmit={onSubmit}
          uniqueClassNames={uniqueClassNames} filteredSections={filteredSections} watchedClassGroup={watchedClassGroup} classes={classes}
          parents={parents} setParents={setParents}
          parentForm={parentForm} setParentForm={setParentForm}
          parentDraft={parentDraft} setParentDraft={setParentDraft}
          profilePreview={profilePreview} setProfilePreview={setProfilePreview}
          imgInputRef={imgInputRef}
          studentStatus={studentStatus} setStudentStatus={setStudentStatus} control={control} setValue={setValue}
          transports={transports} selectedTransport={selectedTransport} setSelectedTransport={setSelectedTransport}
          busStop={busStop} setBusStop={setBusStop}
        />
        {transferModal && (
          <TransferModal
            selected={selected} students={[viewStudent]} classes={classes}
            onClose={() => setTransferModal(false)}
            onSuccess={() => { qc.invalidateQueries(['students']); setSelected([]); setTransferModal(false); setViewStudent(null); }}
          />
        )}
        {rejoinModal && (
          <RejoinModal
            student={rejoinModal} classes={classes}
            onClose={() => setRejoinModal(null)}
            onSuccess={() => { qc.invalidateQueries(['students']); setSelected([]); setRejoinModal(null); setViewStudent(null); }}
          />
        )}
      </>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-24-semibold">Students</h1>
          <p className="page-subtitle">{showTransferred ? `${total} transferred student${total !== 1 ? 's' : ''}` : `${total} students enrolled`}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (() => {
            const selectedStudents = students.filter(s => selected.includes(s._id));
            const allTransferred = selectedStudents.length > 0 && selectedStudents.every(s => s.status === 'transferred');
            const noneTransferred = selectedStudents.every(s => s.status !== 'transferred');
            return (
              <>
                {noneTransferred && (
                  <button className="btn btn-secondary" onClick={() => setPromoteModal(true)}>
                    <GraduationCap size={16} /> Promote ({selected.length})
                  </button>
                )}
                {noneTransferred && (
                  <button className="btn btn-secondary" onClick={() => setTransferModal(true)} style={{ color: '#b45309' }}>
                    <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} /> Transfer ({selected.length})
                  </button>
                )}
                {allTransferred && selected.length === 1 && (
                  <button className="btn btn-secondary" onClick={() => setRejoinModal(selectedStudents[0])} style={{ color: '#16a34a' }}>
                    <GraduationCap size={16} /> Rejoin School
                  </button>
                )}
              </>
            );
          })()}
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Upload size={14} /> Bulk Upload
          </button>
          {atStudentCap ? (
            <a href="/settings/subscription" className="btn btn-secondary" title={`Plan limit reached (${total}/${studentCap})`} style={{ textDecoration: 'none' }}>
              <Plus size={14} /> {total}/{studentCap} — Upgrade to add more
            </a>
          ) : (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={14} /> Add Student
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, admission no..." />
        <Select
          style={{ minWidth: 160 }}
          value={classFilter || undefined}
          placeholder="All Classes"
          allowClear
          onChange={val => { setClassFilter(val ?? ''); setPage(1); }}
          options={classes.map(c => ({ value: c._id, label: `${c.name}${c.section ? ` ${c.section}` : ''}` }))}
        />
        <button className={`btn btn-sm ${showTransferred ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setShowTransferred(v => !v); setPage(1); setSelected([]); }}>
          <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} /> Transferred
        </button>
        {selected.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={() => setBulkDeleteConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={15} /> Delete ({selected.length})
          </button>
        )}
        <ColumnSelector storageKey="students" cols={STUDENT_COLS} visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', minWidth: 36 }}>
                    <input type="checkbox" onChange={e => setSelected(e.target.checked ? students.map(s => s._id) : [])} />
                  </th>
                  <th style={{ whiteSpace: 'nowrap', minWidth: 200 }}>Student Name</th>
                  {col('classSection')       && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Class &amp; Section</th>}
                  {col('admissionNumber')    && <th style={{ whiteSpace: 'nowrap', minWidth: 160 }}>Admission Number</th>}
                  {col('rollNumber')         && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Roll Number</th>}
                  {col('gender')             && <th style={{ whiteSpace: 'nowrap', minWidth: 90 }}>Gender</th>}
                  {col('dob')                && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Date of Birth</th>}
                  {col('promotionStatus')    && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Promotion</th>}
                  {col('status')             && <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Status</th>}
                  {col('parentName')          && <th style={{ whiteSpace: 'nowrap', minWidth: 180 }}>Parent Name</th>}
                  {col('parentRelation')      && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Relationship</th>}
                  {col('mobile')             && <th style={{ whiteSpace: 'nowrap', minWidth: 170 }}>Parent Mobile Number</th>}
                  {col('alternateMobile')    && <th style={{ whiteSpace: 'nowrap', minWidth: 190 }}>Alternate Mobile Number</th>}
                  {col('admissionDate')      && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Admission Date</th>}
                  {col('transport')          && <th style={{ whiteSpace: 'nowrap', minWidth: 150 }}>Transport</th>}
                  {col('address')            && <th style={{ whiteSpace: 'nowrap', minWidth: 200 }}>Home Address</th>}
                  <th style={{ position: 'sticky', right: 0, zIndex: 3, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.08)', minWidth: 52 }}></th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 && (
                  <tr><td colSpan={15}>
                    <EmptyState icon={GraduationCap} message="No students found." action={<button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Student</button>} />
                  </td></tr>
                )}
                {students.map(stu => (
                  <tr key={stu._id} onClick={() => api.get(`/students/${stu._id}`).then(r => setViewStudent(r.student || r)).catch(() => setViewStudent(stu))} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(stu._id)} onChange={e => setSelected(p => e.target.checked ? [...p, stu._id] : p.filter(id => id !== stu._id))} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={stu.photo} name={stu.name} size={32} />
                        <span className="text-14-semibold" style={{ whiteSpace: 'nowrap' }}>{stu.name}</span>
                      </div>
                    </td>
                    {col('classSection')       && <td style={{ fontSize: 13 }}>{stu.currentClass ? `${stu.currentClass.name} – ${stu.currentClass.section}` : '—'}</td>}
                    {col('admissionNumber')    && <td style={{ fontSize: 13 }}><span className="badge badge-info">{stu.admissionNumber || '—'}</span></td>}
                    {col('rollNumber')         && <td style={{ fontSize: 13 }}>{stu.rollNumber || '—'}</td>}
                    {col('gender')             && <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{stu.gender || '—'}</td>}
                    {col('dob')                && <td style={{ fontSize: 13 }}>{stu.dateOfBirth ? format(new Date(stu.dateOfBirth), 'dd MMM yyyy') : '—'}</td>}
                    {col('promotionStatus')    && <td style={{ whiteSpace: 'nowrap' }}>{(() => {
                      if (stu.status === 'transferred') return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Transferred</span>;
                      if (stu.rejoinHistory?.length > 0) return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', whiteSpace: 'nowrap' }}>Rejoined</span>;
                      if (stu.promotionHistory?.length > 0) return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>Promoted</span>;
                      return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>Joined This Year</span>;
                    })()}</td>}
                    {col('status')             && <td><StatusBadge status={stu.status} /></td>}
                    {col('parentName')          && <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{stu.guardians?.[0]?.name || '—'}</td>}
                    {col('parentRelation')      && <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{stu.guardians?.[0]?.relation || '—'}</td>}
                    {col('mobile')             && <td style={{ fontSize: 13 }}>{stu.phone || '—'}</td>}
                    {col('alternateMobile')    && <td style={{ fontSize: 13 }}>{stu.alternativeMobile || '—'}</td>}
                    {col('admissionDate')      && <td style={{ fontSize: 13 }}>{stu.admissionDate ? format(new Date(stu.admissionDate), 'dd MMM yyyy') : '—'}</td>}
                    {col('transport')          && <td style={{ fontSize: 13 }}>{stu.transportRoute ? `${stu.transportRoute.routeNumber ? '#' + stu.transportRoute.routeNumber + ' · ' : ''}${stu.transportRoute.vehicleNumber || stu.transportRoute.routeName}` : '—'}</td>}
                    {col('address')            && <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.address?.street || '—'}</td>}
                    <td style={{ position: 'sticky', right: 0, zIndex: 2, background: 'white', boxShadow: '-2px 0 5px rgba(0,0,0,0.08)' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(stu)}>
                        <Edit size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      )}

      <AddEditModal
        open={showModal} onClose={closeModal}
        editStudent={editStudent} isMutating={isMutating}
        formTab={formTab} setFormTab={setFormTab} tabIdx={tabIdx}
        register={register} errors={errors} handleSubmit={handleSubmit} onSubmit={onSubmit}
        uniqueClassNames={uniqueClassNames} filteredSections={filteredSections} watchedClassGroup={watchedClassGroup}
        parents={parents} setParents={setParents}
        parentForm={parentForm} setParentForm={setParentForm}
        parentDraft={parentDraft} setParentDraft={setParentDraft}
        profilePreview={profilePreview} setProfilePreview={setProfilePreview}
        imgInputRef={imgInputRef}
        studentStatus={studentStatus} setStudentStatus={setStudentStatus} control={control}
        transports={transports} selectedTransport={selectedTransport} setSelectedTransport={setSelectedTransport}
        busStop={busStop} setBusStop={setBusStop}
        onDeleteStudent={(id) => { setDeleteId(id); closeModal(); }}
      />

      {promoteModal && (
        <PromoteModal selected={selected} classes={classes} students={students}
          onClose={() => setPromoteModal(false)}
          onSuccess={(result) => {
            qc.invalidateQueries(['students']);
            setSelected([]);
            setPromoteModal(false);
            setPromoteResult(result);
          }}
        />
      )}
      {promoteResult && (
        <PromotionSuccessModal result={promoteResult} onClose={() => setPromoteResult(null)} />
      )}
      {transferModal && (
        <TransferModal
          selected={selected} students={students} classes={classes}
          onClose={() => setTransferModal(false)}
          onSuccess={() => { qc.invalidateQueries(['students']); setSelected([]); setTransferModal(false); }}
        />
      )}
      {rejoinModal && (
        <RejoinModal
          student={rejoinModal} classes={classes}
          onClose={() => setRejoinModal(null)}
          onSuccess={() => { qc.invalidateQueries(['students']); setSelected([]); setRejoinModal(null); }}
        />
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Delete Student" message="This will permanently delete the student and cannot be undone." danger
      />
      <ConfirmDialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={bulkDeleteMutation}
        title="Delete Students" message={`This will permanently delete ${selected.length} student(s) and cannot be undone.`} danger
      />
      <BulkUploadModal open={showBulkModal} onClose={() => setShowBulkModal(false)} type="student" onSuccess={() => qc.invalidateQueries(['students'])} />
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function AddEditModal({
  open, onClose, editStudent, isMutating,
  formTab, setFormTab, tabIdx,
  register, errors, handleSubmit, onSubmit,
  uniqueClassNames, filteredSections, watchedClassGroup, classes,
  parents, setParents, parentForm, setParentForm, parentDraft, setParentDraft,
  profilePreview, setProfilePreview, imgInputRef,
  studentStatus, setStudentStatus, control, setValue,
  transports, selectedTransport, setSelectedTransport, busStop, setBusStop
}) {
  // useWatch subscribes to field changes inside this component and re-renders reactively
  const watched = useWatch({
    control,
    name: ['firstName', 'lastName', 'gender', 'dateOfBirth', 'parentName', 'parentRelationship',
           'mobile', 'address', 'admissionDate', 'classGroup']
  });
  const isFormReady = watched.every(v => v !== undefined && v !== null && String(v).trim() !== '');

  // Admission & roll numbers auto-generate; an edit toggle unlocks manual entry.
  const [editAdmission, setEditAdmission] = useState(false);
  const [editRoll, setEditRoll] = useState(false);
  useEffect(() => {
    setEditAdmission(false);
    setEditRoll(!!editStudent?.rollNumberManual);
  }, [open, editStudent]);
  const toggleRoll = () => {
    setEditRoll(prev => {
      const next = !prev;
      setValue('rollNumberManual', next, { shouldDirty: true });
      if (!next) setValue('rollNumber', '');
      return next;
    });
  };

  // Add mode: preview the auto-generated admission & roll numbers in the form
  // (debounced) so the admin sees the values before saving.
  const wClassGroup = useWatch({ control, name: 'classGroup' });
  const wSection = useWatch({ control, name: 'section' });
  const wFirst = useWatch({ control, name: 'firstName' });
  const wLast = useWatch({ control, name: 'lastName' });
  useEffect(() => {
    if (editStudent || !open) return;
    const t = setTimeout(() => {
      const fullName = [wFirst, wLast].filter(Boolean).join(' ').trim();
      const classDoc = wSection
        ? (classes || []).find(c => c.name === wClassGroup && c.section === wSection)
        : (classes || []).find(c => c.name === wClassGroup);
      const params = new URLSearchParams();
      if (classDoc?._id) params.set('classId', classDoc._id);
      if (fullName) params.set('name', fullName);
      api.get(`/students/next-codes?${params}`).then(r => {
        if (!editAdmission) setValue('admissionNumber', r.admissionNumber || '');
        if (!editRoll) setValue('rollNumber', r.rollNumber || '');
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [open, editStudent, wClassGroup, wSection, wFirst, wLast, editAdmission, editRoll]);
  const saveParent = () => {
    if (!parentDraft.name || !parentDraft.mobile) return toast.error('Name and mobile are required');
    if (typeof parentForm === 'number') {
      setParents(p => p.map((x, i) => i === parentForm ? parentDraft : x));
    } else {
      setParents(p => [...p, parentDraft]);
    }
    setParentDraft({ name: '', relationship: 'father', mobile: '', alternativeMobile: '' });
    setParentForm(null);
  };

  const deleteParent = (idx) => setParents(p => p.filter((_, i) => i !== idx));

  const editParent = (idx) => {
    setParentDraft({ ...parents[idx] });
    setParentForm(idx);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProfilePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleTabSwitch = (targetTabKey) => {
    if (formTab === targetTabKey) return;
    
    const values = control._formValues;
    if (formTab === 'personal') {
      const req = [
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'dateOfBirth', label: 'Date of Birth' },
        { key: 'parentName', label: 'Parent Name' },
        { key: 'parentRelationship', label: 'Relationship' },
        { key: 'mobile', label: 'Parent Mobile Number' },
        { key: 'address', label: 'Address' }
      ];
      for (const f of req) {
        if (!values[f.key]) return toast.error(`Please fill the mandatory field: ${f.label}`);
      }
    } else if (formTab === 'academics') {
      // Admission & roll numbers auto-generate, so they aren't required here.
      const req = [
        { key: 'admissionDate', label: 'Admission Date' },
        { key: 'classGroup', label: 'Class Group' }
      ];
      for (const f of req) {
        if (!values[f.key]) return toast.error(`Please fill the mandatory field: ${f.label}`);
      }
    }
    setFormTab(targetTabKey);
  };

  return (
    <Modal open={open} onClose={onClose} title={editStudent ? 'Edit Student' : 'Add New Student'} size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
          {/* Left: Cancel / Previous */}
          <button className="btn btn-secondary" onClick={() => tabIdx > 0 ? setFormTab(FORM_TABS[tabIdx - 1].key) : onClose()}>
            {tabIdx > 0 ? <><ChevronLeft size={15} /> Previous</> : 'Cancel'}
          </button>

          {/* Right: Next (on tabs 1–3) + Add Student (always) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tabIdx < FORM_TABS.length - 1 && (
              <button type="button" className="btn btn-secondary" onClick={() => handleTabSwitch(FORM_TABS[tabIdx + 1].key)}>
                Next <ChevronRight size={15} />
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSubmit(onSubmit)}
              disabled={!isFormReady || isMutating}
              title={!isFormReady ? 'Fill all required fields across all tabs' : ''}
            >
              {isMutating
                ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving…</>
                : editStudent ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </div>
      }
    >
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {FORM_TABS.map((tab, i) => {
          const active = formTab === tab.key;
          const done = i < tabIdx;
          return (
            <button key={tab.key} type="button" onClick={() => handleTabSwitch(tab.key)}
              style={{
                flex: 1, padding: '10px 8px', border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
                color: active ? 'var(--primary)' : done ? '#10b981' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400, fontSize: 13, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                background: active ? 'var(--primary)' : done ? '#10b981' : '#e2e8f0',
                color: active || done ? 'white' : 'var(--text-muted)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{done ? '✓' : i + 1}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      <form>
        {/* ── Tab 1: Personal Details ── */}
        {formTab === 'personal' && (
          <>
            {/* Profile image */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => imgInputRef.current?.click()}>
                <div style={{
                  width: 90, height: 90, borderRadius: '50%', overflow: 'hidden',
                  background: profilePreview ? 'transparent' : '#f1f5f9',
                  border: '3px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {profilePreview
                    ? <img src={profilePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Camera size={28} color="var(--text-muted)" />
                  }
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0, width: 26, height: 26,
                  background: 'var(--primary)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid white',
                }}>
                  <Camera size={13} color="white" />
                </div>
              </div>
              <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            </div>

            <FormRow>
              <div className="form-group">
                <label className="form-label">First Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('firstName', { required: 'Required' })} placeholder="First name" />
                {errors.firstName && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.firstName.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('lastName', { required: 'Required' })} placeholder="Last name" />
                {errors.lastName && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.lastName.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Gender <span style={{ color: '#ef4444' }}>*</span></label>
                <Controller name="gender" control={control} rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select gender" status={errors.gender ? 'error' : ''}
                      options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]}
                    />
                  )}
                />
                {errors.gender && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.gender.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                <Controller name="dateOfBirth" control={control} rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Select date of birth"
                      status={errors.dateOfBirth ? 'error' : ''}
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                      disabledDate={(d) => d && d > dayjs().endOf('day')}
                      getPopupContainer={() => document.body}
                    />
                  )}
                />
                {errors.dateOfBirth && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.dateOfBirth.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Parent Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('parentName', { required: 'Required' })} placeholder="Full name of parent/guardian" />
                {errors.parentName && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.parentName.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Relationship <span style={{ color: '#ef4444' }}>*</span></label>
                <Controller name="parentRelationship" control={control} rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select relationship" status={errors.parentRelationship ? 'error' : ''}
                      options={['father','mother','guardian','other'].map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                    />
                  )}
                />
                {errors.parentRelationship && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.parentRelationship.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Parent Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="tel" maxLength={10} {...register('mobile', { required: 'Required', pattern: { value: /^[0-9]{10}$/, message: 'Enter valid 10-digit number' } })} placeholder="9876543210" onInput={e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }} />
                {errors.mobile && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.mobile.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Alternate Mobile Number</label>
                <input className="form-control" type="tel" maxLength={10} {...register('alternativeMobile', { pattern: { value: /^[0-9]{10}$/, message: 'Enter valid 10-digit number' } })} placeholder="9876543210" onInput={e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Assign Transport</label>
                <Select
                  style={{ width: '100%' }}
                  placeholder="No transport"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={selectedTransport || undefined}
                  onChange={v => setSelectedTransport(v || '')}
                  options={[
                    { value: '', label: 'No transport' },
                    ...(transports || []).map(t => ({
                      value: t._id,
                      label: `${t.routeNumber ? `#${t.routeNumber}` : ''}${t.vehicleNumber ? ` · ${t.vehicleNumber}` : ''}${t.routeName ? ` — ${t.routeName}` : ''}`.trim()
                    }))
                  ]}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Bus Stop</label>
                <input className="form-control" list="busStopOptions"
                  value={busStop} onChange={e => setBusStop(e.target.value)}
                  placeholder={selectedTransport ? 'Select or type bus stop' : 'Assign a route first'}
                  disabled={!selectedTransport} />
                <datalist id="busStopOptions">
                  {((transports || []).find(t => t._id === selectedTransport)?.stops || [])
                    .filter(s => s?.name)
                    .map((s, i) => <option key={i} value={s.name} />)}
                </datalist>
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Status <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                  <button type="button"
                    onClick={() => setStudentStatus('active')}
                    style={{
                      padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                      background: studentStatus === 'active' ? '#10b981' : '#f8fafc',
                      color: studentStatus === 'active' ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                    Active
                  </button>
                  <button type="button"
                    onClick={() => setStudentStatus('inactive')}
                    style={{
                      padding: '8px 20px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                      background: studentStatus === 'inactive' ? '#ef4444' : '#f8fafc',
                      color: studentStatus === 'inactive' ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                    Inactive
                  </button>
                </div>
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Home Address <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-control" {...register('address', { required: 'Required' })} placeholder="Street, City, Pincode" />
              {errors.address && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.address.message}</p>}
            </div>
          </>
        )}

        {/* ── Tab 2: Academics ── */}
        {formTab === 'academics' && (
          <>
            <FormRow>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Admission Number
                  {!editAdmission && <span style={{ fontSize: 10, fontWeight: 700, color: '#1a56e8', background: '#eff6ff', padding: '1px 7px', borderRadius: 6 }}>AUTO</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" {...register('admissionNumber')} readOnly={!editAdmission}
                    placeholder={editStudent ? '' : 'Auto-generated on save'}
                    style={{ background: editAdmission ? '#fff' : '#f8fafc', flex: 1 }} />
                  <button type="button" className="btn btn-secondary btn-icon" title={editAdmission ? 'Lock' : 'Edit'} onClick={() => setEditAdmission(e => !e)}>
                    {editAdmission ? <Lock size={15} /> : <Edit size={15} />}
                  </button>
                </div>
                <small style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {editAdmission ? 'Custom admission number.' : 'Generated automatically — click edit to override.'}
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Admission Date <span style={{ color: '#ef4444' }}>*</span></label>
                <Controller name="admissionDate" control={control} rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Select admission date"
                      status={errors.admissionDate ? 'error' : ''}
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                      getPopupContainer={() => document.body}
                    />
                  )}
                />
                {errors.admissionDate && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.admissionDate.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Class <span style={{ color: '#ef4444' }}>*</span></label>
                <Controller name="classGroup" control={control} rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select class" showSearch
                      status={errors.classGroup ? 'error' : ''}
                      onChange={v => { field.onChange(v); setValue('section', undefined); }}
                      options={uniqueClassNames.map(n => ({ value: n, label: n }))}
                    />
                  )}
                />
                {errors.classGroup && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.classGroup.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Section</label>
                <Controller name="section" control={control}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select section"
                      disabled={!watchedClassGroup}
                      allowClear
                      options={filteredSections.map(c => ({ value: c.section, label: c.section }))}
                    />
                  )}
                />
              </div>
            </FormRow>
            <div className="form-group" style={{ maxWidth: '50%' }}>
              <input type="hidden" {...register('rollNumberManual')} />
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Roll Number
                {!editRoll && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '1px 7px', borderRadius: 6 }}>AUTO · A–Z</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-control" {...register('rollNumber')} readOnly={!editRoll}
                  placeholder={editStudent ? '' : 'Auto-assigned (A–Z)'}
                  style={{ background: editRoll ? '#fff' : '#f8fafc', flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-icon" title={editRoll ? 'Use auto' : 'Edit'} onClick={toggleRoll}>
                  {editRoll ? <Lock size={15} /> : <Edit size={15} />}
                </button>
              </div>
              <small style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                {editRoll ? 'Custom roll number.' : 'Assigned alphabetically by name within the class — click edit to override.'}
              </small>
            </div>
          </>
        )}

        {/* ── Tab 3: Parent Contacts ── */}
        {formTab === 'parents' && (
          <>
            {/* Parent cards */}
            {parents.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {parents.map((p, idx) => (
                  parentForm === idx ? (
                    <ParentFormInline key={idx}
                      draft={parentDraft} setDraft={setParentDraft}
                      onSave={saveParent} onCancel={() => { setParentForm(null); setParentDraft({ name: '', relationship: 'father', mobile: '', alternativeMobile: '' }); }}
                    />
                  ) : (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: '12px 14px', borderRadius: 10, marginBottom: 10, border: '1px solid var(--border)' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 16, flexShrink: 0
                      }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="text-14-semibold">{p.name}</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                          <span style={{ fontSize: 12, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{p.relationship}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.mobile}</span>
                          {p.alternativeMobile && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.alternativeMobile}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => editParent(idx)}><Edit size={13} /></button>
                        <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => deleteParent(idx)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Add parent form */}
            {parentForm === 'add' ? (
              <ParentFormInline
                draft={parentDraft} setDraft={setParentDraft}
                onSave={saveParent} onCancel={() => { setParentForm(null); setParentDraft({ name: '', relationship: 'father', mobile: '', alternativeMobile: '' }); }}
              />
            ) : (
              <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}
                onClick={() => { setParentDraft({ name: '', relationship: 'father', mobile: '', alternativeMobile: '' }); setParentForm('add'); }}>
                <Plus size={16} /> Add Parent
              </button>
            )}

            {parents.length === 0 && parentForm === null && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>No parents added yet. Click "Add Parent" above.</p>
            )}
          </>
        )}

        {/* ── Tab 4: Others ── */}
        {formTab === 'others' && (
          <>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Nationality</label>
                <input className="form-control" {...register('nationality')} placeholder="e.g. Indian" />
              </div>
              <div className="form-group">
                <label className="form-label">Religion</label>
                <input className="form-control" {...register('religion')} placeholder="e.g. Hindu" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Mother Tongue</label>
                <Controller name="motherTongue" control={control}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select language" allowClear showSearch
                      options={['Tamil','Telugu','Kannada','Malayalam','Hindi','English','Urdu','Other'].map(l => ({ value: l, label: l }))}
                    />
                  )}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Previous School Name</label>
                <input className="form-control" {...register('previousSchool')} placeholder="e.g. ABC Primary School" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Medical Issue</label>
                <input className="form-control" {...register('medicalIssue')} placeholder="e.g. Asthma, Diabetes (comma separated)" />
              </div>
              <div className="form-group">
                <label className="form-label">Identification Mark</label>
                <input className="form-control" {...register('identificationMark')} placeholder="e.g. Mole on left cheek" />
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" {...register('remarks')} placeholder="Any additional remarks..." rows={3} style={{ resize: 'vertical' }} />
            </div>
          </>
        )}
      </form>

    </Modal>
  );
}

function ParentFormInline({ draft, setDraft, onSave, onCancel }) {
  return (
    <div style={{ background: '#eff6ff', padding: 16, borderRadius: 10, marginBottom: 12, border: '1px solid #bfdbfe' }}>
      <FormRow>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Parent Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Parent full name" />
        </div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Relationship <span style={{ color: '#ef4444' }}>*</span></label>
          <Select
            style={{ width: '100%' }}
            value={draft.relationship}
            onChange={v => setDraft(d => ({ ...d, relationship: v }))}
            options={['father','mother','guardian','other'].map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
          />
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" type="tel" maxLength={10} value={draft.mobile} onChange={e => setDraft(d => ({ ...d, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="9876543210" />
        </div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Alternative Mobile</label>
          <input className="form-control" type="tel" maxLength={10} value={draft.alternativeMobile} onChange={e => setDraft(d => ({ ...d, alternativeMobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="9876543210" />
        </div>
      </FormRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onSave}>Save Parent</button>
      </div>
    </div>
  );
}

// ── Student Detail Page ───────────────────────────────────────────────────────
function StudentDetail({ student, onBack, onDelete, onDownload, onEdit, onRejoin, onTransfer }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [zoomImage, setZoomImage] = useState(false);
  const { startMonth, endMonth, isCurrent } = useYear();

  // Build class/year options from classHistory (newest first).
  // Fallback to currentClass + academicYear for students without history yet.
  const classYearOptions = useMemo(() => {
    const now = new Date();
    const buildRange = (ay) => {
      const startCalYear = parseInt(ay);
      const endCalYear = endMonth < startMonth ? startCalYear + 1 : startCalYear;
      return {
        startDate: new Date(startCalYear, startMonth - 1, 1).toISOString().slice(0, 10),
        endDate:   new Date(endCalYear, endMonth, 0).toISOString().slice(0, 10),
      };
    };

    let entries = [];
    if (student.classHistory?.length) {
      entries = [...student.classHistory]
        .reverse()   // last-added entry is always the current class (promotion/rejoin preserves insertion order)
        .map(h => ({
          classId:     h.classId?._id || h.classId,
          className:   h.classId?.name  || h.className,
          section:     h.classId?.section || h.section,
          academicYear: h.academicYear,
          ...buildRange(h.academicYear),
        }));
    } else if (student.currentClass && student.academicYear) {
      const ci = student.currentClass;
      entries = [{
        classId:     ci._id || ci,
        className:   ci.name || '',
        section:     ci.section || '',
        academicYear: student.academicYear,
        ...buildRange(student.academicYear),
      }];
    }
    // Supplement with transferHistory entries missing from classHistory.
    // This handles students admitted before classHistory seeding was added —
    // their original class won't be in classHistory but IS in transferHistory.
    if (student.transferHistory?.length) {
      for (const t of student.transferHistory) {
        const ay = t.academicYearAtTransfer;
        const cn = t.classAtTransfer;
        const sec = t.sectionAtTransfer;
        if (!ay) continue;
        const alreadyCovered = entries.some(e =>
          e.academicYear === ay && e.className === cn && e.section === sec
        );
        if (!alreadyCovered) {
          entries.push({
            classId: null,
            className: cn || '',
            section: sec || '',
            academicYear: ay,
            startedAt: null,
            ...buildRange(ay, null),
          });
        }
      }
    }

    return entries;
  }, [student, startMonth, endMonth]);

  const [selectedCYIdx, setSelectedCYIdx] = useState(0);
  const classYear = classYearOptions[selectedCYIdx] || null;

  const classInfo = student.currentClass;
  const primaryGuardian = student.guardians?.[0];

  // Header attendance widget: single-month, based on selected classYear
  const now = new Date();
  const attMonth = (classYear && classYear.academicYear === student.academicYear && isCurrent)
    ? (now.getMonth() + 1)
    : startMonth;
  const attYear = classYear ? parseInt(classYear.academicYear) : now.getFullYear();

  const { data: attData } = useQuery({
    queryKey: ['student-att-summary', student._id, attMonth, attYear],
    queryFn: () => api.get(`/attendance/summary?studentId=${student._id}&month=${attMonth}&year=${attYear}`),
    enabled: !!student._id,
    staleTime: 0,
  });
  const attSummary = attData?.summary;

  // Fetch all fees once to know which years have a pending balance
  const { data: allFeesData } = useQuery({
    queryKey: ['student-fees-all', student._id],
    queryFn: () => api.get(`/fees?studentId=${student._id}&limit=200`),
    enabled: !!student._id,
  });
  const yearsWithPendingFees = useMemo(() => {
    const s = new Set();
    (allFeesData?.fees || []).forEach(f => {
      if ((f.pendingAmount > 0 || ['pending','partial','overdue'].includes(f.status)) && f.academicYear) {
        s.add(f.academicYear);
      }
    });
    return s;
  }, [allFeesData]);

  return (
    <div>
      {/* Page nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Class / Year selector — Ant Dropdown, shown only when student has 2+ years */}
          {classYearOptions.length > 1 && (() => {
            const cy = classYearOptions[selectedCYIdx];
            const label = `${cy.className}${cy.section ? ` ${cy.section}` : ''} — ${cy.academicYear}`;
            const hasPendingSelected = yearsWithPendingFees.has(cy.academicYear);
            const items = classYearOptions.map((opt, i) => {
              const hasPending = yearsWithPendingFees.has(opt.academicYear);
              return {
                key: String(i),
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: i === selectedCYIdx ? 600 : 400 }}>
                    <span>{opt.className}{opt.section ? ` ${opt.section}` : ''} — {opt.academicYear}</span>
                    {i === 0 && (
                      <span style={{ fontSize: 10, color: '#60a5fa', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '1px 6px' }}>Latest</span>
                    )}
                    {hasPending && (
                      <span style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1px 6px' }}>Pending Fees</span>
                    )}
                  </span>
                ),
              };
            });
            return (
              <Dropdown
                menu={{ items, onClick: ({ key }) => setSelectedCYIdx(Number(key)), selectedKeys: [String(selectedCYIdx)] }}
                trigger={['click']}
                placement="bottomRight">
                <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', border: '1px solid var(--primary)', background: '#eff6ff' }}>
                  <BookOpen size={13} />
                  {label}
                  {hasPendingSelected && (
                    <span style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1px 6px', lineHeight: 1.4 }}>Pending Fees</span>
                  )}
                  <ChevronDown size={13} />
                </button>
              </Dropdown>
            );
          })()}
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(student)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Edit size={14} /> Edit
          </button>
          {student.status === 'transferred' ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => onRejoin?.(student)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', borderColor: '#86efac' }}>
                <GraduationCap size={14} /> Rejoin School
              </button>
              {student.transferHistory?.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  try {
                    const res = await fetch(`/api/students/${student._id}/transfer-certificate`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                    if (!res.ok) throw new Error('Failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `TC_${student.admissionNumber || student._id}.pdf`;
                    a.click(); URL.revokeObjectURL(url);
                  } catch { toast.error('Failed to download TC'); }
                }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> Transfer Certificate
                </button>
              )}
            </>
          ) : (
            <>
              {student.promotionHistory?.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  try {
                    const res = await fetch(`/api/students/${student._id}/promotion-card`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                    if (!res.ok) throw new Error('Failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `PromotionCard_${student.admissionNumber || student._id}.pdf`;
                    a.click(); URL.revokeObjectURL(url);
                  } catch { toast.error('Failed to download promotion card'); }
                }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GraduationCap size={14} /> Promotion Card
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => onDownload(student._id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Admission Letter
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onTransfer?.(student)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309' }}>
                <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} /> Transfer
              </button>
            </>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(student._id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* ── Profile header card ── */}
      <div className="card" style={{ padding: '14px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div onClick={() => student.photo && setZoomImage(true)} style={{ cursor: student.photo ? 'zoom-in' : 'default', flexShrink: 0 }}>
            <Avatar src={student.photo} name={student.name} size={76} />
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{student.name}</h2>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: student.status === 'active' ? '#10b981' : '#94a3b8', flexShrink: 0 }} title={student.status} />
              {student.admissionNumber && <span className="badge badge-info">{student.admissionNumber}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {classInfo && (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BookOpen size={13} /> {classInfo.name} — Section {classInfo.section}
                </span>
              )}
              {student.rollNumber && (
                <><span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, fontWeight: 700 }}>·</span><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Roll No: {student.rollNumber}</span></>
              )}
              {student.gender && (
                <><span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, fontWeight: 700 }}>·</span><span style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{student.gender}</span></>
              )}
              {student.dateOfBirth && (
                <><span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, fontWeight: 700 }}>·</span><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{format(new Date(student.dateOfBirth), 'dd MMM yyyy')}</span></>
              )}
            </div>

          </div>

          {/* Attendance circle */}
          {attSummary && (
            <AttendanceCircle percentage={attSummary.percentage} present={attSummary.present} total={attSummary.total} />
          )}

        </div>
      </div>

      {/* ── Tabs + Two-column content ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px' }}>
          {DETAIL_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 0', marginRight: 32, border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400, fontSize: 14, transition: 'all 0.15s',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 28 }}>

          {/* ── Tab 1: Overview (Personal + Academics) ── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 260px', gap: 0, alignItems: 'start' }}>

              {/* Left: main sections */}
              <div style={{ paddingRight: 32 }}>
                <div style={{ marginBottom: 32 }}>
                  <SectionTitle>Academic Details</SectionTitle>
                  <DetailRow label="Admission Number" value={student.admissionNumber} />
                  <DetailRow label="Admission Date"   value={student.admissionDate ? format(new Date(student.admissionDate), 'dd MMM yyyy') : null} />
                  <DetailRow label="Class"            value={classInfo ? `${classInfo.name} — Section ${classInfo.section}` : null} />
                  <DetailRow label="Roll Number"      value={student.rollNumber} />
                  {student.academicYear && <DetailRow label="Academic Year" value={student.academicYear} />}
                </div>

                <div>
                  <SectionTitle>Personal Details</SectionTitle>
                  <DetailRow label="Full Name"     value={student.name} />
                  <DetailRow label="Gender"        value={student.gender}  capitalize />
                  <DetailRow label="Date of Birth" value={student.dateOfBirth ? format(new Date(student.dateOfBirth), 'dd MMM yyyy') : null} />
                  <DetailRow label="Status"        value={student.status}  capitalize />
                  {student.bloodGroup    && <DetailRow label="Blood Group"   value={student.bloodGroup} />}
                  {student.category      && <DetailRow label="Category"      value={student.category?.toUpperCase()} />}
                  {student.aadharNumber  && <DetailRow label="Aadhar Number" value={student.aadharNumber} />}
                </div>
              </div>

              {/* Vertical divider */}
              <div style={{ background: 'var(--border)', width: 1, alignSelf: 'stretch' }} />

              {/* Right: sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingLeft: 32 }}>

                {/* Parent Contact */}
                {primaryGuardian && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                      Parent Contact
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', background: 'var(--primary)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0
                      }}>
                        {primaryGuardian.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{primaryGuardian.name}</div>
                        <span style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                          {primaryGuardian.relation}
                        </span>
                      </div>
                    </div>
                    {student.phone && (
                      <SidebarItem icon={Phone} value={student.phone} />
                    )}
                    {student.alternativeMobile && (
                      <SidebarItem icon={Phone} value={`${student.alternativeMobile} (Alt)`} />
                    )}
                  </div>
                )}

                {/* Divider */}
                {(primaryGuardian || student.address?.street) && student.address?.street &&
                  <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />}

                {/* Address */}
                {student.address?.street && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Address
                    </div>
                    <SidebarItem icon={MapPin} value={student.address.street} />
                  </div>
                )}

                {/* Divider */}
                {student.address?.street && student.transportRoute &&
                  <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />}

                {/* Transport */}
                {student.transportRoute && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Transport
                    </div>
                    <span style={{
                      background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, display: 'inline-block'
                    }}>
                      🚌 {student.transportRoute.routeNumber ? `#${student.transportRoute.routeNumber} · ` : ''}{student.transportRoute.vehicleNumber || student.transportRoute.routeName}
                    </span>
                    {student.busStop && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Bus Stop: </span>{student.busStop}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Tab 2: More Info (Contacts + Others) ── */}
          {activeTab === 'more' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 260px', gap: 0, alignItems: 'start' }}>

              {/* Left: Guardian cards */}
              <div style={{ paddingRight: 32 }}>
                <SectionTitle>Parent / Guardian Contacts</SectionTitle>
                {student.guardians?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {student.guardians.map((g, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: i === 0 ? 'var(--primary)' : '#64748b',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 17, flexShrink: 0
                        }}>
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</span>
                            {i === 0 && <span style={{ fontSize: 10, background: '#dbeafe', color: 'var(--primary)', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>Primary</span>}
                          </div>
                          <span style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{g.relation}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          {g.phone && <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={12} color="var(--text-muted)" /> {g.phone}</span>}
                          {(g.alternatePhone || g.alternativeMobile) && <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={11} color="var(--text-muted)" /> {g.alternatePhone || g.alternativeMobile} (Alt)</span>}
                          {g.email && <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={11} color="var(--text-muted)" /> {g.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No contacts added.</p>
                )}
              </div>

              {/* Vertical divider */}
              <div style={{ background: 'var(--border)', width: 1, alignSelf: 'stretch' }} />

              {/* Right: Background + Medical + Remarks sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingLeft: 32 }}>

                {(student.nationality || student.religion || student.motherTongue || student.previousSchool || student.identificationMark) && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Background</div>
                    {student.nationality        && <SidebarRow label="Nationality"   value={student.nationality} />}
                    {student.religion           && <SidebarRow label="Religion"      value={student.religion} />}
                    {student.motherTongue       && <SidebarRow label="Mother Tongue" value={student.motherTongue} />}
                    {student.previousSchool     && <SidebarRow label="Prev. School"  value={student.previousSchool} />}
                    {student.identificationMark && <SidebarRow label="ID Mark"       value={student.identificationMark} />}
                  </div>
                )}

                {student.medicalInfo?.conditions?.length > 0 && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Medical</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {student.medicalInfo.conditions.map(c => <span key={c} className="badge badge-secondary">{c}</span>)}
                      </div>
                    </div>
                  </>
                )}

                {student.remarks && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Remarks</div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{student.remarks}</p>
                    </div>
                  </>
                )}

                {!student.nationality && !student.religion && !student.motherTongue && !student.previousSchool && !student.identificationMark && !student.medicalInfo?.conditions?.length && !student.remarks && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No additional information.</p>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 3: Attendance ── */}
          {activeTab === 'attendance' && <AttendanceTab student={student} classYear={classYear} />}

          {/* ── Tab 4: Exam Results ── */}
          {activeTab === 'exams' && <ExamResultsTab student={student} classYear={classYear} />}

          {/* ── Tab 4: Home Works ── */}
          {activeTab === 'homeworks' && <HomeworkTab student={student} classYear={classYear} />}

          {/* ── Tab 5: Fees ── */}
          {activeTab === 'fees' && <FeesTab student={student} classYear={classYear} />}

        </div>
      </div>

      {/* Photo zoom overlay */}
      {zoomImage && student.photo && (
        <div onClick={() => setZoomImage(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={student.photo} alt={student.name} onClick={e => e.stopPropagation()} style={{ width: 320, height: 320, objectFit: 'cover', borderRadius: '50%', border: '4px solid white', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', cursor: 'default' }} />
        </div>
      )}
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_META = {
  present:  { label: 'P',  full: 'Present',      color: '#10b981', bg: '#dcfce7' },
  absent:   { label: 'A',  full: 'Absent',       color: '#ef4444', bg: '#fee2e2' },
  late:     { label: 'L',  full: 'Late',          color: '#f59e0b', bg: '#fef3c7' },
  excused:  { label: 'E',  full: 'Excused',      color: '#6366f1', bg: '#ede9fe' },
  half_day: { label: 'H',  full: 'Half Day',     color: '#8b5cf6', bg: '#f3e8ff' },
  od:       { label: 'OD', full: 'On Duty',      color: '#0891b2', bg: '#cffafe' },
  cl:       { label: 'CL', full: 'Casual Leave', color: '#0284c7', bg: '#dbeafe' },
  sl:       { label: 'SL', full: 'Sick Leave',   color: '#7c3aed', bg: '#ede9fe' },
};

const DAY_PRIORITY = ['absent','late','half_day','excused','od','cl','sl','present'];

function AttendanceTab({ student, classYear }) {
  const now = new Date();
  // Default calendar to start of selected AY; fall back to today
  const initCalYear  = classYear ? parseInt(classYear.academicYear) : now.getFullYear();
  const initCalMonth = classYear ? parseInt(classYear.startDate.slice(5, 7)) : (now.getMonth() + 1);
  const [month, setMonth] = useState(initCalMonth);
  const [year,  setYear]  = useState(initCalYear);

  // Reset calendar when classYear changes
  const prevClassYear = useRef(classYear?.academicYear);
  if (prevClassYear.current !== classYear?.academicYear) {
    prevClassYear.current = classYear?.academicYear;
    setYear(initCalYear);
    setMonth(initCalMonth);
  }

  const { data: summaryData } = useQuery({
    queryKey: ['student-att-summary-tab', student._id, month, year],
    queryFn:  () => api.get(`/attendance/summary?studentId=${student._id}&month=${month}&year=${year}`),
    enabled:  !!student._id,
    staleTime: 0,
  });
  const overall = summaryData?.summary;

  const { data: recData, isLoading } = useQuery({
    queryKey: ['student-att-records', student._id, month, year],
    queryFn:  () => api.get(`/attendance/student-records?studentId=${student._id}&month=${month}&year=${year}`),
    enabled:  !!student._id,
  });
  const records = recData?.records || [];

  // Group by date string → array of period records
  const byDate = {};
  records.forEach(r => {
    const key = new Date(r.date).toISOString().slice(0, 10);
    (byDate[key] = byDate[key] || []).push(r);
  });

  // Dominant status for a calendar day
  const dayStatus = (key) => {
    const day = byDate[key];
    if (!day) return null;
    for (const s of DAY_PRIORITY) if (day.some(r => r.status === s)) return s;
    return day[0].status;
  };

  // Monthly counts
  const counts = {};
  records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const mTotal   = records.length;
  const mPresent = counts.present || 0;
  const mAbsent  = counts.absent  || 0;
  const mLate    = counts.late    || 0;
  const mPct     = mTotal ? Math.round((mPresent / mTotal) * 100) : 0;

  // Calendar grid setup
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const canNext   = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

  return (
    <div>
      {/* Overall summary strip */}
      {overall && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Days',  value: overall.total,      color: 'var(--primary)', bg: '#eff6ff' },
            { label: 'Present',     value: overall.present,    color: '#10b981',        bg: '#f0fdf4' },
            { label: 'Absent',      value: overall.absent,     color: '#ef4444',        bg: '#fef2f2' },
            { label: 'Late',        value: overall.late,       color: '#f59e0b',        bg: '#fffbeb' },
            { label: 'Overall %',   value: `${overall.percentage}%`,  color: overall.percentage >= 75 ? '#10b981' : overall.percentage >= 50 ? '#f59e0b' : '#ef4444', bg: overall.percentage >= 75 ? '#f0fdf4' : overall.percentage >= 50 ? '#fffbeb' : '#fef2f2' },
          ].map(item => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={nextMonth} disabled={!canNext}><ChevronRight size={16} /></button>
        </div>
        {/* Monthly summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries({ present: mPresent, absent: mAbsent, late: mLate }).map(([s, n]) => n > 0 && (
            <span key={s} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: STATUS_META[s]?.bg, color: STATUS_META[s]?.color }}>
              {STATUS_META[s]?.full}: {n}
            </span>
          ))}
          {mTotal > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: mPct >= 75 ? '#dcfce7' : mPct >= 50 ? '#fef3c7' : '#fee2e2',
              color: mPct >= 75 ? '#166534' : mPct >= 50 ? '#92400e' : '#dc2626' }}>
              {mPct}% this month
            </span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {/* Leading empty cells */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 56, padding: 8, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }} />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const status  = dayStatus(dateKey);
            const meta    = status ? STATUS_META[status] : null;
            const periods = byDate[dateKey] || [];
            const isToday = dateKey === now.toISOString().slice(0, 10);
            const isFuture = new Date(dateKey) > now;
            return (
              <div key={day} style={{
                minHeight: 56, padding: '6px 8px', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
                background: meta ? `${meta.bg}80` : 'white',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: 12, fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--primary)' : isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                  marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {isToday && <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{day}</span>}
                  {!isToday && day}
                </div>
                {/* Status indicator(s) */}
                {periods.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {periods.length === 1 ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: meta?.color }}>
                        {meta?.label}
                      </span>
                    ) : (
                      periods.map((p, idx) => {
                        const pm = STATUS_META[p.status];
                        return (
                          <span key={idx} style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: pm?.bg, color: pm?.color }}>
                            {p.period ? `P${p.period}` : pm?.label}
                          </span>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(STATUS_META).map(([key, m]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{ width: 22, height: 16, borderRadius: 4, background: m.bg, border: `1px solid ${m.color}40`, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{m.full}</span>
          </div>
        ))}
      </div>

      {/* Records table */}
      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.35 }} />
          <p style={{ fontSize: 14 }}>No attendance records for {MONTH_NAMES[month - 1]} {year}.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Daily Records — {records.length} entries
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Date', 'Day', 'Period', 'Subject', 'Status', 'Marked By', 'Remarks'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const meta = STATUS_META[r.status] || { label: r.status, color: '#64748b', bg: '#f1f5f9', full: r.status };
                  const d    = new Date(r.date);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {format(d, 'dd MMM yyyy')}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.period ? `Period ${r.period}` : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.subject?.name || '—'}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color }}>
                          {meta.full}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.markedBy?.name || '—'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)', fontStyle: r.remarks ? 'italic' : 'normal' }}>
                        {r.remarks || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamResultsTab({ student, classYear }) {
  const [activeId, setActiveId] = useState(null);

  const hasMultiplePeriods = (student.classHistory?.length || 0) > 1;
  const ayParam = (classYear && hasMultiplePeriods) ? `&academicYear=${encodeURIComponent(classYear.academicYear)}` : '';
  const { data, isLoading } = useQuery({
    queryKey: ['student-exam-results', student._id, hasMultiplePeriods ? classYear?.academicYear : 'all'],
    queryFn: () => api.get(`/exams/results?studentId=${student._id}${ayParam}`),
    enabled: !!student._id,
  });
  const results = data?.results || [];

  const displayId = activeId && results.find(r => r._id === activeId) ? activeId : results[0]?._id;
  const result = results.find(r => r._id === displayId);

  const downloadPDF = async (url, filename) => {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error('Download failed'); }
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading results…</div>;
  if (!results.length) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
      <GraduationCap size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
      <p style={{ fontSize: 14 }}>No exam results found for this student.</p>
    </div>
  );

  return (
    <div>
      {/* Exam selector pills */}
      {results.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {results.map(r => {
            const isActive = r._id === displayId;
            return (
              <button key={r._id} type="button"
                onClick={() => setActiveId(r._id)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 13, cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                  background:  isActive ? 'var(--primary)' : 'white',
                  color:       isActive ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                {r.exam?.name || 'Exam'}
                {r.isPublished
                  ? <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.8 }}>✓</span>
                  : <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>•</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected exam card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {result && (() => {
        const exam = result.exam;
        const failCount   = result.marks.filter(m => !m.isAbsent && m.totalMarks < m.passingMarks).length;
        const absentCount = result.marks.filter(m => m.isAbsent).length;
        const overallPass = failCount === 0 && absentCount === 0 && result.marks.length > 0;

        return (
          <div key={result._id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

            {/* Exam header */}
            <div style={{ background: '#f8fafc', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{exam?.name}</span>
                  {exam?.type && <span className="badge badge-info">{exam.type}</span>}
                  <span className={`badge ${result.isPublished ? 'badge-success' : 'badge-secondary'}`}>
                    {result.isPublished ? 'Published' : 'Pending'}
                  </span>
                </div>
                {result.academicYear && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Academic Year: {result.academicYear}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {result.isPublished && (
                  <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => downloadPDF(`/api/exams/results/${result._id}/pdf`, `Result_${student.admissionNumber}.pdf`)}>
                    <Download size={13} /> Download Report
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  onClick={() => downloadPDF(`/api/exams/${exam?._id}/hall-ticket/${student._id}`, `HallTicket_${student.admissionNumber}.pdf`)}>
                  <Download size={13} /> Hall Ticket
                </button>
              </div>
            </div>

            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {[
                { label: 'Total Marks',  value: `${result.totalMarksObtained ?? 0} / ${result.totalMaxMarks ?? 0}` },
                { label: 'Percentage',   value: result.percentage != null ? `${result.percentage}%` : '—' },
                { label: 'Grade',        value: result.grade || '—' },
                { label: 'Rank',         value: result.rank ? `#${result.rank}` : '—' },
                { label: 'Result',       value: result.marks.length === 0 ? '—' : overallPass ? 'PASS' : 'FAIL',
                  color: result.marks.length === 0 ? undefined : overallPass ? '#10b981' : '#ef4444' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 16px', textAlign: 'center', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color || 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Subject marks table */}
            {result.marks.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Subject', 'Theory', 'Practical', 'Total', 'Max Marks', 'Percentage', 'Grade', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Subject' ? 'left' : 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.marks.map((m, i) => {
                      const pct = m.maxMarks ? Math.round((m.totalMarks / m.maxMarks) * 100) : 0;
                      const passed = !m.isAbsent && m.totalMarks >= m.passingMarks;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.subject?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13 }}>{m.isAbsent ? '—' : (m.theoryMarks ?? '—')}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13 }}>{m.isAbsent ? '—' : (m.practicalMarks ?? '—')}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{m.isAbsent ? 'AB' : (m.totalMarks ?? '—')}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{m.maxMarks ?? '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13 }}>{m.isAbsent ? '—' : `${pct}%`}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {m.grade ? <span className="badge badge-info">{m.grade}</span> : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {m.isAbsent
                              ? <span className="badge badge-secondary">Absent</span>
                              : passed
                                ? <span className="badge badge-success">Pass</span>
                                : <span className="badge badge-danger">Fail</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Marks not entered yet.</div>
            )}

          </div>
        );
      })()}
      </div>
    </div>
  );
}

function HomeworkTab({ student, classYear }) {
  const [filter, setFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null); // { url, fileType }

  const hwExtra = classYear
    ? `&classId=${classYear.classId}&startDate=${classYear.startDate}&endDate=${classYear.endDate}`
    : '';
  const { data, isLoading } = useQuery({
    queryKey: ['student-homeworks', student._id, classYear?.academicYear],
    queryFn: () => api.get(`/homework/student-summary?studentId=${student._id}${hwExtra}`),
    enabled: !!student._id,
  });
  const allHw = data?.homework || [];

  const now = new Date();

  const deriveStatus = (hw) => {
    const sub = hw.submission;
    if (sub?.status === 'completed') return 'completed';
    if (sub?.status === 'in_progress') return 'in_progress';
    if (new Date(hw.dueDate) < now) return 'overdue';
    return 'pending';
  };

  const filtered = filter === 'all' ? allHw : allHw.filter(hw => deriveStatus(hw) === filter);

  const STATUS_META = {
    completed:   { label: 'Completed',   color: '#10b981', bg: '#d1fae5' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fef3c7' },
    overdue:     { label: 'Overdue',     color: '#ef4444', bg: '#fee2e2' },
    pending:     { label: 'Pending',     color: '#64748b', bg: '#f1f5f9' },
  };

  const counts = { all: allHw.length };
  allHw.forEach(hw => { const s = deriveStatus(hw); counts[s] = (counts[s] || 0) + 1; });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading homeworks…</div>;

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all',         label: 'All' },
          { key: 'pending',     label: 'Pending' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'completed',   label: 'Completed' },
          { key: 'overdue',     label: 'Overdue' },
        ].map(f => (
          <button key={f.key} type="button"
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid',
              fontSize: 13, cursor: 'pointer', fontWeight: filter === f.key ? 600 : 400,
              borderColor: filter === f.key ? 'var(--primary)' : 'var(--border)',
              background:  filter === f.key ? '#eff6ff' : 'white',
              color:       filter === f.key ? 'var(--primary)' : 'var(--text-secondary)',
            }}>
            {f.label} {counts[f.key] != null ? <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({counts[f.key] || 0})</span> : null}
          </button>
        ))}
      </div>

      {/* Homework list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BookOpen size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
          <p style={{ fontSize: 14 }}>No homeworks found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(hw => {
            const status = deriveStatus(hw);
            const meta   = STATUS_META[status];
            const sub    = hw.submission;
            const isOverdue = new Date(hw.dueDate) < now && status !== 'completed';

            return (
              <div key={hw._id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{hw.title}</span>
                      {hw.subject && (
                        <span style={{ fontSize: 11, background: hw.subject.color ? `${hw.subject.color}22` : '#eff6ff', color: hw.subject.color || 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                          {hw.subject.name}
                        </span>
                      )}
                    </div>
                    {hw.description && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>{hw.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Assigned: {format(new Date(hw.assignedDate), 'dd MMM yyyy')}
                      </span>
                      <span style={{ fontSize: 12, color: isOverdue ? '#ef4444' : 'var(--text-muted)', fontWeight: isOverdue ? 600 : 400 }}>
                        Due: {format(new Date(hw.dueDate), 'dd MMM yyyy')}
                      </span>
                      {hw.createdBy && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>By: {hw.createdBy.name}</span>
                      )}
                    </div>
                  </div>
                  {/* Status badge */}
                  <span style={{ fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color, padding: '4px 12px', borderRadius: 20, flexShrink: 0 }}>
                    {meta.label}
                  </span>
                </div>

                {/* Submission info + attachments */}
                {sub && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', background: '#fafafa' }}>
                    {sub.note && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px', fontStyle: 'italic' }}>
                        "{sub.note}"
                      </p>
                    )}
                    {sub.submittedAt && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                        Submitted on: {format(new Date(sub.submittedAt), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    )}
                    {sub.attachments?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                          Answer Paper ({sub.attachments.length})
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {sub.attachments.map((att, i) => (
                            <button key={i} type="button"
                              onClick={() => att.fileType === 'image' ? setLightbox(att) : window.open(att.url, '_blank')}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                border: '1px solid var(--border)', borderRadius: 8, background: 'white',
                                cursor: 'pointer', fontSize: 13, color: 'var(--primary)', fontWeight: 500,
                              }}>
                              {att.fileType === 'image' ? '🖼' : '📄'} {att.name || `Attachment ${i + 1}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox for image attachments */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox.url} alt={lightbox.name} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', cursor: 'default' }} />
        </div>
      )}
    </div>
  );
}

function AttendanceCircle({ percentage, present, total }) {
  const size = 80;
  const r = 32;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (percentage / 100) * circumference;
  const color    = percentage >= 75 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';
  const bgColor  = percentage >= 75 ? '#d1fae5' : percentage >= 50 ? '#fef3c7' : '#fee2e2';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, marginLeft: 8 }}>
      {/* Days count */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{present}/{total}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</span>
      </div>

      {/* Circle widget */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ position: 'relative', width: size, height: size }}>
          {/* Progress ring */}
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeLinecap="round"
            />
          </svg>
          {/* Percentage text */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color }}>{percentage}%</span>
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Attendance</span>
      </div>
    </div>
  );
}

// ── Fees Tab ──────────────────────────────────────────────────────────────────
function FeesTab({ student, classYear }) {
  const qc = useQueryClient();
  const [collectTarget, setCollectTarget] = useState(null);

  // Only filter by academicYear when the student has multiple class periods (dropdown visible).
  // For single-period students (same-class rejoin / new student), show all fee records so
  // an accidental transfer+rejoin never appears to wipe historical data.
  const hasMultiplePeriods = (student.classHistory?.length || 0) > 1;
  const ayParam = (classYear && hasMultiplePeriods) ? `&academicYear=${encodeURIComponent(classYear.academicYear)}` : '';
  const { data, isLoading } = useQuery({
    queryKey: ['student-fees', student._id, hasMultiplePeriods ? classYear?.academicYear : 'all'],
    queryFn: () => api.get(`/fees?studentId=${student._id}&limit=50${ayParam}`),
    enabled: !!student._id,
  });
  const feeRecords = data?.fees || [];

  const totalAmount  = feeRecords.reduce((s, f) => s + (f.netAmount || 0), 0);
  const totalPaid    = feeRecords.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const totalPending = feeRecords.reduce((s, f) => s + (f.pendingAmount || 0), 0);

  const downloadReceipt = async (id, admNo) => {
    try {
      const res = await fetch(`/api/fees/${id}/receipt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Receipt_${admNo}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { toast.error(err.message || 'Download failed'); }
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading fees…</div>;

  return (
    <div>
      {/* Summary strip */}
      {feeRecords.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Amount', value: totalAmount,  color: 'var(--primary)', bg: '#eff6ff' },
            { label: 'Total Paid',   value: totalPaid,    color: '#10b981',        bg: '#f0fdf4' },
            { label: 'Pending',      value: totalPending, color: totalPending > 0 ? '#ef4444' : '#10b981', bg: totalPending > 0 ? '#fef2f2' : '#f0fdf4' },
          ].map(item => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 18px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>₹{item.value.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      )}

      {feeRecords.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CreditCard size={36} style={{ marginBottom: 10, opacity: 0.35 }} />
          <p style={{ fontSize: 14 }}>No fee records found for this student.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {feeRecords.map(fee => (
            <div key={fee._id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

              {/* Record header */}
              <div style={{ background: '#f8fafc', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Academic Year: {fee.academicYear || '—'}
                  </span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                    background: fee.status === 'paid' ? '#dcfce7' : fee.status === 'partial' ? '#fef9c3' : '#fee2e2',
                    color: fee.status === 'paid' ? '#166534' : fee.status === 'partial' ? '#92400e' : '#dc2626',
                  }}>
                    {fee.status ? fee.status.charAt(0).toUpperCase() + fee.status.slice(1) : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {fee.paidAmount > 0 && (
                    <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => downloadReceipt(fee._id, student.admissionNumber)}>
                      <Download size={13} /> Receipt
                    </button>
                  )}
                  {fee.pendingAmount > 0 && (
                    <button className="btn btn-success btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setCollectTarget(fee)}>
                      <IndianRupee size={13} /> Collect Fee
                    </button>
                  )}
                </div>
              </div>

              {/* Terms breakdown table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[
                        { h: 'Category', align: 'left' },
                        { h: 'Amount',   align: 'right' },
                        { h: 'Discount', align: 'right' },
                        { h: 'Net',      align: 'right' },
                        { h: 'Paid',     align: 'right' },
                        { h: 'Pending',  align: 'right' },
                        { h: 'Status',   align: 'center' },
                      ].map(({ h, align }) => (
                        <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: align, textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(fee.terms || []).map((t, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{t.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13 }}>₹{(t.totalAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: t.discount?.amount > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                          {t.discount?.amount > 0 ? `−₹${t.discount.amount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>₹{(t.netAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#10b981' }}>₹{(t.paidAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: t.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>₹{(t.pendingAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                            background: t.status === 'paid' ? '#dcfce7' : t.status === 'partial' ? '#fef9c3' : '#fee2e2',
                            color: t.status === 'paid' ? '#166534' : t.status === 'partial' ? '#92400e' : '#dc2626',
                          }}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>Total</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>₹{(fee.totalAmount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#16a34a' }}>
                        {(fee.terms || []).reduce((s, t) => s + (t.discount?.amount || 0), 0) > 0
                          ? `−₹${(fee.terms || []).reduce((s, t) => s + (t.discount?.amount || 0), 0).toLocaleString('en-IN')}`
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>₹{(fee.netAmount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#10b981' }}>₹{(fee.paidAmount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: fee.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>₹{(fee.pendingAmount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <StatusBadge status={fee.status} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment history */}
              {fee.payments?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', background: '#fafafa' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Payment History ({fee.payments.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fee.payments.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {p.termName ? `${p.termName} · ` : ''}{p.method?.replace('_', ' ')}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {p.paidAt ? format(new Date(p.paidAt), 'dd MMM yyyy') : ''}
                          </span>
                          <span style={{ fontWeight: 600, color: '#10b981' }}>+₹{(p.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {collectTarget && (
        <CollectFeeModal
          fee={collectTarget}
          onClose={() => setCollectTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries(['fees']);
            qc.invalidateQueries(['student-fees', student._id]);
            setCollectTarget(null);
          }}
        />
      )}
    </div>
  );
}

const FEE_PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online (UPI/NEFT)' },
];

function CollectFeeModal({ fee, onClose, onSuccess }) {
  const pendingTerms = (fee.terms || []).filter(t => t.pendingAmount > 0);
  const [selectedTerm, setSelectedTerm] = useState(pendingTerms.length === 1 ? pendingTerms[0].name : 'all');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [discounts, setDiscounts] = useState({});
  const [allDiscount, setAllDiscount] = useState('');
  const [allReason, setAllReason] = useState('');

  const allDiscNum = Math.max(0, Number(allDiscount) || 0);
  const sumPending = pendingTerms.reduce((s, t) => s + t.pendingAmount, 0);

  const discOf = (name, src = discounts) => Math.max(0, Number(src[name]?.amount) || 0);
  const effPending = (t, src = discounts) => Math.max(0, t.pendingAmount - discOf(t.name, src));
  const computeBase = (term, src = discounts, allD = allDiscNum) => term === 'all'
    ? Math.max(0, sumPending - allD)
    : effPending(fee.terms?.find(x => x.name === term) || { pendingAmount: 0, name: term }, src);

  const [payAmount, setPayAmount] = useState(() => {
    if (pendingTerms.length === 1) return String(pendingTerms[0].pendingAmount);
    return String(sumPending);
  });

  const basePending = computeBase(selectedTerm);
  const maxAmount = basePending;
  const scopeDisc = selectedTerm === 'all' ? allDiscNum : discOf(selectedTerm);

  const handleSelectTerm = (val) => {
    setSelectedTerm(val);
    setPayAmount(String(computeBase(val)));
  };

  const setTermDiscount = (name, field, val) => {
    setDiscounts(prev => {
      const next = { ...prev, [name]: { ...prev[name], [field]: val } };
      if (field === 'amount' && selectedTerm === name) setPayAmount(String(computeBase(name, next)));
      return next;
    });
  };

  const setAllDiscountVal = (val) => {
    setAllDiscount(val);
    if (selectedTerm === 'all') setPayAmount(String(Math.max(0, sumPending - Math.max(0, Number(val) || 0))));
  };

  const enteredAmount = Math.max(0, parseFloat(payAmount) || 0);
  const isPartial = enteredAmount < maxAmount && enteredAmount > 0;
  const isValid = (enteredAmount > 0 || scopeDisc > 0) && enteredAmount <= maxAmount;

  const handleCollect = async () => {
    if (!isValid) return toast.error(`Enter an amount up to ₹${maxAmount.toLocaleString('en-IN')}`);
    setLoading(true);
    try {
      let discList = [];
      if (selectedTerm === 'all') {
        let remaining = allDiscNum;
        for (const t of pendingTerms) {
          if (remaining <= 0) break;
          const give = Math.min(remaining, t.pendingAmount);
          if (give > 0) discList.push({ termName: t.name, amount: give, reason: allReason || '' });
          remaining -= give;
        }
      } else {
        const da = discOf(selectedTerm);
        if (da > 0) discList = [{ termName: selectedTerm, amount: da, reason: discounts[selectedTerm]?.reason || '' }];
      }
      await api.post('/fees/collect', {
        feeId: fee._id,
        termName: selectedTerm === 'all' ? undefined : selectedTerm,
        amount: enteredAmount,
        method,
        discounts: discList,
      });
      toast.success(enteredAmount > 0
        ? (isPartial ? `Partial payment of ₹${enteredAmount.toLocaleString('en-IN')} collected!` : 'Payment collected!')
        : 'Discount applied!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const renderAmountInput = (pendingAmt) => (
    <div style={{ padding: '10px 14px', borderTop: '1px solid #dbeafe', background: '#f0f7ff' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Amount to Collect (₹)</div>
          <input
            className="form-control no-spinner"
            type="number" min={1} max={pendingAmt}
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
            onWheel={e => e.currentTarget.blur()}
            style={{ fontSize: 15, fontWeight: 600, textAlign: 'right' }}
            placeholder={`Max ₹${pendingAmt.toLocaleString('en-IN')}`}
            autoFocus
          />
          {enteredAmount > pendingAmt && (
            <p style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>Cannot exceed ₹{pendingAmt.toLocaleString('en-IN')}</p>
          )}
        </div>
        {enteredAmount !== pendingAmt && (
          <button type="button" onClick={() => setPayAmount(String(pendingAmt))}
            style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--primary)', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Pay full ₹{pendingAmt.toLocaleString('en-IN')}
          </button>
        )}
      </div>
      {enteredAmount > 0 && enteredAmount <= pendingAmt && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, background: 'white', borderRadius: 8, padding: '6px 10px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Paying</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>₹{enteredAmount.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: 8, padding: '6px 10px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Balance After</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: pendingAmt - enteredAmount > 0 ? '#d97706' : '#16a34a' }}>
              ₹{(pendingAmt - enteredAmount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Collect Payment"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleCollect} disabled={loading || !isValid}>
          {loading ? 'Processing...' : enteredAmount > 0 ? `✓ Collect ₹${enteredAmount.toLocaleString('en-IN')}` : 'Apply Discount'}
        </button>
      </>}>
      <div style={{ marginBottom: 16 }}>
        <div className="text-14-semibold">{fee.student?.name}</div>
        <div className="text-13-regular" style={{ color: 'var(--text-muted)' }}>{fee.academicYear}</div>
      </div>

      <div className="form-group">
        <label className="form-label">Select Payment For</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingTerms.length > 1 && (
            <div style={{ border: `1.5px solid ${selectedTerm === 'all' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: selectedTerm === 'all' ? '#eff6ff' : 'white' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <input type="radio" name="cfterm" checked={selectedTerm === 'all'} onChange={() => handleSelectTerm('all')} />
                <div style={{ flex: 1 }}>
                  <div className="text-14-semibold" style={{ color: selectedTerm === 'all' ? 'var(--primary)' : undefined }}>Pay All</div>
                  <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{pendingTerms.map(t => t.name).join(' + ')}</div>
                </div>
                <span className="text-14-semibold" style={{ color: selectedTerm === 'all' ? 'var(--primary)' : undefined }}>
                  ₹{computeBase('all').toLocaleString('en-IN')}
                </span>
              </label>
              {selectedTerm === 'all' && (
                <>
                  <div style={{ display: 'flex', gap: 8, padding: '8px 14px 10px', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Discount</span>
                    <input className="form-control no-spinner" type="number" min={0} value={allDiscount}
                      onChange={e => setAllDiscountVal(e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder="₹0" style={{ flex: 1, fontSize: 13 }} />
                    <input className="form-control" value={allReason}
                      onChange={e => setAllReason(e.target.value)} placeholder="Reason (e.g. Merit)" style={{ flex: 2, fontSize: 13 }} />
                  </div>
                  {allDiscNum > 0 && (
                    <div style={{ fontSize: 11, color: '#16a34a', padding: '4px 14px 0' }}>−₹{allDiscNum.toLocaleString('en-IN')} discount spread across terms</div>
                  )}
                  {renderAmountInput(computeBase('all'))}
                </>
              )}
            </div>
          )}

          {pendingTerms.map(t => {
            const d = discOf(t.name);
            return (
              <div key={t.name} style={{ border: `1.5px solid ${selectedTerm === t.name ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', background: selectedTerm === t.name ? '#eff6ff' : 'white' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                  <input type="radio" name="cfterm" checked={selectedTerm === t.name} onChange={() => handleSelectTerm(t.name)} />
                  <div style={{ flex: 1 }}>
                    <div className="text-14-semibold" style={{ color: selectedTerm === t.name ? 'var(--primary)' : undefined }}>{t.name}</div>
                    <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>
                      Net ₹{(t.netAmount || 0).toLocaleString('en-IN')} · Paid ₹{(t.paidAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span className="text-14-semibold" style={{ color: selectedTerm === t.name ? 'var(--primary)' : '#ef4444' }}>
                    ₹{effPending(t).toLocaleString('en-IN')}
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Discount</span>
                  <input className="form-control no-spinner" type="number" min={0} value={discounts[t.name]?.amount || ''}
                    onChange={e => setTermDiscount(t.name, 'amount', e.target.value)} onWheel={e => e.currentTarget.blur()} placeholder="₹0" style={{ flex: 1, fontSize: 13 }} />
                  <input className="form-control" value={discounts[t.name]?.reason || ''}
                    onChange={e => setTermDiscount(t.name, 'reason', e.target.value)} placeholder="Reason (e.g. Merit)" style={{ flex: 2, fontSize: 13 }} />
                </div>
                {d > 0 && (
                  <div style={{ fontSize: 11, color: '#16a34a', padding: '0 14px 8px' }}>−₹{d.toLocaleString('en-IN')} discount · pending now ₹{effPending(t).toLocaleString('en-IN')}</div>
                )}
                {selectedTerm === t.name && renderAmountInput(effPending(t))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Payment Method</label>
        <Select style={{ width: '100%' }} value={method} onChange={val => setMethod(val)} options={FEE_PAYMENT_METHODS} />
      </div>
    </Modal>
  );
}

function SectionTitle({ children }) {
  return <h4 className="text-12-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{children}</h4>;
}

function DetailRow({ label, value, capitalize }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-14-medium" style={capitalize ? { textTransform: 'capitalize' } : {}}>{value}</span>
    </div>
  );
}

function SidebarItem({ icon: Icon, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
      <Icon size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} />
      <span>{value}</span>
    </div>
  );
}

function SidebarRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right', marginLeft: 8 }}>{value}</span>
    </div>
  );
}

function ContactItem({ icon: Icon, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
      <Icon size={13} style={{ flexShrink: 0 }} /> {value}
    </div>
  );
}


function PromoteModal({ selected, classes, students, onClose, onSuccess }) {
  const { availableYears, selectedYear } = useYear();

  // Extract numeric level from a class name string (e.g. "Class 7" → 7, "VIII" → 0)
  const classLevel = (name) => parseInt((name || '').match(/\d+/)?.[0] || '0');

  // Determine the "from" class by looking at the selected students list
  const fromClassInfo = useMemo(() => {
    const firstSelected = (students || []).find(s => selected.includes(s._id));
    return firstSelected?.currentClass || null;
  }, [students, selected]);

  const fromLevel = classLevel(fromClassInfo?.name);

  // Eligible target class names: only level+1 (normal) and level+2 (double promotion)
  const eligibleClassNames = useMemo(() => {
    if (!fromLevel) {
      // No restriction if we can't determine level
      const seen = new Set();
      return classes.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; }).map(c => c.name);
    }
    const seen = new Set();
    return classes.filter(c => {
      const lvl = classLevel(c.name);
      if (lvl !== fromLevel + 1 && lvl !== fromLevel + 2) return false;
      if (seen.has(c.name)) return false;
      seen.add(c.name); return true;
    }).map(c => c.name);
  }, [classes, fromLevel]);

  // Default academic year = next year from selected header year
  const nextYear = useMemo(() => {
    const base = parseInt(selectedYear);
    const isRange = selectedYear.includes('-');
    const nextVal = isRange ? `${base + 1}-${base + 2}` : `${base + 1}`;
    // Use next year if it exists in available years; otherwise fall back to selectedYear
    return availableYears.find(y => y.value === nextVal)?.value || selectedYear;
  }, [selectedYear, availableYears]);

  const [targetClassName, setTargetClassName] = useState('');
  const [toClass, setToClass] = useState('');
  const [year, setYear] = useState(nextYear);
  const [loading, setLoading] = useState(false);

  const sections = useMemo(() => classes.filter(c => c.name === targetClassName), [classes, targetClassName]);

  const isDoublePromotion = fromLevel > 0 && classLevel(targetClassName) === fromLevel + 2;

  const handleClassNameChange = (name) => { setTargetClassName(name); setToClass(''); };

  const handlePromote = async () => {
    if (!targetClassName) return toast.error('Select target class');
    if (!toClass) return toast.error('Select target section');
    setLoading(true);
    try {
      const res = await api.post('/students/promote', { studentIds: selected, toClassId: toClass, academicYear: year });
      const toClassObj = classes.find(c => c._id === toClass);
      toast.success(`${selected.length} student(s) promoted!`);
      onSuccess({
        count: selected.length,
        toClassName: toClassObj?.name || targetClassName,
        toSection: toClassObj?.section || '',
        academicYear: year,
        isDoublePromotion,
        promotedStudents: (students || []).filter(s => selected.includes(s._id)),
      });
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Promote ${selected.length} Student${selected.length !== 1 ? 's' : ''}`}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handlePromote} disabled={loading}>
          {loading ? 'Promoting...' : 'Promote Students'}
        </button>
      </>}>
      {fromClassInfo && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0369a1', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <GraduationCap size={14} />
          Promoting from: <strong>{fromClassInfo.name}{fromClassInfo.section ? ` — ${fromClassInfo.section}` : ''}</strong>
          {fromLevel > 0 && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>Eligible: Class {fromLevel + 1} or Class {fromLevel + 2} (double)</span>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Target Class <span style={{ color: '#ef4444' }}>*</span></label>
          <select className="form-control" value={targetClassName} onChange={e => handleClassNameChange(e.target.value)}>
            <option value="">Select class</option>
            {eligibleClassNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Section <span style={{ color: '#ef4444' }}>*</span></label>
          <select className="form-control" value={toClass} onChange={e => setToClass(e.target.value)} disabled={!targetClassName}>
            <option value="">Select section</option>
            {sections.map(c => <option key={c._id} value={c._id}>{c.section || 'Default'}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
        <label className="form-label">New Academic Year <span style={{ color: '#ef4444' }}>*</span></label>
        <select className="form-control" value={year} onChange={e => setYear(e.target.value)}>
          {availableYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
      </div>
      {isDoublePromotion && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: 12, fontSize: 13, color: '#c2410c', marginTop: 12 }}>
          ⚡ Double promotion selected — skipping one class level. Please confirm this is intentional.
        </div>
      )}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400e', marginTop: 12 }}>
        ⚠️ This will move {selected.length} student(s) to {targetClassName || 'the selected class'}{toClass && sections.find(c => c._id === toClass) ? ` — ${sections.find(c => c._id === toClass)?.section}` : ''} for {year}.
      </div>
    </Modal>
  );
}

function PromotionSuccessModal({ result, onClose }) {
  const [downloading, setDownloading] = useState({});

  const downloadCard = async (studentId, admissionNumber) => {
    setDownloading(d => ({ ...d, [studentId]: true }));
    try {
      const res = await fetch(`/api/students/${studentId}/promotion-card`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `PromotionCard_${admissionNumber || studentId}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download promotion card');
    } finally {
      setDownloading(d => ({ ...d, [studentId]: false }));
    }
  };

  return (
    <Modal open onClose={onClose} title="Promotion Successful"
      footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <GraduationCap size={28} color="#16a34a" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          {result.count} Student{result.count !== 1 ? 's' : ''} Promoted!
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Promoted to <strong>{result.toClassName}{result.toSection ? ` — ${result.toSection}` : ''}</strong> for <strong>{result.academicYear}</strong>
        </div>
        {result.isDoublePromotion && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: '#c2410c', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: '2px 10px' }}>
            ⚡ Double Promotion
          </div>
        )}
      </div>
      {result.promotedStudents?.length > 0 && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {result.promotedStudents.map(stu => (
            <div key={stu._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <Avatar src={stu.photo} name={stu.name} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{stu.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{stu.admissionNumber}</div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                disabled={downloading[stu._id]}
                onClick={() => downloadCard(stu._id, stu.admissionNumber)}>
                <Download size={12} />
                {downloading[stu._id] ? 'Downloading...' : 'Promotion Card'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Transfer Modal ────────────────────────────────────────────────────────────
function TransferModal({ selected, students, onClose, onSuccess }) {
  const selectedStudents = useMemo(() => (students || []).filter(s => selected.includes(s._id)), [students, selected]);
  const [reason, setReason] = useState('');
  const [feesData, setFeesData] = useState({});
  const [loadingFees, setLoadingFees] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [collectModal, setCollectModal] = useState(null);

  useEffect(() => {
    const loadFees = async () => {
      setLoadingFees(true);
      const result = {};
      await Promise.all(selectedStudents.map(async (stu) => {
        try {
          const res = await api.get(`/fees?studentId=${stu._id}&limit=100`);
          const allFees = res.fees || [];
          const pendingFees = allFees.filter(f => (f.pendingAmount || 0) > 0);
          result[stu._id] = { pendingFees, allFees };
        } catch { result[stu._id] = { pendingFees: [], allFees: [] }; }
      }));
      setFeesData(result);
      setLoadingFees(false);
    };
    if (selectedStudents.length) loadFees();
    else setLoadingFees(false);
  }, []);

  const hasPending = Object.values(feesData).some(d => d.pendingFees?.length > 0);
  const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const reloadFees = async (stuId) => {
    try {
      const res = await api.get(`/fees?studentId=${stuId}&limit=100`);
      const allFees = res.fees || [];
      const pendingFees = allFees.filter(f => (f.pendingAmount || 0) > 0);
      setFeesData(d => ({ ...d, [stuId]: { pendingFees, allFees } }));
    } catch {}
  };

  const handleTransfer = async () => {
    setTransferring(true);
    let successCount = 0;
    try {
      for (const stu of selectedStudents) {
        const res = await fetch(`/api/students/${stu._id}/transfer`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Transfer failed' }));
          toast.error(`${stu.name}: ${err.message || 'Transfer failed'}`);
          continue;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `TC_${stu.admissionNumber || stu._id}.pdf`;
        a.click(); URL.revokeObjectURL(url);
        successCount++;
      }
      if (successCount > 0) {
        toast.success(`${successCount} student(s) transferred. TC downloaded.`);
        onSuccess();
      }
    } catch (err) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Transfer ${selected.length} Student${selected.length !== 1 ? 's' : ''}`} size="md"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleTransfer}
          disabled={transferring || loadingFees || hasPending}>
          {transferring ? 'Transferring...' : hasPending ? 'Clear Pending Fees First' : `Transfer & Download TC`}
        </button>
      </>}>
      {loadingFees ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Checking pending fees…</div>
      ) : (
        <>
          {hasPending && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400e', marginBottom: 14 }}>
              ⚠️ All pending dues must be cleared before completing the transfer.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {selectedStudents.map(stu => {
              const data = feesData[stu._id] || {};
              const totalPending = (data.pendingFees || []).reduce((s, f) => s + (f.pendingAmount || 0), 0);
              const isPending = totalPending > 0;
              return (
                <div key={stu._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: isPending ? '#fefce8' : '#f0fdf4', borderRadius: 8, border: `1px solid ${isPending ? '#fde047' : '#86efac'}` }}>
                  <Avatar src={stu.photo} name={stu.name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{stu.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{stu.currentClass?.name} {stu.currentClass?.section} · {stu.admissionNumber}</div>
                    {isPending && (
                      <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                        {(data.pendingFees || []).map(f => (
                          <span key={f._id} style={{ marginRight: 8 }}>{f.academicYear}: {fmt(f.pendingAmount)} pending</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isPending ? (
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 10px', color: '#b45309', flexShrink: 0 }}
                      onClick={() => setCollectModal({ stuId: stu._id, fee: data.pendingFees[0] })}>
                      Collect Fee
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: '2px 8px', flexShrink: 0 }}>Fees Clear ✓</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Reason for Transfer <span style={{ fontSize: 12, color: '#9ca3af' }}>(optional)</span></label>
            <input className="form-control" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Family relocation, school change…" />
          </div>
        </>
      )}
      {collectModal && (
        <CollectFeeModal
          fee={collectModal.fee}
          onClose={() => setCollectModal(null)}
          onSuccess={() => { setCollectModal(null); reloadFees(collectModal.stuId); }}
        />
      )}
    </Modal>
  );
}

// ── Rejoin Modal ──────────────────────────────────────────────────────────────
function RejoinModal({ student, classes, onClose, onSuccess }) {
  const { availableYears, selectedYear } = useYear();
  const [targetClassName, setTargetClassName] = useState('');
  const [toClass, setToClass] = useState('');
  const [year, setYear] = useState(selectedYear);
  const [loading, setLoading] = useState(false);

  const uniqueClassNames = useMemo(() => {
    const seen = new Set();
    return classes.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; }).map(c => c.name);
  }, [classes]);

  const sections = useMemo(() => classes.filter(c => c.name === targetClassName), [classes, targetClassName]);

  const handleRejoin = async () => {
    if (!toClass) return toast.error('Select a class and section');
    setLoading(true);
    try {
      await api.post(`/students/${student._id}/rejoin`, { classId: toClass, academicYear: year });
      toast.success(`${student.name} has rejoined!`);
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to rejoin');
    } finally { setLoading(false); }
  };

  const lastTransfer = student.transferHistory?.[student.transferHistory.length - 1];

  return (
    <Modal open onClose={onClose} title={`Rejoin School — ${student.name}`}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleRejoin} disabled={loading || !toClass}>
          {loading ? 'Rejoining...' : 'Confirm Rejoin'}
        </button>
      </>}>
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803d', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Previously Transferred</div>
        {lastTransfer && (
          <div style={{ fontSize: 12, color: '#374151' }}>
            From <strong>{lastTransfer.classAtTransfer}{lastTransfer.sectionAtTransfer ? ` ${lastTransfer.sectionAtTransfer}` : ''}</strong> · {lastTransfer.academicYearAtTransfer} · TC No: {lastTransfer.tcNumber}
            {lastTransfer.reason && <span> · {lastTransfer.reason}</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Rejoin Class <span style={{ color: '#ef4444' }}>*</span></label>
          <select className="form-control" value={targetClassName} onChange={e => { setTargetClassName(e.target.value); setToClass(''); }}>
            <option value="">Select class</option>
            {uniqueClassNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Section <span style={{ color: '#ef4444' }}>*</span></label>
          <select className="form-control" value={toClass} onChange={e => setToClass(e.target.value)} disabled={!targetClassName}>
            <option value="">Select section</option>
            {sections.map(c => <option key={c._id} value={c._id}>{c.section || 'Default'}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Academic Year <span style={{ color: '#ef4444' }}>*</span></label>
        <select className="form-control" value={year} onChange={e => setYear(e.target.value)}>
          {availableYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
      </div>
    </Modal>
  );
}

