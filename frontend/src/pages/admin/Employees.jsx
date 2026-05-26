import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Plus, Download, Eye, Trash2, Users, ClipboardList, ChevronLeft, ChevronRight, Camera, Edit, ArrowLeft, Mail, MapPin, Briefcase, Phone, BookOpen, User as UserIcon, FileText, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput, Avatar, EmptyState, PageLoader, FormRow, ColumnSelector, useColumnSelector } from '../../components/ui';
import { BulkUploadModal } from '../../components/ui/BulkUploadModal';

const EMPLOYEE_COLS = [
  { key: 'employeeId', label: 'Employee ID', required: true },
  { key: 'role', label: 'Role', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'designation', label: 'Designation', required: true },
  { key: 'employmentType', label: 'Employment Type', default: false },
  { key: 'dateOfJoining', label: 'Date of Joining', default: false },
  { key: 'workLocation', label: 'Work Location', default: false },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', default: false },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'dob', label: 'Date of Birth', required: true },
  { key: 'bloodGroup', label: 'Blood Group', default: false },
  { key: 'address', label: 'Address', default: false },
  { key: 'city', label: 'City', default: false },
  { key: 'state', label: 'State', default: false },
  { key: 'country', label: 'Country', default: false },
  { key: 'status', label: 'Status', required: true },
];

const FORM_TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'work', label: 'Work' },
  { key: 'academics', label: 'Academics' },
  { key: 'experience', label: 'Experience' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'documents', label: 'Documents' },
  { key: 'bank', label: 'Bank' },
];

const DETAIL_TABS = [
  { key: 'personal',   label: 'Personal & Work' },
  { key: 'academic',   label: 'Academics, Experience & Docs' },
  { key: 'emergency',  label: 'Emergency & Bank' },
  { key: 'attendance', label: 'Attendance' },
];

const EMP_STATUS_META = {
  present:  { label: 'Present',  bg: '#d1fae5', color: '#065f46' },
  absent:   { label: 'Absent',   bg: '#fee2e2', color: '#991b1b' },
  late:     { label: 'Late',     bg: '#fef3c7', color: '#92400e' },
  half_day: { label: 'Half Day', bg: '#dbeafe', color: '#1e40af' },
  od:       { label: 'OD',       bg: '#f3e8ff', color: '#6b21a8' },
  cl:       { label: 'CL',       bg: '#e0f2fe', color: '#075985' },
  sl:       { label: 'SL',       bg: '#fce7f3', color: '#831843' },
  excused:  { label: 'Excused',  bg: '#f0fdf4', color: '#166534' },
};

