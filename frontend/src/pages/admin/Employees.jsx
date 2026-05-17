import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Download, Eye, Trash2, Users, ClipboardList } from 'lucide-react';
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

export default function Employees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [tasksEmployee, setTasksEmployee] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, roleFilter],
    queryFn: () => api.get(`/employees?page=${page}&limit=20&search=${search}&role=${roleFilter}`)
  });

  const employees = data?.employees || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/employees', d),
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee added! Login credentials sent.'); setShowModal(false); reset(); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee deactivated'); }
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{total} staff members</p>
        </div>
        <button className="btn btn-primary" onClick={() => { reset(); setShowModal(true); }}>
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
                    <EmptyState icon={Users} message="No employees yet. Add your first staff member!" action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Employee</button>} />
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
                    {col('phone')       && <td style={{ fontSize: 13 }}>{emp.phone}</td>}
                    {col('status')      && <td><StatusBadge status={emp.status} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Employee" size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(d => createMutation.mutate(d))} disabled={createMutation.isLoading}>
            {createMutation.isLoading ? 'Adding...' : 'Add & Send Invite'}
          </button>
        </>}>
        <form>
          <h4 className="text-12-bold" style={{ color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 14 }}>Personal Info</h4>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" {...register('name', { required: 'Required' })} />
              {errors.name && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-control" type="email" {...register('email', { required: 'Required' })} />
              {errors.email && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-control" {...register('phone', { required: 'Required' })} placeholder="9876543210" />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input className="form-control" type="date" {...register('dateOfBirth')} />
            </div>
          </FormRow>
          <FormRow>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-control" {...register('gender')}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select className="form-control" {...register('bloodGroup')}>
                <option value="">Select</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
              </select>
            </div>
          </FormRow>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
            <h4 className="text-12-bold" style={{ color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 14 }}>Job Details</h4>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-control" {...register('role', { required: 'Required' })}>
                  <option value="">Select role</option>
                  {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                {errors.role && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.role.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-control" {...register('designation')} placeholder="e.g. Senior Teacher" />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-control" {...register('department')} placeholder="e.g. Science" />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Joining</label>
                <input className="form-control" type="date" {...register('dateOfJoining')} />
              </div>
            </FormRow>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
            <h4 className="text-12-bold" style={{ color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 14 }}>Salary Details</h4>
            <div className="grid-3">
              {[['Basic', 'basic'], ['HRA', 'hra'], ['DA', 'da']].map(([label, key]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label} (₹)</label>
                  <input className="form-control" type="number" {...register(`salary.${key}`)} defaultValue={0} />
                </div>
              ))}
            </div>
            <div className="grid-3">
              {[['PF Deduction', 'pfDeduction'], ['ESI Deduction', 'esiDeduction'], ['Other Allowances', 'otherAllowances']].map(([label, key]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label} (₹)</label>
                  <input className="form-control" type="number" {...register(`salary.${key}`)} defaultValue={0} />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

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
                { label: 'Phone', value: viewEmployee.phone },
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
