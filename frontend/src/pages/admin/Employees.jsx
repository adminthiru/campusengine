import { useState, useRef, useEffect } from 'react';
import { useYear } from '../../store/YearContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { Select, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { Plus, Download, Eye, Trash2, Users, ClipboardList, ChevronLeft, ChevronRight, Camera, Edit, ArrowLeft, Mail, MapPin, Briefcase, Phone, BookOpen, User as UserIcon, FileText, Upload, Banknote, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import { usePermissions } from '../../store/usePermissions';
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
  { key: 'salary',     label: 'Salary' },
  { key: 'timetable',  label: 'Timetable' },
];

const TT_DAY_ORDER  = ['monday','tuesday','wednesday','thursday','friday','saturday'];
const TT_DAY_LABELS = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };
const TT_DAY_SHORT  = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };

const SAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const EMP_STATUS_META = {
  present:  { label: 'P',  full: 'Present',      color: '#10b981', bg: '#dcfce7' },
  absent:   { label: 'A',  full: 'Absent',       color: '#ef4444', bg: '#fee2e2' },
  late:     { label: 'L',  full: 'Late',          color: '#f59e0b', bg: '#fef3c7' },
  excused:  { label: 'E',  full: 'Excused',      color: '#6366f1', bg: '#ede9fe' },
  half_day: { label: 'H',  full: 'Half Day',     color: '#8b5cf6', bg: '#f3e8ff' },
  od:       { label: 'OD', full: 'On Duty',      color: '#0891b2', bg: '#cffafe' },
  cl:       { label: 'CL', full: 'Casual Leave', color: '#0284c7', bg: '#dbeafe' },
  sl:       { label: 'SL', full: 'Sick Leave',   color: '#7c3aed', bg: '#ede9fe' },
};

const ATT_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ATT_DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function AttendanceCircle({ percentage, present, total }) {
  const size = 80, r = 32, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (percentage / 100) * circumference;
  const color = percentage >= 75 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, marginLeft: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{present}/{total}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
              strokeDasharray={`${filled} ${circumference - filled}`} strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color }}>{percentage}%</span>
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Attendance</span>
      </div>
    </div>
  );
}

