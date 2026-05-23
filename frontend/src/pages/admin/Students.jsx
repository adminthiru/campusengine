import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import {
  Plus, Download, Trash2, GraduationCap, ArrowLeft,
  Edit, Phone, Mail, MapPin, BookOpen, Camera, ChevronLeft, ChevronRight, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput, Avatar, EmptyState, PageLoader, FormRow, ColumnSelector, useColumnSelector } from '../../components/ui';
import { BulkUploadModal } from '../../components/ui/BulkUploadModal';
import { format } from 'date-fns';

const STUDENT_COLS = [
  { key: 'classSection',      label: 'Class & Section',      required: true },
  { key: 'rollNumber',        label: 'Roll Number',          required: true },
  { key: 'gender',            label: 'Gender',               required: true },
  { key: 'status',            label: 'Status',               required: true },
  { key: 'mobile',            label: 'Mobile Number' },
  { key: 'dob',               label: 'Date of Birth',        required: true },
  { key: 'admissionNumber',   label: 'Admission Number',     required: true },
  { key: 'admissionDate',     label: 'Admission Date',       default: false },
  { key: 'parentName',        label: 'Parent Name' },
  { key: 'parentMobile',      label: 'Parent Mobile',        required: true },
  { key: 'address',           label: 'Home Address',         default: false },
  { key: 'nationality',       label: 'Nationality',          default: false },
  { key: 'religion',          label: 'Religion',             default: false },
  { key: 'bloodGroup',        label: 'Blood Group',          default: false },
  { key: 'motherTongue',      label: 'Mother Tongue',        default: false },
  { key: 'identificationMark',label: 'Identification Mark',  default: false },
  { key: 'previousSchool',    label: 'Previous School',      default: false },
  { key: 'medicalInfo',       label: 'Medical Information',  default: false },
];

const FORM_TABS = [
  { key: 'personal',  label: 'Personal Details' },
  { key: 'academics', label: 'Academics' },
  { key: 'parents',   label: 'Parent Contacts' },
  { key: 'others',    label: 'Others' },
];

const DETAIL_TABS = [
  { key: 'personal',  label: 'Personal' },
  { key: 'academics', label: 'Academics' },
  { key: 'parents',   label: 'Parents' },
  { key: 'others',    label: 'Others' },
];