const ATT_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ATT_DAY_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function Employees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [tasksEmployee, setTasksEmployee] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Form states
  const [formTab, setFormTab] = useState('personal');
  const [employeeStatus, setEmployeeStatus] = useState('active');
  const [savedEmployee, setSavedEmployee] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const imgInputRef = useRef(null);

  // Multi-add states
  const [academics, setAcademics] = useState([]);
  const [experience, setExperience] = useState([]);
  const [emergency, setEmergency] = useState([]);
  const [documents, setDocuments] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, roleFilter],
    queryFn: () => api.get(`/employees?page=${page}&limit=20&search=${search}&role=${roleFilter}`)
  });

  const employees = data?.employees || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/employees', d),
    onSuccess: (res) => {
      qc.invalidateQueries(['employees']);
      toast.success('Employee added!');
      setSavedEmployee(res.employee || res);
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
    onSuccess: (res) => {
      qc.invalidateQueries(['employees']);
      toast.success('Employee updated!');
      setViewEmployee(res.employee || res);
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to update employee')
  });

  const resendMutation = useMutation({
    mutationFn: (id) => api.put(`/employees/${id}`, { sendInvite: true }),
    onSuccess: (res) => {
      if (res.emailSent) toast.success('Login credentials resent successfully!');
      else toast.error('Email failed — check Gmail App Password in server .env', { duration: 6000 });
    },
    onError: () => toast.error('Failed to resend credentials'),
  });

  const handleSendInviteToNew = () => {
    resendMutation.mutate(savedEmployee._id, {
      onSuccess: (res) => {
        if (res.emailSent) toast.success('Login credentials sent successfully!');
        else toast.error('Email failed — check Gmail App Password in server .env', { duration: 6000 });
        closeModal();
      },
      onError: () => { toast.error('Failed to send credentials'); closeModal(); },
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee deleted'); setDeleteId(null); }
  });

  const bulkDeleteMutation = async () => {
    await Promise.all(selected.map(id => api.delete(`/employees/${id}`)));
    qc.invalidateQueries(['employees']);
    setSelected([]);
    setBulkDeleteConfirm(false);
    toast.success(`${selected.length} employee(s) deleted`);
  };

  const openEdit = (emp) => {
    setEditEmployee(emp);
    setFormTab('personal');
    setEmployeeStatus(emp.status || 'active');
    setProfilePreview(emp.photo || null);

    const nameParts = (emp.name || '').split(' ');
    reset({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: emp.email || '',
      phone: emp.phone || emp.mobile || '',
      gender: emp.gender || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '',
      bloodGroup: emp.bloodGroup || '',
      country: emp.country || '',
      state: emp.state || '',
      city: emp.city || '',
      address: emp.address || '',

      employeeId: emp.employeeId || '',
      role: emp.role || '',
      department: emp.department || '',
      designation: emp.designation || '',
      employmentType: emp.employmentType || '',
      dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : '',
      workLocation: emp.workLocation || '',

      salary: emp.salary || {},
      bank: emp.bank || {}
    });

    setAcademics(emp.academics || []);
    setExperience(emp.experience || []);
    setEmergency(emp.emergencyContacts || emp.emergency || []);
    setDocuments(emp.documents || []);

    setShowModal(true);
  };

  const downloadJobOffer = async (id) => {
    try {
      const res = await fetch(`/api/employees/${id}/job-offer-pdf`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'job-offer.pdf'; a.click();
    } catch { toast.error('Failed to generate PDF'); }
  };

  const roles = ['teacher', 'principal', 'accountant', 'maintenance', 'correspondent', 'admin', 'other'];

  const [visibleCols, setVisibleCols] = useColumnSelector('employees', EMPLOYEE_COLS);
  const col = (key) => visibleCols.has(key);

  const closeModal = () => {
    setShowModal(false);
    setEditEmployee(null);
    setFormTab('personal');
    setEmployeeStatus('active');
    setProfilePreview(null);
    setSavedEmployee(null);
    setAcademics([]);
    setExperience([]);
    setEmergency([]);
    setDocuments([]);
    reset({});
  };

  const openAdd = () => {
    closeModal();
    setShowModal(true);
  };

  const onSubmit = (data) => {
    const firstName = (data.firstName || '').trim();
    const lastName = (data.lastName || '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ');

    const payload = {
      ...data,
      name,
      photo: profilePreview || undefined,
      status: employeeStatus,
      academics,
      experience,
      emergencyContacts: emergency,
      documents,
      phone: data.phone || data.mobile,
    };

    if (editEmployee) {
      updateMutation.mutate({ id: editEmployee._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isMutating = createMutation.isLoading || updateMutation.isLoading;
  const tabIdx = FORM_TABS.findIndex(t => t.key === formTab);

  if (viewEmployee) {
    return (
      <>
        <EmployeeDetail
          employee={viewEmployee}
          onBack={() => setViewEmployee(null)}
          onDelete={(id) => { setDeleteId(id); setViewEmployee(null); }}
          onDownload={downloadJobOffer}
          onEdit={(emp) => { openEdit(emp); setViewEmployee(null); }}
          onTasks={(emp) => { setTasksEmployee(emp); setViewEmployee(null); }}
        />
        <ConfirmDialog
          open={!!deleteId} onClose={() => setDeleteId(null)}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          title="Delete Employee" message="This will permanently delete the employee and cannot be undone." danger
        />
        <AddEditEmployeeModal
          open={showModal} onClose={closeModal}
          editEmployee={editEmployee} isMutating={isMutating}
          formTab={formTab} setFormTab={setFormTab} tabIdx={tabIdx}
          register={register} errors={errors} handleSubmit={handleSubmit} onSubmit={onSubmit}
          control={control} employeeStatus={employeeStatus} setEmployeeStatus={setEmployeeStatus}
          profilePreview={profilePreview} setProfilePreview={setProfilePreview} imgInputRef={imgInputRef}
          academics={academics} setAcademics={setAcademics} experience={experience} setExperience={setExperience}
          emergency={emergency} setEmergency={setEmergency} documents={documents} setDocuments={setDocuments}
          roles={roles} savedEmployee={savedEmployee}
          onSendInviteToNew={handleSendInviteToNew}
          onResend={() => resendMutation.mutate(editEmployee._id)}
          isResending={resendMutation.isPending}
        />
      </>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{total} staff members</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
          <Upload size={16} /> Bulk Upload
        </button>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Employee
        </button>
        </div>
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, employee ID..." />
        <select className="form-control" style={{ width: 'auto' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        {selected.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={() => setBulkDeleteConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={15} /> Delete ({selected.length})
          </button>
        )}
        <ColumnSelector storageKey="employees" cols={EMPLOYEE_COLS} visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', minWidth: 36 }}>
                    <input type="checkbox" onChange={e => setSelected(e.target.checked ? employees.map(s => s._id) : [])} />
                  </th>
                  <th style={{ whiteSpace: 'nowrap', minWidth: 180 }}>Employee Name</th>
                  {col('employeeId') && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Employee ID</th>}
                  {col('role') && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Role</th>}
                  {col('department') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Department</th>}
                  {col('designation') && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Designation</th>}
                  {col('employmentType') && <th style={{ whiteSpace: 'nowrap', minWidth: 140 }}>Employment Type</th>}
                  {col('dateOfJoining') && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Date of Joining</th>}
                  {col('workLocation') && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Work Location</th>}
                  {col('phone') && <th style={{ whiteSpace: 'nowrap', minWidth: 130 }}>Phone</th>}
                  {col('email') && <th style={{ whiteSpace: 'nowrap', minWidth: 180 }}>Email</th>}
                  {col('gender') && <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Gender</th>}
                  {col('dob') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Date of Birth</th>}
                  {col('bloodGroup') && <th style={{ whiteSpace: 'nowrap', minWidth: 110 }}>Blood Group</th>}
                  {col('address') && <th style={{ whiteSpace: 'nowrap', minWidth: 200 }}>Address</th>}
                  {col('city') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>City</th>}
                  {col('state') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>State</th>}
                  {col('country') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Country</th>}
                  {col('status') && <th style={{ whiteSpace: 'nowrap', minWidth: 100 }}>Status</th>}
                  <th style={{ position: 'sticky', right: 0, zIndex: 3, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.08)', minWidth: 52 }}></th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={21}>
                    <EmptyState icon={Users} message="No employees yet. Add your first staff member!" action={<button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Employee</button>} />
                  </td></tr>
                )}
                {employees.map(emp => (
                  <tr key={emp._id} onClick={() => setViewEmployee(emp)} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(emp._id)} onChange={e => setSelected(p => e.target.checked ? [...p, emp._id] : p.filter(id => id !== emp._id))} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={emp.photo} name={emp.name} size={34} />
                        <div>
                          <div className="text-14-semibold">{emp.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    {col('employeeId') && <td style={{ fontSize: 13 }}><span className="badge badge-secondary">{emp.employeeId || '—'}</span></td>}
                    {col('role') && <td style={{ fontSize: 13 }}><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{emp.role || '—'}</span></td>}
                    {col('department') && <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{emp.department || '—'}</td>}
                    {col('designation') && <td style={{ fontSize: 13 }}>{emp.designation || '—'}</td>}
                    {col('employmentType') && <td style={{ fontSize: 13 }}>{emp.employmentType || '—'}</td>}
                    {col('dateOfJoining') && <td style={{ fontSize: 13 }}>{emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-GB') : '—'}</td>}
                    {col('workLocation') && <td style={{ fontSize: 13 }}>{emp.workLocation || '—'}</td>}
                    {col('phone') && <td style={{ fontSize: 13 }}>{emp.phone || emp.mobile || '—'}</td>}
                    {col('email') && <td style={{ fontSize: 13 }}>{emp.email || '—'}</td>}
                    {col('gender') && <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{emp.gender || '—'}</td>}
                    {col('dob') && <td style={{ fontSize: 13 }}>{emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString('en-GB') : '—'}</td>}
                    {col('bloodGroup') && <td style={{ fontSize: 13 }}>{emp.bloodGroup || '—'}</td>}
                    {col('address') && <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.address || '—'}</td>}
                    {col('city') && <td style={{ fontSize: 13 }}>{emp.city || '—'}</td>}
                    {col('state') && <td style={{ fontSize: 13 }}>{emp.state || '—'}</td>}
                    {col('country') && <td style={{ fontSize: 13 }}>{emp.country || '—'}</td>}
                    {col('status') && <td><StatusBadge status={emp.status} /></td>}
                    <td style={{ position: 'sticky', right: 0, zIndex: 2, background: 'white', boxShadow: '-2px 0 5px rgba(0,0,0,0.08)' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(emp)}>
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

      <AddEditEmployeeModal
        open={showModal} onClose={closeModal}
        editEmployee={editEmployee} isMutating={isMutating}
        formTab={formTab} setFormTab={setFormTab} tabIdx={tabIdx}
        register={register} errors={errors} handleSubmit={handleSubmit} onSubmit={onSubmit}
        control={control}
        employeeStatus={employeeStatus} setEmployeeStatus={setEmployeeStatus}
        profilePreview={profilePreview} setProfilePreview={setProfilePreview} imgInputRef={imgInputRef}
        academics={academics} setAcademics={setAcademics}
        experience={experience} setExperience={setExperience}
        emergency={emergency} setEmergency={setEmergency}
        documents={documents} setDocuments={setDocuments}
        roles={roles} savedEmployee={savedEmployee}
        onSendInviteToNew={handleSendInviteToNew}
        onResend={() => resendMutation.mutate(editEmployee?._id)}
        isResending={resendMutation.isPending}
      />



      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Delete Employee" message="This will permanently delete the employee and cannot be undone."
        danger
      />
      <ConfirmDialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={bulkDeleteMutation}
        title="Delete Employees" message={`This will permanently delete ${selected.length} employee(s) and cannot be undone.`} danger
      />
      <BulkUploadModal open={showBulkModal} onClose={() => setShowBulkModal(false)} type="employee" onSuccess={() => qc.invalidateQueries(['employees'])} />
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function AddEditEmployeeModal({
  open, onClose, editEmployee, isMutating,
  formTab, setFormTab, tabIdx,
  register, errors, handleSubmit, onSubmit,
  control, employeeStatus, setEmployeeStatus,
  profilePreview, setProfilePreview, imgInputRef,
  academics, setAcademics, experience, setExperience,
  emergency, setEmergency, documents, setDocuments, roles,
  savedEmployee, onSendInviteToNew, onResend, isResending
}) {
  const watched = useWatch({
    control,
    name: ['firstName', 'lastName', 'email', 'phone', 'role', 'employeeId']
  });

  // Checking if core fields are present
  const isFormReady = watched[0] && watched[1] && watched[2] && watched[3] && watched[4] && watched[5];

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setProfilePreview(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentChange = (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Document must be under 2 MB'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setDocuments(docs => docs.map((d, i) => i === idx ? { ...d, fileData: ev.target.result, fileName: file.name } : d));
    };
    reader.readAsDataURL(file);
  };

  const handleTabSwitch = (targetTabKey) => {
    if (formTab === targetTabKey) return;
    
    const values = control._formValues;
    if (formTab === 'personal') {
      const req = [
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Mobile Number' }
      ];
      for (const f of req) {
        if (!values[f.key]?.trim()) return toast.error(`Please fill the mandatory field: ${f.label}`);
      }
    } else if (formTab === 'work') {
      const req = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'role', label: 'Role' }
      ];
      for (const f of req) {
        if (!values[f.key]?.trim()) return toast.error(`Please fill the mandatory field: ${f.label}`);
      }
    }
    setFormTab(targetTabKey);
  };

  return (
    <Modal open={open} onClose={onClose} title={editEmployee ? 'Edit Employee' : 'Add New Employee'} size="lg"
      footer={savedEmployee ? null :
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => tabIdx > 0 ? setFormTab(FORM_TABS[tabIdx - 1].key) : onClose()}>
              {tabIdx > 0 ? <><ChevronLeft size={15} /> Previous</> : 'Cancel'}
            </button>
            {editEmployee && (
              <button type="button" className="btn btn-secondary" onClick={onResend} disabled={isResending}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isResending ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid #cbd5e1', borderTopColor: 'var(--text-secondary)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Sending...
                  </>
                ) : '↺ Resend Credentials'}
              </button>
            )}
          </div>
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
              {isMutating ? 'Saving...' : editEmployee ? 'Update Employee' : 'Add Employee'}
            </button>
          </div>
        </div>
      }
    >
      {savedEmployee ? (
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: '#d1fae5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Employee Added!</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 28px', fontSize: 14 }}>
            Send login credentials to <strong style={{ color: 'var(--text-primary)' }}>{savedEmployee.email}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={onSendInviteToNew} disabled={isResending}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isResending ? (
                <>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Sending...
                </>
              ) : (
                <><Mail size={15} /> Send Invite</>
              )}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
      <>
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20, overflowX: 'auto' }}>
        {FORM_TABS.map((tab, i) => {
          const active = formTab === tab.key;
          const done = i < tabIdx;
          return (
            <button key={tab.key} type="button" onClick={() => handleTabSwitch(tab.key)}
              style={{
                flex: '0 0 auto', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer',
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
        {/* Tab 1: Personal */}
        {formTab === 'personal' && (
          <>
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

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Status <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                <button type="button" onClick={() => setEmployeeStatus('active')}
                  style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: employeeStatus === 'active' ? '#10b981' : '#f8fafc', color: employeeStatus === 'active' ? 'white' : 'var(--text-muted)' }}>
                  Active
                </button>
                <button type="button" onClick={() => setEmployeeStatus('inactive')}
                  style={{ padding: '8px 20px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: employeeStatus === 'inactive' ? '#ef4444' : '#f8fafc', color: employeeStatus === 'inactive' ? 'white' : 'var(--text-muted)' }}>
                  Inactive
                </button>
              </div>
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
                <label className="form-label">Email <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" type="email" {...register('email', { required: 'Required' })} placeholder="email@example.com" />
                {errors.email && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('phone', { required: 'Required' })} placeholder="9876543210" />
                {errors.phone && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" {...register('gender')}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input className="form-control" type="date" {...register('dateOfBirth')} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="form-control" {...register('bloodGroup')}>
                  <option value="">Select</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="form-control" {...register('country')} placeholder="e.g. India" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-control" {...register('state')} placeholder="e.g. Maharashtra" />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-control" {...register('city')} placeholder="e.g. Mumbai" />
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-control" {...register('address')} placeholder="Street address, Pincode" />
            </div>
          </>
        )}

        {/* Tab 2: Work */}
        {formTab === 'work' && (
          <>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Staff Employee ID <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-control" {...register('employeeId', { required: 'Required' })} placeholder="e.g. EMP001" />
                {errors.employeeId && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.employeeId.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Role <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-control" {...register('role', { required: 'Required' })}>
                  <option value="">Select role</option>
                  {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                {errors.role && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.role.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-control" {...register('department')} placeholder="e.g. Mathematics" />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-control" {...register('designation')} placeholder="e.g. Senior Teacher" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Employment Type</label>
                <select className="form-control" {...register('employmentType')}>
                  <option value="">Select type</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Joining</label>
                <input className="form-control" type="date" {...register('dateOfJoining')} />
              </div>
            </FormRow>
            <div className="form-group" style={{ maxWidth: '50%' }}>
              <label className="form-label">Work Location</label>
              <input className="form-control" {...register('workLocation')} placeholder="e.g. Main Campus" />
            </div>
          </>
        )}

        {/* Tab 3: Academics */}
        {formTab === 'academics' && (
          <>
            {academics.map((entry, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: 16, borderRadius: 10, marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h5 className="text-14-semibold">Academic Entry {idx + 1}</h5>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => setAcademics(a => a.filter((_, i) => i !== idx))}><Trash2 size={13} /></button>
                </div>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Institution Name</label>
                    <input className="form-control" value={entry.institutionName || ''} onChange={e => setAcademics(a => a.map((x, i) => i === idx ? { ...x, institutionName: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input className="form-control" value={entry.qualification || ''} onChange={e => setAcademics(a => a.map((x, i) => i === idx ? { ...x, qualification: e.target.value } : x))} />
                  </div>
                </FormRow>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Field Of Study</label>
                    <input className="form-control" value={entry.fieldOfStudy || ''} onChange={e => setAcademics(a => a.map((x, i) => i === idx ? { ...x, fieldOfStudy: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Grade / Percentage</label>
                    <input className="form-control" value={entry.grade || ''} onChange={e => setAcademics(a => a.map((x, i) => i === idx ? { ...x, grade: e.target.value } : x))} />
                  </div>
                </FormRow>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Start Year</label>
                    <input className="form-control" type="number" value={entry.startYear || ''} onChange={e => setAcademics(a => a.map((x, i) => i === idx ? { ...x, startYear: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Year</label>
                    <input className="form-control" type="number" value={entry.endYear || ''} onChange={e => setAcademics(a => a.map((x, i) => i === idx ? { ...x, endYear: e.target.value } : x))} />
                  </div>
                </FormRow>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }} onClick={() => setAcademics(a => [...a, {}])}>
              <Plus size={16} /> Add More Academics
            </button>
          </>
        )}

        {/* Tab 4: Experience */}
        {formTab === 'experience' && (
          <>
            {experience.map((entry, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: 16, borderRadius: 10, marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h5 className="text-14-semibold">Experience Entry {idx + 1}</h5>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => setExperience(a => a.filter((_, i) => i !== idx))}><Trash2 size={13} /></button>
                </div>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Organization Name</label>
                    <input className="form-control" value={entry.organizationName || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, organizationName: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input className="form-control" value={entry.designation || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, designation: e.target.value } : x))} />
                  </div>
                </FormRow>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <select className="form-control" value={entry.employmentType || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, employmentType: e.target.value } : x))}>
                      <option value="">Select type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Skills Used</label>
                    <input className="form-control" value={entry.skillsUsed || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, skillsUsed: e.target.value } : x))} />
                  </div>
                </FormRow>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input className="form-control" type="date" value={entry.startDate || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, startDate: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input className="form-control" type="date" value={entry.endDate || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, endDate: e.target.value } : x))} />
                  </div>
                </FormRow>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }} onClick={() => setExperience(a => [...a, {}])}>
              <Plus size={16} /> Add More Experience
            </button>
          </>
        )}

        {/* Tab 5: Emergency */}
        {formTab === 'emergency' && (
          <>
            {emergency.map((entry, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: 16, borderRadius: 10, marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h5 className="text-14-semibold">Emergency Contact {idx + 1}</h5>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => setEmergency(a => a.filter((_, i) => i !== idx))}><Trash2 size={13} /></button>
                </div>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input className="form-control" value={entry.name || ''} onChange={e => setEmergency(a => a.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Relationship</label>
                    <input className="form-control" value={entry.relationship || ''} onChange={e => setEmergency(a => a.map((x, i) => i === idx ? { ...x, relationship: e.target.value } : x))} />
                  </div>
                </FormRow>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Contact Number</label>
                    <input className="form-control" value={entry.contactNumber || ''} onChange={e => setEmergency(a => a.map((x, i) => i === idx ? { ...x, contactNumber: e.target.value } : x))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alternate Contact Number</label>
                    <input className="form-control" value={entry.alternateContactNumber || ''} onChange={e => setEmergency(a => a.map((x, i) => i === idx ? { ...x, alternateContactNumber: e.target.value } : x))} />
                  </div>
                </FormRow>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-control" value={entry.address || ''} onChange={e => setEmergency(a => a.map((x, i) => i === idx ? { ...x, address: e.target.value } : x))} />
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }} onClick={() => setEmergency(a => [...a, {}])}>
              <Plus size={16} /> Add More Emergency Contacts
            </button>
          </>
        )}

        {/* Tab 6: Documents */}
        {formTab === 'documents' && (
          <>
            {documents.map((entry, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: 16, borderRadius: 10, marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h5 className="text-14-semibold">Document Entry {idx + 1}</h5>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => setDocuments(a => a.filter((_, i) => i !== idx))}><Trash2 size={13} /></button>
                </div>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Document Type</label>
                    <select className="form-control" value={entry.documentType || ''} onChange={e => setDocuments(a => a.map((x, i) => i === idx ? { ...x, documentType: e.target.value } : x))}>
                      <option value="">Select type</option>
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="PAN Card">PAN Card</option>
                      <option value="Resume">Resume</option>
                      <option value="Certificates">Certificates</option>
                      <option value="Experience Letter">Experience Letter</option>
                      <option value="Other Documents">Other Documents</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Upload File</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="file" className="form-control" onChange={(e) => handleDocumentChange(idx, e)} />
                      {entry.fileName && <span style={{ fontSize: 12, color: 'var(--primary)' }}>{entry.fileName}</span>}
                    </div>
                  </div>
                </FormRow>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }} onClick={() => setDocuments(a => [...a, {}])}>
              <Plus size={16} /> Add More Documents
            </button>
          </>
        )}

        {/* Tab 7: Bank */}
        {formTab === 'bank' && (
          <>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Account Holder Name</label>
                <input className="form-control" {...register('bank.accountHolderName')} placeholder="e.g. John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input className="form-control" {...register('bank.bankName')} placeholder="e.g. State Bank of India" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input className="form-control" {...register('bank.accountNumber')} placeholder="e.g. 1234567890" />
              </div>
              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input className="form-control" {...register('bank.ifscCode')} placeholder="e.g. SBIN0001234" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Branch Name</label>
                <input className="form-control" {...register('bank.branchName')} placeholder="e.g. Main Branch" />
              </div>
              <div className="form-group">
                <label className="form-label">UPI ID</label>
                <input className="form-control" {...register('bank.upiId')} placeholder="e.g. john@upi" />
              </div>
            </FormRow>
          </>
        )}
      </form>
      </>
      )}
    </Modal>
  );
}

// ── Employee Detail Page ───────────────────────────────────────────────────────
function EmployeeDetail({ employee, onBack, onDelete, onDownload, onEdit, onTasks }) {
  const [activeTab, setActiveTab] = useState('personal');
  const [zoomImage, setZoomImage] = useState(false);

  const phone = employee.phone || employee.mobile;
  const addressParts = [employee.address, employee.city, employee.state, employee.country].filter(Boolean);

  return (
    <div>
      {/* Page nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {employee.role === 'maintenance' && (
            <button className="btn btn-secondary btn-sm" onClick={() => onTasks(employee)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={14} /> Tasks
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(employee)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Edit size={14} /> Edit
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onDownload(employee._id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Job Offer
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(employee._id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* ── Profile header card ── */}
      <div className="card" style={{ padding: '14px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div onClick={() => employee.photo && setZoomImage(true)} style={{ cursor: employee.photo ? 'zoom-in' : 'default', flexShrink: 0 }}>
            <Avatar src={employee.photo} name={employee.name} size={76} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{employee.name}</h2>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: employee.status === 'active' ? '#10b981' : '#94a3b8', flexShrink: 0 }} title={employee.status} />
              {employee.employeeId && <span className="badge badge-info">{employee.employeeId}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {employee.role && (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}>
                  <Briefcase size={13} /> {employee.role}
                </span>
              )}
              {employee.department && (
                <><span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, fontWeight: 700 }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dept: {employee.department}</span></>
              )}
              {employee.designation && (
                <><span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, fontWeight: 700 }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{employee.designation}</span></>
              )}
              {phone && (
                <><span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, fontWeight: 700 }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{phone}</span></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs + content card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px' }}>
          {DETAIL_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 0', marginRight: 32, border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400, fontSize: 14, transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 28 }}>

          {/* ── Tab 1: Personal & Work ── */}
          {activeTab === 'personal' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 260px', gap: 0, alignItems: 'start' }}>

              {/* Left: personal + work details */}
              <div style={{ paddingRight: 32 }}>
                <div style={{ marginBottom: 32 }}>
                  <SectionTitle>Personal Details</SectionTitle>
                  <DetailRow label="Full Name"     value={employee.name} />
                  <DetailRow label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB') : null} />
                  <DetailRow label="Gender"        value={employee.gender} capitalize />
                  <DetailRow label="Blood Group"   value={employee.bloodGroup} />
                  <DetailRow label="Status"        value={employee.status} capitalize />
                </div>
                <div>
                  <SectionTitle>Work Details</SectionTitle>
                  <DetailRow label="Employee ID"     value={employee.employeeId} />
                  <DetailRow label="Role"            value={employee.role} capitalize />
                  <DetailRow label="Designation"     value={employee.designation} />
                  <DetailRow label="Department"      value={employee.department} />
                  <DetailRow label="Employment Type" value={employee.employmentType} />
                  <DetailRow label="Date of Joining" value={employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString('en-GB') : null} />
                  <DetailRow label="Work Location"   value={employee.workLocation} />
                </div>
              </div>

              {/* Vertical divider */}
              <div style={{ background: 'var(--border)', width: 1, alignSelf: 'stretch' }} />

              {/* Right sidebar: contact + address */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 32 }}>
                {(employee.email || phone) && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Contact</div>
                    {employee.email && <SidebarItem icon={Mail} value={employee.email} />}
                    {phone && <SidebarItem icon={Phone} value={phone} />}
                  </div>
                )}
                {addressParts.length > 0 && (
                  <>
                    {(employee.email || phone) && <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Address</div>
                      {employee.address && <SidebarItem icon={MapPin} value={employee.address} />}
                      {(employee.city || employee.state || employee.country) && (
                        <SidebarRow label="City / State" value={[employee.city, employee.state, employee.country].filter(Boolean).join(', ')} />
                      )}
                    </div>
                  </>
                )}
                {!employee.email && !phone && addressParts.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No contact information.</p>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 2: Academics, Experience & Docs ── */}
          {activeTab === 'academic' && (
            <div>
              {/* Academics */}
              <div style={{ marginBottom: 32 }}>
                <SectionTitle>Academics</SectionTitle>
                {employee.academics?.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {employee.academics.map((acad, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {acad.qualification}{acad.fieldOfStudy ? ` — ${acad.fieldOfStudy}` : ''}
                        </div>
                        {acad.institutionName && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{acad.institutionName}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {acad.startYear && acad.endYear ? `${acad.startYear} – ${acad.endYear}` : acad.startYear || acad.endYear || ''}
                          {acad.grade ? ` · Grade: ${acad.grade}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No academics added.</p>}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginBottom: 32 }} />

              {/* Experience */}
              <div style={{ marginBottom: 32 }}>
                <SectionTitle>Experience</SectionTitle>
                {employee.experience?.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {employee.experience.map((exp, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{exp.designation}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{exp.organizationName}</div>
                        {exp.employmentType && (
                          <span style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 4 }}>{exp.employmentType}</span>
                        )}
                        {exp.skillsUsed && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Skills: {exp.skillsUsed}</div>}
                        {(exp.startDate || exp.endDate) && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-GB') : '—'} → {exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-GB') : 'Present'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No experience added.</p>}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginBottom: 32 }} />

              {/* Documents */}
              <div>
                <SectionTitle>Documents</SectionTitle>
                {employee.documents?.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {employee.documents.map((doc, i) => (
                      <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={20} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.documentType}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{doc.fileName || 'Uploaded file'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No documents uploaded.</p>}
              </div>
            </div>
          )}

          {/* ── Tab 4: Attendance ── */}
          {activeTab === 'attendance' && <EmployeeAttendanceTab employee={employee} />}

          {/* ── Tab 3: Emergency & Bank ── */}
          {activeTab === 'emergency' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, alignItems: 'start' }}>

              {/* Left: emergency contacts */}
              <div style={{ paddingRight: 32 }}>
                <SectionTitle>Emergency Contacts</SectionTitle>
                {employee.emergencyContacts?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {employee.emergencyContacts.map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: i === 0 ? 'var(--primary)' : '#64748b',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 17, flexShrink: 0,
                        }}>
                          {(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                          </div>
                          {c.relationship && (
                            <span style={{ fontSize: 11, background: '#eff6ff', color: 'var(--primary)', padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{c.relationship}</span>
                          )}
                          {c.address && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{c.address}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          {c.contactNumber && <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={12} color="var(--text-muted)" /> {c.contactNumber}</span>}
                          {c.alternateContactNumber && <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={11} color="var(--text-muted)" /> {c.alternateContactNumber} (Alt)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No emergency contacts added.</p>}
              </div>

              {/* Vertical divider */}
              <div style={{ background: 'var(--border)', width: 1, alignSelf: 'stretch' }} />

              {/* Right: bank details */}
              <div style={{ paddingLeft: 32 }}>
                <SectionTitle>Bank Information</SectionTitle>
                <DetailRow label="Account Holder" value={employee.bank?.accountHolderName} />
                <DetailRow label="Bank Name"       value={employee.bank?.bankName} />
                <DetailRow label="Account Number"  value={employee.bank?.accountNumber} />
                <DetailRow label="IFSC Code"       value={employee.bank?.ifscCode} />
                <DetailRow label="Branch"          value={employee.bank?.branchName} />
                <DetailRow label="UPI ID"          value={employee.bank?.upiId} />
                <DetailRow label="Payment Mode"    value={employee.salary?.paymentMode} />

                {(employee.salary?.basic || employee.salary?.allowances || employee.salary?.deductions) && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                    <SectionTitle>Salary</SectionTitle>
                    <DetailRow label="Salary Type"  value={employee.salary?.salaryType} />
                    <DetailRow label="Basic"        value={employee.salary?.basic ? '₹' + employee.salary.basic.toLocaleString('en-IN') : null} />
                    <DetailRow label="Allowances"   value={employee.salary?.allowances ? '₹' + employee.salary.allowances.toLocaleString('en-IN') : null} />
                    <DetailRow label="Deductions"   value={employee.salary?.deductions ? '₹' + employee.salary.deductions.toLocaleString('en-IN') : null} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', marginTop: 8, background: '#eff6ff', borderRadius: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Net Salary</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{((employee.salary?.basic || 0) + (employee.salary?.allowances || 0) - (employee.salary?.deductions || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Photo zoom overlay */}
      {zoomImage && employee.photo && (
        <div onClick={() => setZoomImage(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={employee.photo} alt={employee.name} onClick={e => e.stopPropagation()} style={{ width: 320, height: 320, objectFit: 'cover', borderRadius: '50%', border: '4px solid white', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', cursor: 'default' }} />
        </div>
      )}
    </div>
  );
}

function EmployeeAttendanceTab({ employee }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: summaryData } = useQuery({
    queryKey: ['emp-att-summary', employee._id],
    queryFn: () => api.get(`/attendance/employee-summary?employeeId=${employee._id}`),
  });

  const { data: recordsData, isLoading } = useQuery({
    queryKey: ['emp-att-records', employee._id, month, year],
    queryFn: () => api.get(`/attendance/employee-records?employeeId=${employee._id}&month=${month}&year=${year}`),
  });

  const summary = summaryData?.summary || {};
  const records = recordsData?.records || [];

  const dateMap = {};
  records.forEach(r => {
    const d = new Date(r.date);
    dateMap[`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`] = r.status;
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Days',  value: summary.total ?? '—',      color: 'var(--primary)', bg: '#eff6ff' },
          { label: 'Present',     value: summary.present ?? '—',    color: '#065f46',        bg: '#d1fae5' },
          { label: 'Absent',      value: summary.absent ?? '—',     color: '#991b1b',        bg: '#fee2e2' },
          { label: 'Late',        value: summary.late ?? '—',       color: '#92400e',        bg: '#fef3c7' },
          { label: 'Attendance %',value: summary.percentage != null ? `${summary.percentage}%` : '—', color: 'var(--primary)', bg: '#eff6ff' },
        ].map(s => (
          <div key={s.label} style={{ flex: '1 1 100px', background: s.bg, borderRadius: 10, padding: '12px 16px', minWidth: 90 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={prevMonth}><ChevronLeft size={15} /></button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 150, textAlign: 'center' }}>{ATT_MONTH_NAMES[month - 1]} {year}</span>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={nextMonth}><ChevronRight size={15} /></button>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16, maxWidth: 420 }}>
        {ATT_DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const status = dateMap[`${year}-${month}-${day}`];
          const meta = status ? EMP_STATUS_META[status] : null;
          return (
            <div key={day} style={{
              aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, fontSize: 13, fontWeight: meta ? 600 : 400,
              background: meta ? meta.bg : 'transparent',
              color: meta ? meta.color : 'var(--text-muted)',
            }}>
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {Object.entries(EMP_STATUS_META).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1px solid ${v.color}44` }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Records table */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading records…</p>
      ) : records.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No attendance records for this month.</p>
      ) : (
        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date','Status','Marked By','Remarks'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const meta = EMP_STATUS_META[r.status] || { label: r.status, bg: '#f1f5f9', color: '#334155' };
                return (
                  <tr key={r._id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.markedBy?.name || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.remarks || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