export default function Employees() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();
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
  // Plan usage cap (0 = unlimited). Hard-block Add once reached; backend enforces too.
  const staffCap = user?.subscription?.limits?.maxStaff || 0;
  const atStaffCap = staffCap > 0 && total >= staffCap;
  const pages = data?.pages || 1;

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm();

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/employees', d),
    onSuccess: () => {
      qc.invalidateQueries(['employees']);
      toast.success('Employee added!');
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['employees']);
      toast.success('Employee updated!');
      closeModal();   // stay on the list (don't jump to the detail screen)
    },
    onError: (err) => toast.error(err.message || 'Failed to update employee')
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
    if (!payload.employeeId || !payload.employeeId.trim()) delete payload.employeeId;   // blank → server auto-generates

    if (editEmployee) {
      updateMutation.mutate({ id: editEmployee._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;
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
          control={control} setValue={setValue} employeeStatus={employeeStatus} setEmployeeStatus={setEmployeeStatus}
          profilePreview={profilePreview} setProfilePreview={setProfilePreview} imgInputRef={imgInputRef}
          academics={academics} setAcademics={setAcademics} experience={experience} setExperience={setExperience}
          emergency={emergency} setEmergency={setEmergency} documents={documents} setDocuments={setDocuments}
          roles={roles}
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
        {can('employees', 'add') && (
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Upload size={16} /> Bulk Upload
          </button>
        )}
        {can('employees', 'add') && (atStaffCap ? (
          <a href="/subscription" className="btn btn-secondary" title={`Plan limit reached (${total}/${staffCap})`} style={{ textDecoration: 'none' }}>
            <Plus size={16} /> {total}/{staffCap} — Upgrade to add more
          </a>
        ) : (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Employee
          </button>
        ))}
        </div>
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, employee ID..." />
        <Select
          style={{ minWidth: 140 }}
          value={roleFilter || undefined}
          placeholder="All Roles"
          allowClear
          onChange={val => setRoleFilter(val ?? '')}
          options={roles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
        />
        {selected.length > 0 && can('employees', 'delete') && (
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
                    <EmptyState icon={Users} message="No employees yet. Add your first staff member!" action={can('employees', 'add') ? <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Employee</button> : undefined} />
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
                      {can('employees', 'edit') && (
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(emp)}>
                          <Edit size={15} />
                        </button>
                      )}
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
        roles={roles}
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
  control, setValue, employeeStatus, setEmployeeStatus,
  profilePreview, setProfilePreview, imgInputRef,
  academics, setAcademics, experience, setExperience,
  emergency, setEmergency, documents, setDocuments, roles,
}) {
  const watched = useWatch({
    control,
    name: ['firstName', 'lastName', 'email', 'phone', 'role', 'employeeId']
  });

  // Checking if core fields are present (employee ID auto-generates, so it's optional)
  const isFormReady = watched[0] && watched[1] && watched[2] && watched[3] && watched[4];

  // Staff Employee ID auto-generates; an edit toggle unlocks manual entry.
  const [editEmpId, setEditEmpId] = useState(false);
  useEffect(() => { setEditEmpId(false); }, [open, editEmployee]);
  // Add mode: preview EMP<DOJ year><seq>, recomputed when Date of Joining changes.
  const wDoj = useWatch({ control, name: 'dateOfJoining' });
  useEffect(() => {
    if (editEmployee || !open) return;
    const t = setTimeout(() => {
      const q = wDoj ? `?doj=${encodeURIComponent(wDoj)}` : '';
      api.get(`/employees/next-code${q}`).then(r => { if (!editEmpId) setValue('employeeId', r.employeeId || ''); }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [open, editEmployee, wDoj]);

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
      // Employee ID auto-generates, so it isn't required here.
      const req = [
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
              {isMutating
                ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving…</>
                : editEmployee ? 'Update Employee' : 'Add Employee'}
            </button>
          </div>
        </div>
      }
    >
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
                <input className="form-control" type="tel" maxLength={10} {...register('phone', { required: 'Required', pattern: { value: /^[0-9]{10}$/, message: 'Enter valid 10-digit number' } })} placeholder="9876543210" onInput={e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }} />
                {errors.phone && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <Controller name="gender" control={control}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select gender" allowClear
                      options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]}
                    />
                  )}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <Controller name="dateOfBirth" control={control}
                  render={({ field }) => (
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Select date of birth"
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                      disabledDate={(d) => d && d > dayjs().endOf('day')}
                      getPopupContainer={() => document.body}
                    />
                  )}
                />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <Controller name="bloodGroup" control={control}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select blood group" allowClear
                      options={['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => ({ value: bg, label: bg }))}
                    />
                  )}
                />
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
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Staff Employee ID
                  {!editEmpId && <span style={{ fontSize: 10, fontWeight: 700, color: '#1a56e8', background: '#eff6ff', padding: '1px 7px', borderRadius: 6 }}>AUTO</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" {...register('employeeId')} readOnly={!editEmpId}
                    placeholder={editEmployee ? '' : 'Auto-generated on save'}
                    style={{ background: editEmpId ? '#fff' : '#f8fafc', flex: 1 }} />
                  <button type="button" className="btn btn-secondary btn-icon" title={editEmpId ? 'Lock' : 'Edit'} onClick={() => setEditEmpId(e => !e)}>
                    {editEmpId ? <Lock size={15} /> : <Edit size={15} />}
                  </button>
                </div>
                <small style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {editEmpId ? 'Custom employee ID.' : 'Generated automatically — click edit to override.'}
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Role <span style={{ color: '#ef4444' }}>*</span></label>
                <Controller name="role" control={control} rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select role" showSearch
                      status={errors.role ? 'error' : ''}
                      options={roles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                    />
                  )}
                />
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
                <Controller name="employmentType" control={control}
                  render={({ field }) => (
                    <Select {...field} style={{ width: '100%' }} placeholder="Select type" allowClear
                      options={[
                        { value: 'Full-time', label: 'Full-time' },
                        { value: 'Part-time', label: 'Part-time' },
                        { value: 'Contract', label: 'Contract' },
                        { value: 'Intern', label: 'Intern' },
                      ]}
                    />
                  )}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Joining</label>
                <Controller name="dateOfJoining" control={control}
                  render={({ field }) => (
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Select date of joining"
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                      getPopupContainer={() => document.body}
                    />
                  )}
                />
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
                    <Select
                      style={{ width: '100%' }} placeholder="Select type" allowClear
                      value={entry.employmentType || undefined}
                      onChange={v => setExperience(a => a.map((x, i) => i === idx ? { ...x, employmentType: v || '' } : x))}
                      options={[
                        { value: 'Full-time', label: 'Full-time' },
                        { value: 'Part-time', label: 'Part-time' },
                        { value: 'Contract', label: 'Contract' },
                        { value: 'Intern', label: 'Intern' },
                      ]}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Skills Used</label>
                    <input className="form-control" value={entry.skillsUsed || ''} onChange={e => setExperience(a => a.map((x, i) => i === idx ? { ...x, skillsUsed: e.target.value } : x))} />
                  </div>
                </FormRow>
                <FormRow>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="Start date"
                      value={entry.startDate ? dayjs(entry.startDate) : null}
                      onChange={(d) => setExperience(a => a.map((x, i) => i === idx ? { ...x, startDate: d ? d.format('YYYY-MM-DD') : '' } : x))}
                      getPopupContainer={() => document.body}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <DatePicker
                      style={{ width: '100%' }}
                      format="DD MMM YYYY"
                      placeholder="End date"
                      value={entry.endDate ? dayjs(entry.endDate) : null}
                      onChange={(d) => setExperience(a => a.map((x, i) => i === idx ? { ...x, endDate: d ? d.format('YYYY-MM-DD') : '' } : x))}
                      getPopupContainer={() => document.body}
                    />
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
                    <Select
                      style={{ width: '100%' }} placeholder="Select type" allowClear
                      value={entry.documentType || undefined}
                      onChange={v => setDocuments(a => a.map((x, i) => i === idx ? { ...x, documentType: v || '' } : x))}
                      options={[
                        { value: 'Aadhaar Card',       label: 'Aadhaar Card' },
                        { value: 'PAN Card',           label: 'PAN Card' },
                        { value: 'Resume',             label: 'Resume' },
                        { value: 'Certificates',       label: 'Certificates' },
                        { value: 'Experience Letter',  label: 'Experience Letter' },
                        { value: 'Other Documents',    label: 'Other Documents' },
                      ]}
                    />
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
    </Modal>
  );
}

// ── Employee Detail Page ───────────────────────────────────────────────────────
function EmployeeDetail({ employee, onBack, onDelete, onDownload, onEdit, onTasks }) {
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState('personal');
  const [zoomImage, setZoomImage] = useState(false);
  const { selectedYear, startMonth, isCurrent } = useYear();

  // Widget shows only a single month (same logic as student detail):
  // current year → today's month/year; past/future → first month of that AY.
  const now = new Date();
  const attMonth = isCurrent ? (now.getMonth() + 1) : startMonth;
  const attYear  = parseInt(selectedYear);

  const { data: attSummaryRes } = useQuery({
    queryKey: ['emp-att-summary-header', employee._id, selectedYear],
    queryFn: () => api.get(`/attendance/employee-summary?employeeId=${employee._id}&month=${attMonth}&year=${attYear}`),
    enabled: !!employee._id,
  });
  const attSummary = attSummaryRes?.summary || null;

  const { data: classesRes } = useQuery({
    queryKey: ['classes-for-emp', employee._id],
    queryFn: () => api.get('/classes'),
    enabled: !!employee._id,
  });
  const allClasses = classesRes?.classes || [];
  const classTeacherOf = allClasses.filter(cls => {
    const ct = cls.classTeacher?._id?.toString() || cls.classTeacher?.toString();
    return ct === employee._id.toString();
  });
  const subjectTeacherOf = [];
  allClasses.forEach(cls => {
    (cls.subjectTeachers || []).forEach(st => {
      const tid = st.teacher?._id?.toString() || st.teacher?.toString();
      if (tid === employee._id.toString()) {
        subjectTeacherOf.push({
          subject: st.subject?.name || '',
          cls: `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`,
        });
      }
    });
  });

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
          {employee.role === 'maintenance' && can('employees', 'edit') && (
            <button className="btn btn-secondary btn-sm" onClick={() => onTasks(employee)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={14} /> Tasks
            </button>
          )}
          {can('employees', 'edit') && (
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(employee)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit size={14} /> Edit
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => onDownload(employee._id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Job Offer
          </button>
          {can('employees', 'delete') && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(employee._id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} /> Delete
            </button>
          )}
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
          {attSummary && attSummary.total > 0 && (
            <AttendanceCircle percentage={attSummary.percentage} present={attSummary.present} total={attSummary.total} />
          )}
        </div>
        {(classTeacherOf.length > 0 || subjectTeacherOf.length > 0) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {classTeacherOf.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Class Teacher:</span>
                {classTeacherOf.map(cls => (
                  <span key={cls._id} style={{ fontSize: 12, background: '#eff6ff', color: '#1a56e8', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                    {cls.name}{cls.section ? ` - ${cls.section}` : ''}
                  </span>
                ))}
              </div>
            )}
            {subjectTeacherOf.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Subject Teacher:</span>
                {subjectTeacherOf.map((item, i) => (
                  <span key={i} style={{ fontSize: 12, background: '#f0fdf4', color: '#059669', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                    {item.subject}{item.subject && item.cls ? ' · ' : ''}{item.cls}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
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

          {/* ── Tab 5: Salary ── */}
          {activeTab === 'salary' && <EmployeeSalaryTab employee={employee} />}

          {/* ── Tab 6: Timetable ── */}
          {activeTab === 'timetable' && <EmployeeTimetableTab employee={employee} />}

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

function EmployeeTimetableTab({ employee }) {
  const { data, isLoading } = useQuery({
    queryKey: ['emp-timetable', employee._id],
    queryFn:  () => api.get(`/timetable?teacherId=${employee._id}`),
    enabled:  !!employee._id,
  });
  const timetables = data?.timetables || [];

  // Build cellMap: "day_period" → { class, subject, time, room }
  const cellMap = {};
  let maxPeriod = 0;
  const activeDaysSet = new Set();

  timetables.forEach(tt => {
    tt.schedule.forEach(ds => {
      activeDaysSet.add(ds.day);
      ds.periods.forEach(p => {
        if (p.periodNumber > maxPeriod) maxPeriod = p.periodNumber;
        cellMap[`${ds.day}_${p.periodNumber}`] = {
          class:   tt.class,
          subject: p.subject,
          room:    p.room,
          time:    (p.startTime && p.endTime) ? `${p.startTime}–${p.endTime}` : null,
        };
      });
    });
  });

  const activeDays = TT_DAY_ORDER.filter(d => activeDaysSet.has(d));
  const periods    = maxPeriod > 0 ? Array.from({ length: maxPeriod }, (_, i) => i + 1) : [];

  // Build period → time map from first occurrence found
  const periodTimeMap = {};
  periods.forEach(p => {
    for (const d of activeDays) {
      const cell = cellMap[`${d}_${p}`];
      if (cell?.time) { periodTimeMap[p] = cell.time; break; }
    }
  });

  // Summary counts
  const totalPeriods = Object.keys(cellMap).length;
  const uniqueClasses = new Set(Object.values(cellMap).map(c => c.class?._id)).size;
  const uniqueSubjects = new Set(Object.values(cellMap).map(c => c.subject?._id)).size;

  if (isLoading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

  if (timetables.length === 0) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
      <BookOpen size={36} style={{ marginBottom: 8, opacity: 0.3 }} />
      <p style={{ fontSize: 14 }}>No timetable assigned to this teacher yet.</p>
    </div>
  );

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Periods / Week', value: totalPeriods,   color: 'var(--primary)', bg: '#eff6ff' },
          { label: 'Classes',        value: uniqueClasses,  color: '#10b981',        bg: '#f0fdf4' },
          { label: 'Subjects',       value: uniqueSubjects, color: '#f59e0b',        bg: '#fffbeb' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Week grid — days as rows, periods as columns */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header row — period numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${periods.length}, 1fr)`, background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '10px 12px' }} />
          {periods.map(p => (
            <div key={p} style={{ padding: '8px 8px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>P{p}</div>
              {periodTimeMap[p] && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{periodTimeMap[p]}</div>
              )}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {activeDays.map((d, di) => (
          <div key={d} style={{ display: 'grid', gridTemplateColumns: `100px repeat(${periods.length}, 1fr)`, borderBottom: di < activeDays.length - 1 ? '1px solid #f1f5f9' : 'none', minHeight: 72 }}>
            {/* Day label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRight: '1px solid var(--border)', padding: '8px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{TT_DAY_SHORT[d]}</span>
            </div>
            {/* Period cells */}
            {periods.map(p => {
              const cell = cellMap[`${d}_${p}`];
              const subjectColor = cell?.subject?.color || '#1a56e8';
              return (
                <div key={p} style={{ padding: 6, borderLeft: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>
                  {cell ? (
                    <div style={{
                      width: '100%', borderRadius: 8, padding: '8px 10px',
                      background: `${subjectColor}18`,
                      borderLeft: `3px solid ${subjectColor}`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {cell.class?.name}{cell.class?.section ? ` ${cell.class.section}` : ''}
                      </div>
                      {cell.subject?.name && (
                        <div style={{ fontSize: 12, color: subjectColor, fontWeight: 600 }}>{cell.subject.name}</div>
                      )}
                      {cell.room && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Room: {cell.room}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 44, borderRadius: 6, background: '#f8fafc' }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* List view — per class breakdown */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Class-wise Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timetables.map(tt => {
            const classPeriods = [];
            tt.schedule.forEach(ds => {
              ds.periods.forEach(p => {
                classPeriods.push({ day: ds.day, period: p });
              });
            });
            if (classPeriods.length === 0) return null;
            const subjectColor = classPeriods[0]?.period?.subject?.color || '#1a56e8';
            return (
              <div key={tt._id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Class header */}
                <div style={{ background: `${subjectColor}12`, padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    {tt.class?.name}{tt.class?.section ? ` — Section ${tt.class.section}` : ''}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {classPeriods.length} period{classPeriods.length !== 1 ? 's' : ''} / week
                  </span>
                </div>
                {/* Period rows */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
                  {classPeriods.map(({ day, period: p }, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 8, padding: '6px 12px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 28 }}>{TT_DAY_SHORT[day]}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>P{p.periodNumber}</span>
                      {p.subject?.name && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: subjectColor, padding: '1px 8px', background: `${subjectColor}18`, borderRadius: 12 }}>{p.subject.name}</span>
                      )}
                      {p.startTime && p.endTime && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.startTime}–{p.endTime}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmployeeSalaryTab({ employee }) {
  const [expandedId, setExpandedId] = useState(null);
  const [yearFilter, setYearFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['emp-salaries', employee._id],
    queryFn: () => api.get(`/salaries?employeeId=${employee._id}`),
    enabled: !!employee._id,
  });
  const salaries = data?.salaries || [];

  const downloadPayslip = async (id, slipNumber) => {
    try {
      const res = await fetch(`/api/salaries/${id}/payslip`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payslip_${slipNumber || id}.pdf`; a.click();
    } catch { toast.error('Failed to generate payslip'); }
  };

  const fmt = n => `₹${(n || 0).toLocaleString('en-IN')}`;
  const years = [...new Set(salaries.map(s => s.year))].sort((a, b) => b - a);
  const filtered = yearFilter === 'all' ? salaries : salaries.filter(s => s.year === Number(yearFilter));

  const totalPaid = salaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.netSalary || 0), 0);
  const pendingCount = salaries.filter(s => s.status === 'pending').length;
  const latestNet = salaries[0]?.netSalary || 0;

  if (isLoading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

  if (salaries.length === 0) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
      <Banknote size={36} style={{ marginBottom: 8, opacity: 0.3 }} />
      <p style={{ fontSize: 14 }}>No salary records found for this employee.</p>
    </div>
  );

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Records', value: salaries.length,  color: 'var(--primary)', bg: '#eff6ff' },
          { label: 'Total Paid',    value: fmt(totalPaid),   color: '#10b981',        bg: '#f0fdf4' },
          { label: 'Pending',       value: pendingCount,     color: '#f59e0b',        bg: '#fffbeb' },
          { label: 'Latest Net',    value: fmt(latestNet),   color: 'var(--primary)', bg: '#eff6ff' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Year filter tabs */}
      {years.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['all', ...years].map(y => (
            <button key={y} onClick={() => setYearFilter(y)}
              className="btn btn-sm"
              style={{
                background: yearFilter === String(y) ? 'var(--primary)' : 'transparent',
                color: yearFilter === String(y) ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${yearFilter === String(y) ? 'var(--primary)' : 'var(--border)'}`,
              }}>
              {y === 'all' ? 'All Years' : y}
            </button>
          ))}
        </div>
      )}

      {/* Records list */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) 36px', background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
          {['Month / Year', 'Gross', 'Deductions', 'Net Salary', 'Days', 'Status', ''].map((h, i) => (
            <div key={i} style={{ minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No records for selected year.</div>
        ) : filtered.map((sal, i) => {
          const isExpanded = expandedId === sal._id;
          const e = sal.earnings || {};
          const ded = sal.deductions || {};
          const statusStyle = sal.status === 'paid'
            ? { bg: '#dcfce7', color: '#166534' }
            : sal.status === 'on_hold'
            ? { bg: '#fef3c7', color: '#92400e' }
            : { bg: '#fee2e2', color: '#dc2626' };

          return (
            <div key={sal._id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              {/* Summary row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : sal._id)}
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) 36px',
                  padding: '12px 16px', cursor: 'pointer', alignItems: 'center',
                  background: isExpanded ? '#f8fafc' : 'white', transition: 'background 0.12s',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{SAL_MONTHS[sal.month - 1]} {sal.year}</div>
                  {sal.slipNumber && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sal.slipNumber}</div>}
                </div>
                <div style={{ minWidth: 0, fontSize: 14, fontWeight: 500, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{fmt(sal.grossSalary)}</div>
                <div style={{ minWidth: 0, fontSize: 14, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{fmt(sal.totalDeductions)}</div>
                <div style={{ minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(sal.netSalary)}</div>
                <div style={{ minWidth: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{sal.presentDays ?? '—'}/{sal.workingDays ?? '—'}</div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle.bg, color: statusStyle.color, textTransform: 'capitalize' }}>
                    {sal.status === 'on_hold' ? 'On Hold' : sal.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && (
                <div style={{ padding: '0 16px 16px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 14, marginBottom: 14 }}>

                    {/* Earnings card */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: '#f0fdf4', padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(sal.grossSalary)}</span>
                      </div>
                      {[
                        ['Basic Salary',      e.basic],
                        ['HRA',               e.hra],
                        ['DA',                e.da],
                        ['Other Allowances',  e.otherAllowances],
                        ['Overtime',          e.overtime],
                        ['Bonus',             e.bonus],
                      ].filter(([, v]) => v > 0).map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Deductions card */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: '#fef2f2', padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deductions</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmt(sal.totalDeductions)}</span>
                      </div>
                      {[
                        ['EPF (12%)',      ded.pf],
                        ['ESI (0.75%)',    ded.esi],
                        ['Advance / Loan', ded.loan],
                        ['Loss of Pay',    ded.lossOfPay],
                        ['Tax',            ded.tax],
                        ['Other',          ded.other],
                      ].filter(([, v]) => v > 0).map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                          <span style={{ fontWeight: 500, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
                        </div>
                      ))}
                      {sal.leaveDays > 0 && !(ded.lossOfPay > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>LOP Days</span>
                          <span style={{ fontWeight: 500, color: '#ef4444' }}>{sal.leaveDays} day{sal.leaveDays !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Net + payment + payslip */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary)', borderRadius: 10, padding: '12px 16px' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>Net Salary — {SAL_MONTHS[sal.month - 1]} {sal.year}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums' }}>{fmt(sal.netSalary)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {sal.status === 'paid' && sal.payment && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', textTransform: 'capitalize' }}>
                            Paid via {sal.payment.method?.replace('_', ' ')}
                          </div>
                          {sal.payment.transactionId && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Ref: {sal.payment.transactionId}</div>
                          )}
                          {sal.payment.date && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                              {new Date(sal.payment.date).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={e => { e.stopPropagation(); downloadPayslip(sal._id, sal.slipNumber); }}
                      >
                        <Download size={13} /> Payslip
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmployeeAttendanceTab({ employee }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  // Scope the summary to the selected month so "Total Days" is that month's
  // working days (not the whole academic year).
  const { data: summaryData } = useQuery({
    queryKey: ['emp-att-summary', employee._id, month, year],
    queryFn:  () => api.get(`/attendance/employee-summary?employeeId=${employee._id}&month=${month}&year=${year}`),
    enabled:  !!employee._id,
  });
  const overall = summaryData?.summary;

  const { data: recData, isLoading } = useQuery({
    queryKey: ['emp-att-records', employee._id, month, year],
    queryFn:  () => api.get(`/attendance/employee-records?employeeId=${employee._id}&month=${month}&year=${year}`),
    enabled:  !!employee._id,
  });
  const records = recData?.records || [];

  // Map date ISO string → record (employees have one record per day)
  const byDate = {};
  records.forEach(r => {
    const key = new Date(r.date).toISOString().slice(0, 10);
    byDate[key] = r;
  });

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
  const firstDow    = new Date(year, month - 1, 1).getDay();

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const canNext   = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

  return (
    <div>
      {/* Overall summary strip */}
      {overall && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Days', value: overall.total,     color: 'var(--primary)', bg: '#eff6ff' },
            { label: 'Present',    value: overall.present,   color: '#10b981',        bg: '#f0fdf4' },
            { label: 'Absent',     value: overall.absent,    color: '#ef4444',        bg: '#fef2f2' },
            { label: 'Late',       value: overall.late,      color: '#f59e0b',        bg: '#fffbeb' },
            { label: 'Overall %',  value: `${overall.percentage}%`,
              color: overall.percentage >= 75 ? '#10b981' : overall.percentage >= 50 ? '#f59e0b' : '#ef4444',
              bg: overall.percentage >= 75 ? '#f0fdf4' : overall.percentage >= 50 ? '#fffbeb' : '#fef2f2' },
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
            {ATT_MONTH_NAMES[month - 1]} {year}
          </span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={nextMonth} disabled={!canNext}><ChevronRight size={16} /></button>
        </div>
        {/* Monthly summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries({ present: mPresent, absent: mAbsent, late: mLate }).map(([s, n]) => n > 0 && (
            <span key={s} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: EMP_STATUS_META[s]?.bg, color: EMP_STATUS_META[s]?.color }}>
              {EMP_STATUS_META[s]?.full}: {n}
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
          {ATT_DAY_LABELS.map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 56, padding: 8, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const rec     = byDate[dateKey];
            const meta    = rec ? EMP_STATUS_META[rec.status] : null;
            const isToday  = dateKey === now.toISOString().slice(0, 10);
            const isFuture = new Date(dateKey) > now;
            return (
              <div key={day} style={{
                minHeight: 56, padding: '6px 8px', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
                background: meta ? `${meta.bg}80` : 'white', position: 'relative',
              }}>
                <div style={{
                  fontSize: 12, fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--primary)' : isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                  marginBottom: 4, display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {isToday
                    ? <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{day}</span>
                    : day}
                </div>
                {meta && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(EMP_STATUS_META).map(([key, m]) => (
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
          <p style={{ fontSize: 14 }}>No attendance records for {ATT_MONTH_NAMES[month - 1]} {year}.</p>
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
                  {['Date', 'Day', 'Status', 'Marked By', 'Remarks'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const meta = EMP_STATUS_META[r.status] || { label: r.status, full: r.status, color: '#64748b', bg: '#f1f5f9' };
                  const d    = new Date(r.date);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
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