export default function Students() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [viewStudent, setViewStudent] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [promoteModal, setPromoteModal] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [formTab, setFormTab] = useState('personal');
  const [studentStatus, setStudentStatus] = useState('active');

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

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search, classFilter],
    queryFn: () => api.get(`/students?page=${page}&limit=20&search=${search}&classId=${classFilter}`),
    keepPreviousData: true
  });

  const students = data?.students || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const { register, handleSubmit, reset, watch, control, formState: { errors } } = useForm();

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
    const classDoc = classes.find(c => c.name === data.classGroup && c.section === data.section);

    // Explicitly build a plain array to avoid React dev-mode Proxy serialisation issues
    const guardiansPayload = [];
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
      address: { street: data.address },
      admissionNumber: data.admissionNumber,
      admissionDate: data.admissionDate,
      currentClass: classDoc?._id,
      rollNumber: data.rollNumber,
      guardians: guardiansPayload,
      nationality: data.nationality,
      religion: data.religion,
      motherTongue: data.motherTongue,
      previousSchool: data.previousSchool,
      identificationMark: data.identificationMark,
      medicalInfo: { conditions: data.medicalIssue ? data.medicalIssue.split(',').map(s => s.trim()).filter(Boolean) : [] },
      remarks: data.remarks,
      transportRoute: selectedTransport || undefined,
    };
  };

  const onSubmit = (data) => {
    const payload = buildPayload(data);
    if (!payload.currentClass) delete payload.currentClass;
    if (!payload.phone) delete payload.phone;
    if (!payload.admissionDate) delete payload.admissionDate;
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
    reset({});
  };

  const openAdd = () => {
    setEditStudent(null);
    setFormTab('personal');
    setSelectedTransport('');
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
      mobile: stu.phone || '',
      alternativeMobile: stu.alternativeMobile || '',
      address: stu.address?.street || '',
      admissionNumber: stu.admissionNumber || '',
      admissionDate: stu.admissionDate ? stu.admissionDate.slice(0, 10) : '',
      classGroup: classDoc?.name || '',
      section: classDoc?.section || '',
      rollNumber: stu.rollNumber || '',
      nationality: stu.nationality || '',
      religion: stu.religion || '',
      motherTongue: stu.motherTongue || '',
      previousSchool: stu.previousSchool || '',
      identificationMark: stu.identificationMark || '',
      medicalIssue: stu.medicalInfo?.conditions?.join(', ') || '',
      remarks: stu.remarks || '',
    });
    setParents((stu.guardians || []).map(g => ({
      name: g.name || '',
      relationship: g.relation || 'father',
      mobile: g.phone || '',
      alternativeMobile: g.alternatePhone || g.alternativeMobile || ''
    })));
    setStudentStatus(stu.status || 'active');
    setProfilePreview(stu.photo || null);
    setSelectedTransport(stu.transportRoute?._id || stu.transportRoute || '');
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

  const isMutating = createMutation.isLoading || updateMutation.isLoading;
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
          uniqueClassNames={uniqueClassNames} filteredSections={filteredSections} watchedClassGroup={watchedClassGroup}
          parents={parents} setParents={setParents}
          parentForm={parentForm} setParentForm={setParentForm}
          parentDraft={parentDraft} setParentDraft={setParentDraft}
          profilePreview={profilePreview} setProfilePreview={setProfilePreview}
          imgInputRef={imgInputRef}
          studentStatus={studentStatus} setStudentStatus={setStudentStatus} control={control}
          transports={transports} selectedTransport={selectedTransport} setSelectedTransport={setSelectedTransport}
        />
      </>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{total} students enrolled</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setPromoteModal(true)}>
              <GraduationCap size={16} /> Promote ({selected.length})
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Upload size={16} /> Bulk Upload
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, admission no..." />
        <select className="form-control" style={{ width: 'auto', textAlign: 'center', textAlignLast: 'center' }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
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
            <table style={{ minWidth: 2200 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', minWidth: 36 }}>
                    <input type="checkbox" onChange={e => setSelected(e.target.checked ? students.map(s => s._id) : [])} />
                  </th>
                  <th style={{ whiteSpace: 'nowrap', minWidth: 180 }}>Student Name</th>
                  {col('classSection')       && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Class &amp; Section</th>}
                  {col('rollNumber')         && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Roll Number</th>}
                  {col('gender')             && <th style={{ whiteSpace: 'nowrap', minWidth: 90 }}>Gender</th>}
                  {col('status')             && <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Status</th>}
                  {col('mobile')             && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Mobile Number</th>}
                  {col('dob')                && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Date of Birth</th>}
                  {col('admissionNumber')    && <th style={{ whiteSpace: 'nowrap', minWidth: 150 }}>Admission Number</th>}
                  {col('admissionDate')      && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Admission Date</th>}
                  {col('parentName')         && <th style={{ whiteSpace: 'nowrap', minWidth: 150 }}>Parent Name</th>}
                  {col('parentMobile')       && <th style={{ whiteSpace: 'nowrap', minWidth: 140 }}>Parent Mobile</th>}
                  {col('address')            && <th style={{ whiteSpace: 'nowrap', minWidth: 200 }}>Home Address</th>}
                  {col('nationality')        && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Nationality</th>}
                  {col('religion')           && <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Religion</th>}
                  {col('bloodGroup')         && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Blood Group</th>}
                  {col('motherTongue')       && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Mother Tongue</th>}
                  {col('identificationMark') && <th style={{ whiteSpace: 'nowrap', minWidth: 160 }}>Identification Mark</th>}
                  {col('previousSchool')     && <th style={{ whiteSpace: 'nowrap', minWidth: 170 }}>Previous School</th>}
                  {col('medicalInfo')        && <th style={{ whiteSpace: 'nowrap', minWidth: 180 }}>Medical Information</th>}
                  <th style={{ position: 'sticky', right: 0, zIndex: 3, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.08)', minWidth: 52 }}></th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 && (
                  <tr><td colSpan={21}>
                    <EmptyState icon={GraduationCap} message="No students found." action={<button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Student</button>} />
                  </td></tr>
                )}
                {students.map(stu => (
                  <tr key={stu._id} onClick={() => setViewStudent(stu)} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(stu._id)} onChange={e => setSelected(p => e.target.checked ? [...p, stu._id] : p.filter(id => id !== stu._id))} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={stu.photo} name={stu.name} size={32} />
                        <span className="text-14-semibold">{stu.name}</span>
                      </div>
                    </td>
                    {col('classSection')       && <td style={{ fontSize: 13 }}>{stu.currentClass ? `${stu.currentClass.name} – ${stu.currentClass.section}` : '—'}</td>}
                    {col('rollNumber')         && <td style={{ fontSize: 13 }}>{stu.rollNumber || '—'}</td>}
                    {col('gender')             && <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{stu.gender || '—'}</td>}
                    {col('status')             && <td><StatusBadge status={stu.status} /></td>}
                    {col('mobile')             && <td style={{ fontSize: 13 }}>{stu.phone || '—'}</td>}
                    {col('dob')                && <td style={{ fontSize: 13 }}>{stu.dateOfBirth ? format(new Date(stu.dateOfBirth), 'dd MMM yyyy') : '—'}</td>}
                    {col('admissionNumber')    && <td style={{ fontSize: 13 }}><span className="badge badge-info">{stu.admissionNumber || '—'}</span></td>}
                    {col('admissionDate')      && <td style={{ fontSize: 13 }}>{stu.admissionDate ? format(new Date(stu.admissionDate), 'dd MMM yyyy') : '—'}</td>}
                    {col('parentName')         && <td style={{ fontSize: 13 }}>{stu.guardians?.[0]?.name || '—'}</td>}
                    {col('parentMobile')       && <td style={{ fontSize: 13 }}>{stu.guardians?.[0]?.phone || '—'}</td>}
                    {col('address')            && <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.address?.street || '—'}</td>}
                    {col('nationality')        && <td style={{ fontSize: 13 }}>{stu.nationality || '—'}</td>}
                    {col('religion')           && <td style={{ fontSize: 13 }}>{stu.religion || '—'}</td>}
                    {col('bloodGroup')         && <td style={{ fontSize: 13 }}>{stu.bloodGroup || '—'}</td>}
                    {col('motherTongue')       && <td style={{ fontSize: 13 }}>{stu.motherTongue || '—'}</td>}
                    {col('identificationMark') && <td style={{ fontSize: 13, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.identificationMark || '—'}</td>}
                    {col('previousSchool')     && <td style={{ fontSize: 13, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.previousSchool || '—'}</td>}
                    {col('medicalInfo')        && <td style={{ fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.medicalInfo?.conditions?.join(', ') || '—'}</td>}
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
        onDeleteStudent={(id) => { setDeleteId(id); closeModal(); }}
      />

      {promoteModal && (
        <PromoteModal selected={selected} classes={classes}
          onClose={() => setPromoteModal(false)}
          onSuccess={() => { qc.invalidateQueries(['students']); setSelected([]); setPromoteModal(false); }}
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
  uniqueClassNames, filteredSections, watchedClassGroup,
  parents, setParents, parentForm, setParentForm, parentDraft, setParentDraft,
  profilePreview, setProfilePreview, imgInputRef,
  studentStatus, setStudentStatus, control,
  transports, selectedTransport, setSelectedTransport
}) {
  // useWatch subscribes to field changes inside this component and re-renders reactively
  const watched = useWatch({
    control,
    name: ['firstName', 'lastName', 'gender', 'dateOfBirth', 'mobile', 'address',
           'admissionNumber', 'admissionDate', 'classGroup', 'section', 'rollNumber']
  });
  const isFormReady = watched.every(v => v !== undefined && v !== null && String(v).trim() !== '');
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
        { key: 'mobile', label: 'Mobile Number' },
        { key: 'address', label: 'Address' }
      ];
      for (const f of req) {
        if (!values[f.key]) return toast.error(`Please fill the mandatory field: ${f.label}`);
      }
    } else if (formTab === 'academics') {
      const req = [
        { key: 'admissionNumber', label: 'Admission Number' },
        { key: 'admissionDate', label: 'Admission Date' },
        { key: 'classGroup', label: 'Class Group' },
        { key: 'section', label: 'Section' },
        { key: 'rollNumber', label: 'Roll Number' }
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
              {isMutating ? 'Saving...' : editStudent ? 'Update Student' : 'Add Student'}
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
                <select className="form-control" {...register('gender', { required: 'Required' })}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.gender.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="date" {...register('dateOfBirth', { required: 'Required' })} />
                {errors.dateOfBirth && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.dateOfBirth.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('mobile', { required: 'Required' })} placeholder="9876543210" />
                {errors.mobile && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.mobile.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Assign Transport <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(optional)</span></label>
                <select className="form-control" value={selectedTransport} onChange={e => setSelectedTransport(e.target.value)}>
                  <option value="">No transport</option>
                  {(transports || []).map(t => (
                    <option key={t._id} value={t._id}>{t.vehicleType ? t.vehicleType.charAt(0).toUpperCase() + t.vehicleType.slice(1) + ' — ' : ''}{t.routeName}{t.vehicleNumber ? ' (' + t.vehicleNumber + ')' : ''}</option>
                  ))}
                </select>
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Home Address <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-control" {...register('address', { required: 'Required' })} placeholder="Street, City, Pincode" />
              {errors.address && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.address.message}</p>}
            </div>
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
          </>
        )}

        {/* ── Tab 2: Academics ── */}
        {formTab === 'academics' && (
          <>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Admission Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('admissionNumber', { required: 'Required' })} placeholder="e.g. ADM2024001" />
                {errors.admissionNumber && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.admissionNumber.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Admission Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="date" {...register('admissionDate', { required: 'Required' })} />
                {errors.admissionDate && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.admissionDate.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Class <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-control" {...register('classGroup', { required: 'Required' })}>
                  <option value="">Select class</option>
                  {uniqueClassNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {errors.classGroup && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.classGroup.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Section <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-control" {...register('section', { required: 'Required' })} disabled={!watchedClassGroup}>
                  <option value="">Select section</option>
                  {filteredSections.map(c => <option key={c._id} value={c.section}>{c.section}</option>)}
                </select>
                {errors.section && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.section.message}</p>}
              </div>
            </FormRow>
            <div className="form-group" style={{ maxWidth: '50%' }}>
              <label className="form-label">Roll Number <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-control" {...register('rollNumber', { required: 'Required' })} placeholder="e.g. 01" />
              {errors.rollNumber && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.rollNumber.message}</p>}
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
                <select className="form-control" {...register('motherTongue')}>
                  <option value="">Select</option>
                  {['Tamil','Telugu','Kannada','Malayalam','Hindi','English','Urdu','Other'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
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
          <select className="form-control" value={draft.relationship} onChange={e => setDraft(d => ({ ...d, relationship: e.target.value }))}>
            {['father','mother','guardian','other'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
      </FormRow>
      <FormRow>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="form-control" value={draft.mobile} onChange={e => setDraft(d => ({ ...d, mobile: e.target.value }))} placeholder="9876543210" />
        </div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Alternative Mobile</label>
          <input className="form-control" value={draft.alternativeMobile} onChange={e => setDraft(d => ({ ...d, alternativeMobile: e.target.value }))} placeholder="9876543210" />
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
function StudentDetail({ student, onBack, onDelete, onDownload, onEdit }) {
  const [activeTab, setActiveTab] = useState('personal');
  const [zoomImage, setZoomImage] = useState(false);

  const classInfo = student.currentClass;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="page-title">Student Details</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => onEdit(student)}><Edit size={15} /> Edit</button>
          <button className="btn btn-secondary" onClick={() => onDownload(student._id)}><Download size={15} /> Admission Letter</button>
          <button className="btn btn-danger" onClick={() => onDelete(student._id)}><Trash2 size={15} /> Delete</button>
        </div>
      </div>

      {/* Profile card */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div onClick={() => student.photo && setZoomImage(true)} style={{ cursor: student.photo ? 'zoom-in' : 'default' }}>
            <Avatar src={student.photo} name={student.name} size={80} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 className="text-24-bold">{student.name}</h2>
              {student.admissionNumber && <span className="badge badge-info">{student.admissionNumber}</span>}
              <StatusBadge status={student.status} />
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {classInfo && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)' }}><BookOpen size={14} /> {classInfo.name} — Section {classInfo.section}</span>}
              {student.rollNumber && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Roll No: {student.rollNumber}</span>}
              {student.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)' }}><Phone size={14} /> {student.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {DETAIL_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400, fontSize: 14, transition: 'all 0.15s',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 24 }}>
          {/* Personal tab */}
          {activeTab === 'personal' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Basic Information</SectionTitle>
                <DetailRow label="Date of Birth" value={student.dateOfBirth ? format(new Date(student.dateOfBirth), 'dd MMM yyyy') : null} />
                <DetailRow label="Gender" value={student.gender} capitalize />
                <DetailRow label="Blood Group" value={student.bloodGroup} />
                <DetailRow label="Category" value={student.category?.toUpperCase()} />
                <DetailRow label="Aadhar" value={student.aadharNumber} />
              </div>
              <div>
                <SectionTitle>Contact</SectionTitle>
                {student.phone && <ContactItem icon={Phone} value={student.phone} />}
                {student.alternativeMobile && <ContactItem icon={Phone} value={`${student.alternativeMobile} (Alt)`} />}
                {student.email && <ContactItem icon={Mail} value={student.email} />}
                {student.address?.street && <ContactItem icon={MapPin} value={student.address.street} />}
              </div>
            </div>
          )}

          {/* Academics tab */}
          {activeTab === 'academics' && (
            <div style={{ maxWidth: 480 }}>
              <SectionTitle>Academic Details</SectionTitle>
              <DetailRow label="Admission Number" value={student.admissionNumber} />
              <DetailRow label="Admission Date" value={student.admissionDate ? format(new Date(student.admissionDate), 'dd MMM yyyy') : null} />
              <DetailRow label="Class" value={classInfo?.name} />
              <DetailRow label="Section" value={classInfo?.section} />
              <DetailRow label="Roll Number" value={student.rollNumber} />
            </div>
          )}

          {/* Parents tab */}
          {activeTab === 'parents' && (
            <>
              <SectionTitle>Parent / Guardian Details</SectionTitle>
              {student.guardians?.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {student.guardians.map((g, i) => (
                    <div key={i} style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-14-semibold">{g.name}</div>
                          <span style={{ fontSize: 12, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{g.relation}</span>
                        </div>
                      </div>
                      {g.phone && <ContactItem icon={Phone} value={g.phone} />}
                      {g.alternativeMobile && <ContactItem icon={Phone} value={`${g.alternativeMobile} (Alt)`} />}
                      {g.email && <ContactItem icon={Mail} value={g.email} />}
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No parent/guardian details added.</p>}
            </>
          )}

          {/* Others tab */}
          {activeTab === 'others' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Background</SectionTitle>
                <DetailRow label="Nationality" value={student.nationality} />
                <DetailRow label="Religion" value={student.religion} />
                <DetailRow label="Mother Tongue" value={student.motherTongue} />
                <DetailRow label="Previous School" value={student.previousSchool} />
                <DetailRow label="Identification Mark" value={student.identificationMark} />
              </div>
              <div>
                <SectionTitle>Medical &amp; Remarks</SectionTitle>
                {student.medicalInfo?.conditions?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>MEDICAL CONDITIONS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {student.medicalInfo.conditions.map(c => <span key={c} className="badge badge-secondary">{c}</span>)}
                    </div>
                  </div>
                )}
                {student.remarks && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>REMARKS</div>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{student.remarks}</p>
                  </div>
                )}
                {!student.medicalInfo?.conditions?.length && !student.remarks && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No additional info added.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {zoomImage && student.photo && (
        <div 
          onClick={() => setZoomImage(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out'
          }}
        >
          <img 
            src={student.photo} 
            alt={student.name} 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: 320, height: 320, objectFit: 'cover', 
              borderRadius: '50%', border: '4px solid white',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              cursor: 'default'
            }} 
          />
        </div>
      )}
    </div>
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

function ContactItem({ icon: Icon, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
      <Icon size={13} style={{ flexShrink: 0 }} /> {value}
    </div>
  );
}


function PromoteModal({ selected, classes, onClose, onSuccess }) {
  const [toClass, setToClass] = useState('');
  const [year, setYear] = useState(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [loading, setLoading] = useState(false);

  const handlePromote = async () => {
    if (!toClass) return toast.error('Select target class');
    setLoading(true);
    try {
      await api.post('/students/promote', { studentIds: selected, toClassId: toClass, academicYear: year });
      toast.success(`${selected.length} students promoted!`);
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Promote ${selected.length} Students`}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handlePromote} disabled={loading}>{loading ? 'Promoting...' : 'Promote Students'}</button>
      </>}>
      <div className="form-group">
        <label className="form-label">Target Class <span style={{ color: '#ef4444' }}>*</span></label>
        <select className="form-control" value={toClass} onChange={e => setToClass(e.target.value)}>
          <option value="">Select target class</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">New Academic Year <span style={{ color: '#ef4444' }}>*</span></label>
        <input className="form-control" value={year} onChange={e => setYear(e.target.value)} placeholder="2025-2026" />
      </div>
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400e' }}>
        ⚠️ This will update {selected.length} student(s) to the selected class.
      </div>
    </Modal>
  );
}
