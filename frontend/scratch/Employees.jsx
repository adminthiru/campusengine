import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Plus, Download, Eye, Trash2, Users, ClipboardList, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Modal, ConfirmDialog, StatusBadge, Pagination, SearchInput, Avatar, EmptyState, PageLoader, FormRow, ColumnSelector, useColumnSelector } from '../../components/ui';

const EMPLOYEE_COLS = [
  { key: 'employeeId',  label: 'Employee ID' },
  { key: 'role',        label: 'Role' },
  { key: 'department',  label: 'Department' },
  { key: 'phone',       label: 'Phone' },
  { key: 'status',      label: 'Status' },
];

const FORM_TABS = [
  { key: 'personal',   label: 'Personal' },
  { key: 'work',       label: 'Work' },
  { key: 'academics',  label: 'Academics' },
  { key: 'experience', label: 'Experience' },
  { key: 'emergency',  label: 'Emergency' },
  { key: 'documents',  label: 'Documents' },
  { key: 'salary',     label: 'Salary' },
  { key: 'bank',       label: 'Bank' },
];

export default function Employees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [tasksEmployee, setTasksEmployee] = useState(null);

  // Form states
  const [formTab, setFormTab] = useState('personal');
  const [employeeStatus, setEmployeeStatus] = useState('active');
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
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee added! Login credentials sent.'); closeModal(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
    onSuccess: (res) => { qc.invalidateQueries(['employees']); toast.success('Employee updated!'); setViewEmployee(res.employee || res); closeModal(); },
    onError: (err) => toast.error(err.message || 'Failed to update employee')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee deactivated'); setDeleteId(null); }
  });

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
      // Mapping fields if needed for backward compatibility
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{total} staff members</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, employee ID..." />
        <select className="form-control" style={{ width: 'auto' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <ColumnSelector storageKey="employees" cols={EMPLOYEE_COLS} visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  {col('employeeId')  && <th>Employee ID</th>}
                  {col('role')        && <th>Role</th>}
                  {col('department')  && <th>Department</th>}
                  {col('phone')       && <th>Phone</th>}
                  {col('status')      && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={1 + EMPLOYEE_COLS.filter(c => visibleCols.has(c.key)).length}>
                    <EmptyState icon={Users} message="No employees yet. Add your first staff member!" action={<button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Employee</button>} />
                  </td></tr>
                )}
                {employees.map(emp => (
                  <tr key={emp._id} onClick={() => setViewEmployee(emp)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={emp.photo} name={emp.name} size={34} />
                        <div>
                          <div className="text-14-semibold">{emp.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    {col('employeeId')  && <td><span className="badge badge-secondary">{emp.employeeId}</span></td>}
                    {col('role')        && <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{emp.role}</span></td>}
                    {col('department')  && <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{emp.department || '—'}</td>}
                    {col('phone')       && <td style={{ fontSize: 13 }}>{emp.phone || emp.mobile}</td>}
                    {col('status')      && <td><StatusBadge status={emp.status} /></td>}
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
        roles={roles}
      />

      {/* View Modal */}
      {viewEmployee && (
        <Modal open onClose={() => setViewEmployee(null)} title="Employee Details" size="lg"
          footer={
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
              <button className="btn btn-danger btn-sm" onClick={() => { setDeleteId(viewEmployee._id); setViewEmployee(null); }}>
                <Trash2 size={14} /> Delete
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewEmployee?.role === 'maintenance' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => { setTasksEmployee(viewEmployee); setViewEmployee(null); }}>
                    <ClipboardList size={14} /> Tasks
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => downloadJobOffer(viewEmployee._id)}>
                  <Download size={14} /> Job Offer
                </button>
              </div>
            </div>
          }>
          <div className="grid-2">
            <div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <Avatar src={viewEmployee.photo} name={viewEmployee.name} size={64} />
                <div>
                  <h3 className="text-18-bold">{viewEmployee.name}</h3>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2, textTransform: 'capitalize' }}>{viewEmployee.role} · {viewEmployee.department}</div>
                  <span className="badge badge-secondary" style={{ marginTop: 6 }}>{viewEmployee.employeeId}</span>
                </div>
              </div>
              {[
                { label: 'Email', value: viewEmployee.email },
                { label: 'Phone', value: viewEmployee.phone || viewEmployee.mobile },
                { label: 'Designation', value: viewEmployee.designation },
                { label: 'Date of Joining', value: viewEmployee.dateOfJoining ? new Date(viewEmployee.dateOfJoining).toLocaleDateString('en-IN') : '—' },
                { label: 'Blood Group', value: viewEmployee.bloodGroup },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-14-medium">{value || '—'}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-14-bold" style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>SALARY DETAILS</h4>
              {[
                { label: 'Basic', value: viewEmployee.salary?.basic },
                { label: 'HRA', value: viewEmployee.salary?.hra },
                { label: 'DA', value: viewEmployee.salary?.da },
                { label: 'Other Allowances', value: viewEmployee.salary?.otherAllowances },
                { label: 'PF Deduction', value: viewEmployee.salary?.pfDeduction },
                { label: 'ESI Deduction', value: viewEmployee.salary?.esiDeduction },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-14-medium">₹{(value || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4, background: '#eff6ff', borderRadius: 8, paddingLeft: 12, paddingRight: 12 }}>
                <span className="text-14-bold">Gross Salary</span>
                <span className="text-14-bold" style={{ color: 'var(--primary)' }}>
                  ₹{((viewEmployee.salary?.basic || 0) + (viewEmployee.salary?.hra || 0) + (viewEmployee.salary?.da || 0) + (viewEmployee.salary?.otherAllowances || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Deactivate Employee" message="This will deactivate the employee and their portal access."
        danger
      />
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
  emergency, setEmergency, documents, setDocuments, roles
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

  return (
    <Modal open={open} onClose={onClose} title={editEmployee ? 'Edit Employee' : 'Add New Employee'} size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => tabIdx > 0 ? setFormTab(FORM_TABS[tabIdx - 1].key) : onClose()}>
            {tabIdx > 0 ? <><ChevronLeft size={15} /> Previous</> : 'Cancel'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tabIdx < FORM_TABS.length - 1 && (
              <button className="btn btn-secondary" onClick={() => setFormTab(FORM_TABS[tabIdx + 1].key)}>
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
            <button key={tab.key} type="button" onClick={() => setFormTab(tab.key)}
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
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
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

        {/* Tab 7: Salary */}
        {formTab === 'salary' && (
          <>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Salary Type</label>
                <select className="form-control" {...register('salary.salaryType')}>
                  <option value="">Select type</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Contractual">Contractual</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-control" {...register('salary.paymentMode')}>
                  <option value="">Select mode</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Basic Salary (₹)</label>
                <input className="form-control" type="number" {...register('salary.basic')} defaultValue={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Allowances (₹)</label>
                <input className="form-control" type="number" {...register('salary.allowances')} defaultValue={0} />
              </div>
            </FormRow>
            <div className="form-group" style={{ maxWidth: '50%' }}>
              <label className="form-label">Deductions (₹)</label>
              <input className="form-control" type="number" {...register('salary.deductions')} defaultValue={0} />
            </div>
          </>
        )}

        {/* Tab 8: Bank */}
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
