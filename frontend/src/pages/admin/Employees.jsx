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
  { key: 'salaryType', label: 'Salary Type', default: false },
  { key: 'basicSalary', label: 'Basic Salary', default: false },
  { key: 'paymentMode', label: 'Payment Mode', default: false },
  { key: 'bankName', label: 'Bank Name', default: false },
  { key: 'accountNumber', label: 'Account Number', default: false },
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
  { key: 'personal', label: 'Personal & Contact' },
  { key: 'work', label: 'Work & Experience' },
  { key: 'financial', label: 'Salary & Bank' },
  { key: 'documents', label: 'Documents' },
];

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
  const [sendInvite, setSendInvite] = useState(true);
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
      if (res.emailSent === true) toast.success('Employee added! Login credentials emailed successfully.');
      else if (res.emailSent === false && sendInvite) { toast.success('Employee added!'); toast.error('Invitation email failed — check Gmail App Password in server .env', { duration: 7000 }); }
      else toast.success('Employee added!');
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
    onSuccess: (res) => {
      qc.invalidateQueries(['employees']);
      if (res.emailSent === true) toast.success('Employee updated! Login credentials resent successfully.');
      else if (res.emailSent === false && sendInvite) { toast.success('Employee updated!'); toast.error('Invite email failed — check Gmail App Password in server .env', { duration: 7000 }); }
      else toast.success('Employee updated!');
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
    setSendInvite(false);

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
    setSendInvite(true);
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
      sendInvite,
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
          roles={roles} sendInvite={sendInvite} setSendInvite={setSendInvite}
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
                  {col('salaryType') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Salary Type</th>}
                  {col('basicSalary') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Basic Salary</th>}
                  {col('paymentMode') && <th style={{ whiteSpace: 'nowrap', minWidth: 120 }}>Payment Mode</th>}
                  {col('bankName') && <th style={{ whiteSpace: 'nowrap', minWidth: 150 }}>Bank Name</th>}
                  {col('accountNumber') && <th style={{ whiteSpace: 'nowrap', minWidth: 150 }}>Account Number</th>}
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
                    {col('salaryType') && <td style={{ fontSize: 13 }}>{emp.salary?.salaryType || '—'}</td>}
                    {col('basicSalary') && <td style={{ fontSize: 13 }}>{emp.salary?.basic ? `₹${emp.salary.basic.toLocaleString('en-IN')}` : '—'}</td>}
                    {col('paymentMode') && <td style={{ fontSize: 13 }}>{emp.salary?.paymentMode || '—'}</td>}
                    {col('bankName') && <td style={{ fontSize: 13 }}>{emp.bank?.bankName || '—'}</td>}
                    {col('accountNumber') && <td style={{ fontSize: 13 }}>{emp.bank?.accountNumber || '—'}</td>}
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
        roles={roles} sendInvite={sendInvite} setSendInvite={setSendInvite}
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
  sendInvite, setSendInvite, onResend, isResending
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
    reader.onload = ev => setProfilePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDocumentChange = (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => tabIdx > 0 ? setFormTab(FORM_TABS[tabIdx - 1].key) : onClose()}>
              {tabIdx > 0 ? <><ChevronLeft size={15} /> Previous</> : 'Cancel'}
            </button>
            {editEmployee && (
              <button type="button" className="btn btn-secondary" onClick={onResend} disabled={isResending}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isResending ? 'Sending...' : '↺ Resend Credentials'}
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setSendInvite(v => !v)}>
                  <div style={{
                    width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                    background: sendInvite ? 'var(--primary)' : '#cbd5e1',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: sendInvite ? 20 : 2,
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Send login credentials to this email</span>
                </label>
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
    </Modal>
  );
}

// ── Employee Detail Page ───────────────────────────────────────────────────────
function EmployeeDetail({ employee, onBack, onDelete, onDownload, onEdit, onTasks }) {
  const [activeTab, setActiveTab] = useState('personal');
  const [zoomImage, setZoomImage] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="page-title">Employee Details</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {employee.role === 'maintenance' && (
            <button className="btn btn-secondary" onClick={() => onTasks(employee)}><ClipboardList size={15} /> Tasks</button>
          )}
          <button className="btn btn-secondary" onClick={() => onEdit(employee)}><Edit size={15} /> Edit</button>
          <button className="btn btn-secondary" onClick={() => onDownload(employee._id)}><Download size={15} /> Job Offer</button>
          <button className="btn btn-danger" onClick={() => onDelete(employee._id)}><Trash2 size={15} /> Delete</button>
        </div>
      </div>

      {/* Profile card */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div onClick={() => employee.photo && setZoomImage(true)} style={{ cursor: employee.photo ? 'zoom-in' : 'default' }}>
            <Avatar src={employee.photo} name={employee.name} size={80} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 className="text-24-bold">{employee.name}</h2>
              {employee.employeeId && <span className="badge badge-info">{employee.employeeId}</span>}
              <StatusBadge status={employee.status} />
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {employee.role && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)', textTransform: 'capitalize' }}><Briefcase size={14} /> {employee.role}</span>}
              {employee.department && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Dept: {employee.department}</span>}
              {employee.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)' }}><Phone size={14} /> {employee.phone || employee.mobile}</span>}
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
                <DetailRow label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB') : null} />
                <DetailRow label="Gender" value={employee.gender} capitalize />
                <DetailRow label="Blood Group" value={employee.bloodGroup} />
              </div>
              <div>
                <SectionTitle>Contact & Address</SectionTitle>
                {employee.email && <ContactItem icon={Mail} value={employee.email} />}
                {(employee.phone || employee.mobile) && <ContactItem icon={Phone} value={employee.phone || employee.mobile} />}
                {employee.address && <ContactItem icon={MapPin} value={employee.address} />}
                {employee.city && <DetailRow label="City" value={employee.city} />}
                {employee.state && <DetailRow label="State" value={employee.state} />}
                {employee.country && <DetailRow label="Country" value={employee.country} />}
              </div>
              <div>
                <SectionTitle>Emergency Contacts</SectionTitle>
                {employee.emergencyContacts?.length > 0 ? employee.emergencyContacts.map((contact, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{contact.name} ({contact.relationship})</div>
                    <ContactItem icon={Phone} value={contact.contactNumber} />
                    {contact.alternateContactNumber && <ContactItem icon={Phone} value={contact.alternateContactNumber + ' (Alt)'} />}
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No emergency contacts added.</p>}
              </div>
            </div>
          )}

          {/* Work tab */}
          {activeTab === 'work' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Employment Details</SectionTitle>
                <DetailRow label="Employee ID" value={employee.employeeId} />
                <DetailRow label="Designation" value={employee.designation} />
                <DetailRow label="Department" value={employee.department} />
                <DetailRow label="Employment Type" value={employee.employmentType} />
                <DetailRow label="Date of Joining" value={employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString('en-GB') : null} />
                <DetailRow label="Work Location" value={employee.workLocation} />
              </div>
              <div>
                <SectionTitle>Academics</SectionTitle>
                {employee.academics?.length > 0 ? employee.academics.map((acad, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{acad.qualification} in {acad.fieldOfStudy}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acad.institutionName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acad.startYear} - {acad.endYear} • Grade: {acad.grade}</div>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No academics added.</p>}
              </div>
              <div>
                <SectionTitle>Experience</SectionTitle>
                {employee.experience?.length > 0 ? employee.experience.map((exp, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{exp.designation}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.organizationName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-GB') : ''} to {exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-GB') : ''}</div>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No experience added.</p>}
              </div>
            </div>
          )}

          {/* Financial tab */}
          {activeTab === 'financial' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <SectionTitle>Salary Details</SectionTitle>
                <DetailRow label="Salary Type" value={employee.salary?.salaryType} />
                <DetailRow label="Basic Salary" value={employee.salary?.basic ? '₹' + employee.salary.basic.toLocaleString('en-IN') : null} />
                <DetailRow label="Allowances" value={employee.salary?.allowances ? '₹' + employee.salary.allowances.toLocaleString('en-IN') : null} />
                <DetailRow label="Deductions" value={employee.salary?.deductions ? '₹' + employee.salary.deductions.toLocaleString('en-IN') : null} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4, background: '#eff6ff', borderRadius: 8, paddingLeft: 12, paddingRight: 12 }}>
                  <span className="text-14-bold">Net Salary</span>
                  <span className="text-14-bold" style={{ color: 'var(--primary)' }}>
                    ₹{((employee.salary?.basic || 0) + (employee.salary?.allowances || 0) - (employee.salary?.deductions || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <div>
                <SectionTitle>Bank Information</SectionTitle>
                <DetailRow label="Payment Mode" value={employee.salary?.paymentMode} />
                <DetailRow label="Bank Name" value={employee.bank?.bankName} />
                <DetailRow label="Account Holder" value={employee.bank?.accountHolderName} />
                <DetailRow label="Account Number" value={employee.bank?.accountNumber} />
                <DetailRow label="IFSC Code" value={employee.bank?.ifscCode} />
                <DetailRow label="Branch Name" value={employee.bank?.branchName} />
                <DetailRow label="UPI ID" value={employee.bank?.upiId} />
              </div>
            </div>
          )}

          {/* Documents tab */}
          {activeTab === 'documents' && (
            <div>
              <SectionTitle>Uploaded Documents</SectionTitle>
              {employee.documents?.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {employee.documents.map((doc, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{doc.documentType}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{doc.fileName || 'Uploaded file'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No documents uploaded.</p>}
            </div>
          )}
        </div>
      </div>
      {zoomImage && employee.photo && (
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
            src={employee.photo} 
            alt={employee.name} 
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

