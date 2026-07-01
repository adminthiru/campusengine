import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Download, DollarSign, Search, Plus, Trash2, Edit2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select as AntSelect } from 'antd';
import api from '../../utils/api';
import { useYear } from '../../store/YearContext';
import { StatusBadge, PageLoader, EmptyState, StatCard, Modal, FormRow, ConfirmDialog, SearchInput } from '../../components/ui';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function SalaryFieldHead({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function SalaryField({ label, value, onChange, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f1f5f9', background: highlight ? '#fffbeb' : 'transparent', borderRadius: highlight ? 4 : 0 }}>
      <label style={{ fontSize: 13, color: highlight ? '#92400e' : 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: highlight ? 600 : 400 }}>{label}</label>
      <input className="form-control" type="number" min={0} value={value} onChange={e => onChange(e.target.value)}
        placeholder="0" style={{ width: 120, textAlign: 'right', fontSize: 13, padding: '4px 8px', background: highlight ? '#fef9c3' : undefined }} />
    </div>
  );
}

function SalaryAttChip({ label, count, color, bg }) {
  if (!count || count <= 0) return null;
  return (
    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, fontWeight: 600, background: bg, color }}>{label}: {count}</span>
  );
}

export default function Salary() {
  const qc = useQueryClient();
  const now = new Date();
  const { selectedYear, isCurrent, months: ayMonths } = useYear();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // When a PAST academic year is selected in the header, jump the period
  // pickers into that year. When the current year is selected (default),
  // keep the real current month so the generate/pay workflow is unaffected.
  useEffect(() => {
    if (isCurrent) {
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
    } else {
      setMonth(ayMonths.fromMonth);
      setYear(ayMonths.fromYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Year options span the selected academic year's calendar years plus the
  // usual current-year window, de-duplicated and sorted.
  const yearOptions = [...new Set([
    now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1,
    ayMonths.fromYear, ayMonths.toYear,
  ])].sort((a, b) => a - b);
  const [payModal, setPayModal] = useState(null);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [txId, setTxId] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSalary, setEditSalary] = useState(null);
  const [viewSalary, setViewSalary] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState(null); // { salaryId, amount, employeeName }

  const autoGenAttempted = useRef(new Set());
  const [autoGenerating, setAutoGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['salaries', month, year],
    queryFn: () => api.get(`/salaries?month=${month}&year=${year}`)
  });

  // Payment methods = built-ins + the school's custom fee payment categories,
  // so salaries can be paid from (and deducted against) the same balances.
  const { data: schoolData } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const payMethodOptions = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cash',          label: 'Cash' },
    { value: 'cheque',        label: 'Cheque' },
    { value: 'online',        label: 'Online (UPI/NEFT)' },
    ...(schoolData?.school?.paymentMethods || []).filter(Boolean).map(m => ({ value: m, label: m })),
  ];
  const salaries = data?.salaries || [];

  const autoGenerateMutation = useMutation({
    mutationFn: () => api.post('/salaries/generate', { month, year }),
    onSuccess: (res) => {
      qc.invalidateQueries(['salaries', month, year]);
      const count = (res.generated?.length ?? 0) + (res.updated ?? 0);
      if (count > 0) toast.success(`Salaries ready for ${count} employee${count > 1 ? 's' : ''} — ${MONTHS[month - 1]} ${year}`);
      setAutoGenerating(false);
    },
    onError: () => setAutoGenerating(false),
  });

  // Auto-sync the month once: create missing records and backfill any blank ones
  // from the employee's salary (master or a prior month), so a set salary carries
  // forward without re-entry.
  useEffect(() => {
    const key = `${month}-${year}`;
    if (isLoading || autoGenAttempted.current.has(key)) return;
    const hasBlankPending = salaries.some(s => (s.grossSalary || 0) === 0 && s.status === 'pending');
    if (salaries.length === 0 || hasBlankPending) {
      autoGenAttempted.current.add(key);
      setAutoGenerating(true);
      autoGenerateMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, salaries, month, year]);

  const totalNetPay = salaries.reduce((s, sal) => s + (sal.netSalary || 0), 0);
  const totalPaid = salaries.filter(s => s.status === 'paid').reduce((s, sal) => s + (sal.netSalary || 0), 0);
  const pendingCount = salaries.filter(s => s.status === 'pending').length;

  const deleteMutation = useMutation({
    mutationFn: async () => Promise.all(selected.map(id => api.delete(`/salaries/${id}`))),
    onSuccess: () => {
      qc.invalidateQueries(['salaries']);
      toast.success(`${selected.length} record${selected.length > 1 ? 's' : ''} deleted`);
      setSelected([]);
      setConfirmDelete(false);
    },
    onError: () => { toast.error('Failed to delete'); setConfirmDelete(false); }
  });

  const revertMutation = useMutation({
    mutationFn: (id) => api.post(`/salaries/${id}/revert`),
    onSuccess: (data) => {
      qc.invalidateQueries(['salaries']);
      qc.invalidateQueries(['fees-method-balances']);
      toast.success('Salary reverted to pending');
      if (viewSalary) setViewSalary(data.salary);
    },
    onError: (err) => toast.error(err.message || 'Failed to revert')
  });

  const paySalary = useMutation({
    mutationFn: (id) => api.post(`/salaries/${id}/pay`, { method: payMethod, transactionId: txId }),
    onSuccess: () => { qc.invalidateQueries(['salaries']); qc.invalidateQueries(['fees-method-balances']); toast.success('Salary paid!'); setPayModal(null); setTxId(''); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const calcAllMutation = useMutation({
    mutationFn: async (ids) => Promise.all(ids.map(id => api.post(`/salaries/${id}/recalculate`))),
    onSuccess: (_res, ids) => { qc.invalidateQueries(['salaries']); toast.success(`Recalculated ${ids.length} salar${ids.length > 1 ? 'ies' : 'y'} from attendance`); },
    onError: (err) => toast.error(err.message || 'Failed to recalculate'),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/salaries/generate', { month, year }),
    onSuccess: (res) => {
      qc.invalidateQueries(['salaries', month, year]);
      const added = res.generated?.length ?? 0;
      const upd = res.updated ?? 0;
      const parts = [];
      if (added) parts.push(`added ${added}`);
      if (upd) parts.push(`updated ${upd}`);
      toast.success(parts.length
        ? `Synced ${MONTHS[month - 1]} ${year} — ${parts.join(', ')} employee salar${added + upd > 1 ? 'ies' : 'y'}`
        : `All employees already up to date for ${MONTHS[month - 1]} ${year}`
      );
    },
    onError: (err) => toast.error(err?.message || 'Sync failed'),
  });

  const roles = [...new Set(salaries.map(s => s.employee?.role).filter(Boolean))];

  const filteredSalaries = salaries.filter(s => {
    const matchSearch = !search ||
      s.employee?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.employee?.employeeId?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || s.employee?.role === roleFilter;
    return matchSearch && matchRole;
  });

  // Records whose stored figures are out of sync with the latest attendance.
  const needsRecalcIds = salaries.filter(s => s.needsRecalc).map(s => s._id);

  const downloadPayslip = async (id) => {
    try {
      const res = await fetch(`/api/salaries/${id}/payslip`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'payslip.pdf'; a.click();
    } catch { toast.error('Failed to generate payslip'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary</h1>
          <p className="page-subtitle">Manage employee salary and payslips</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AntSelect
            style={{ width: 90, height: 36, fontSize: 14 }}
            value={month}
            onChange={val => setMonth(val)}
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
            className="salary-period-select"
          />
          <AntSelect
            style={{ width: 100, height: 36, fontSize: 14 }}
            value={year}
            onChange={val => setYear(val)}
            options={yearOptions.map(y => ({ value: y, label: String(y) }))}
            className="salary-period-select"
          />
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Add any missing employees to this month's salary"
          >
            <RotateCcw size={16} style={syncMutation.isPending ? { animation: 'spin 1s linear infinite' } : {}} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync Employees'}
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard title="Total Payable" value={`₹${totalNetPay.toLocaleString('en-IN')}`} icon={Banknote} color="#1a56e8" bg="#eff6ff" sub={`${MONTHS[month - 1]} ${year}`} />
        <StatCard title="Paid Amount" value={`₹${totalPaid.toLocaleString('en-IN')}`} icon={DollarSign} color="#10b981" bg="#f0fdf4" sub={`${salaries.filter(s => s.status === 'paid').length} employees`} />
        <StatCard title="Pending" value={pendingCount} icon={Banknote} color="#f59e0b" bg="#fffbeb" sub="employees to pay" />
      </div>

      {(isLoading || autoGenerating) ? <PageLoader /> : (
        <>
          <div className="filter-bar" style={{ marginBottom: 14 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, employee ID..." />
            <AntSelect
              style={{ width: 160 }}
              value={roleFilter || undefined}
              placeholder="All Roles"
              allowClear
              onChange={val => setRoleFilter(val ?? '')}
              options={roles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
            />
            {needsRecalcIds.length > 0 && (
              <button className="btn btn-secondary" style={{ marginLeft: 'auto' }}
                onClick={() => calcAllMutation.mutate(needsRecalcIds)} disabled={calcAllMutation.isPending}>
                <RotateCcw size={16} style={calcAllMutation.isPending ? { animation: 'spin 1s linear infinite' } : {}} />
                {calcAllMutation.isPending ? 'Calculating…' : `Calculate All (${needsRecalcIds.length})`}
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" onChange={e => setSelected(e.target.checked ? filteredSalaries.map(s => s._id) : [])} checked={filteredSalaries.length > 0 && filteredSalaries.every(s => selected.includes(s._id))} /></th>
                    <th>Employee</th>
                    <th>Basic</th>
                    <th>Gross</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Present Days</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalaries.length === 0 && (
                    <tr><td colSpan={9}>
                      <EmptyState icon={Banknote} message={
                        salaries.length === 0
                          ? `No active employees found to generate salaries for ${MONTHS[month - 1]} ${year}. Add employees first.`
                          : 'No employees match your search.'
                      } />
                    </td></tr>
                  )}
                  {filteredSalaries.map(sal => (
                    <tr key={sal._id} onClick={() => setViewSalary(sal)} style={{ cursor: 'pointer' }}>
                      <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(sal._id)} onChange={e => setSelected(p => e.target.checked ? [...p, sal._id] : p.filter(id => id !== sal._id))} /></td>
                      <td>
                        <div className="text-14-semibold">{sal.employee?.name}</div>
                        <div className="text-12-regular" style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {[sal.employee?.designation, sal.employee?.role].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="text-14-regular">₹{(sal.earnings?.basic || 0).toLocaleString('en-IN')}</td>
                      <td className="text-14-medium">₹{(sal.grossSalary || 0).toLocaleString('en-IN')}</td>
                      <td className="text-14-regular" style={{ color: '#ef4444' }}>₹{(sal.totalDeductions || 0).toLocaleString('en-IN')}</td>
                      <td className="text-14-bold" style={{ color: '#10b981' }}>₹{(sal.netSalary || 0).toLocaleString('en-IN')}</td>
                      <td className="text-14-regular">{sal.presentDays}/{sal.workingDays}</td>
                      <td><StatusBadge status={sal.status} /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(sal.grossSalary || 0) > 0 ? (
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditSalary(sal)} title="Edit salary">
                              <Edit2 size={14} />
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-icon" onClick={() => setEditSalary(sal)} title="Add salary"
                              style={{ background: '#eff6ff', color: 'var(--primary)', border: '1px solid #bfdbfe' }}>
                              <Plus size={14} />
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadPayslip(sal._id)} title="Download Payslip">
                            <Download size={14} />
                          </button>
                          {sal.status === 'pending' && (
                            <button className="btn btn-success btn-sm" onClick={() => setPayModal(sal)} style={{ padding: '4px 10px' }}>Pay</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pay Modal */}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title="Pay Salary"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
            <button className="btn btn-success" onClick={() => paySalary.mutate(payModal._id)} disabled={paySalary.isLoading}>
              {paySalary.isLoading ? 'Processing...' : `Pay ₹${payModal.netSalary?.toLocaleString('en-IN')}`}
            </button>
          </>}>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16 }}>
            <div className="text-14-bold">{payModal.employee?.name}</div>
            <div className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>Net Pay: <strong>₹{payModal.netSalary?.toLocaleString('en-IN')}</strong></div>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <AntSelect
              style={{ width: '100%' }}
              value={payMethod}
              onChange={val => setPayMethod(val)}
              options={payMethodOptions}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Transaction ID / Reference</label>
            <input className="form-control" value={txId} onChange={e => setTxId(e.target.value)} placeholder="UTR number or transaction reference" />
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Salary Records"
        message={`This will permanently delete ${selected.length} salary record${selected.length > 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setConfirmDelete(false)}
      />

      {showAddModal && (
        <AddSalaryModal
          month={month}
          year={year}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { qc.invalidateQueries(['salaries']); setShowAddModal(false); }}
        />
      )}

      {editSalary && (
        <EditSalaryModal
          sal={editSalary}
          methods={payMethodOptions}
          onClose={() => setEditSalary(null)}
          onSuccess={(adv) => {
            qc.invalidateQueries(['salaries']);
            qc.invalidateQueries(['fees-method-balances']);
            setEditSalary(null);
            if (adv?.needsMethod) setAdvanceTarget(adv);
          }}
        />
      )}

      {advanceTarget && (
        <AdvanceMethodModal
          target={advanceTarget}
          methods={payMethodOptions}
          onClose={() => setAdvanceTarget(null)}
          onSuccess={() => { qc.invalidateQueries(['fees-method-balances']); setAdvanceTarget(null); }}
        />
      )}

      {viewSalary && (
        <ViewSalaryModal
          sal={viewSalary}
          onClose={() => setViewSalary(null)}
          onEdit={() => { setEditSalary(viewSalary); setViewSalary(null); }}
          onDownload={() => downloadPayslip(viewSalary._id)}
          onPay={() => { setPayModal(viewSalary); setViewSalary(null); }}
          onRevert={() => revertMutation.mutate(viewSalary._id)}
          reverting={revertMutation.isPending}
        />
      )}
    </div>
  );
}

function AddSalaryModal({ month, year, onClose, onSuccess }) {
  const { data: empData } = useQuery({
    queryKey: ['employees-for-salary'],
    queryFn: () => api.get('/employees?limit=500&status=active')
  });
  const employees = empData?.employees || [];

  // Cascading filters
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [empId, setEmpId] = useState('');

  const roles = [...new Set(employees.map(e => e.role).filter(Boolean))].sort();
  const byRole = roleFilter ? employees.filter(e => e.role === roleFilter) : employees;
  const departments = [...new Set(byRole.map(e => e.department).filter(Boolean))].sort();
  const filteredEmps = byRole.filter(e => !deptFilter || e.department === deptFilter);

  // Earnings
  const [basic, setBasic] = useState('');
  const [hra, setHra] = useState('');
  const [da, setDa] = useState('');
  const [otherAllow, setOtherAllow] = useState('');
  const [overtime, setOvertime] = useState('');
  const [bonus, setBonus] = useState('');

  // Deductions (auto-filled, overridable)
  const [pf, setPf] = useState('');
  const [esi, setEsi] = useState('');
  const [loan, setLoan] = useState('');
  const [otherDed, setOtherDed] = useState('');

  const [loading, setLoading] = useState(false);

  // Attendance from backend
  const { data: attData, isFetching: attFetching } = useQuery({
    queryKey: ['salary-att-preview', empId, month, year],
    queryFn: () => api.get(`/salaries/attendance-preview?employeeId=${empId}&month=${month}&year=${year}`),
    enabled: !!empId,
  });

  const workingDays = attData?.workingDays || new Date(year, month, 0).getDate();
  const attStats = attData?.stats || {};
  const lopDays = attData?.lopDays || 0;

  // Auto-fill earnings from employee config on selection
  useEffect(() => {
    if (!empId) return;
    const emp = employees.find(e => e._id === empId);
    const sal = emp?.salary || {};
    const b = sal.basic || 0;
    const h = sal.hra || 0;
    const d = sal.da || 0;
    const oa = sal.otherAllowances || 0;
    const gross = b + h + d + oa;
    setBasic(b ? String(b) : '');
    setHra(h ? String(h) : '');
    setDa(d ? String(d) : '');
    setOtherAllow(oa ? String(oa) : '');
    setPf(String(Math.round(b * 0.12)));
    setEsi(String(gross <= 21000 ? Math.round(gross * 0.0075) : 0));
  }, [empId]);

  // Live calc
  const b = Number(basic) || 0;
  const h = Number(hra) || 0;
  const d = Number(da) || 0;
  const oa = Number(otherAllow) || 0;
  const ot = Number(overtime) || 0;
  const bn = Number(bonus) || 0;
  const gross = b + h + d + oa + ot + bn;
  const lop = lopDays > 0 && b > 0 ? Math.round((b / workingDays) * lopDays) : 0;
  const pfV = Number(pf) || 0;
  const esiV = Number(esi) || 0;
  const loanV = Number(loan) || 0;
  const otherDedV = Number(otherDed) || 0;
  const totalDed = pfV + esiV + lop + loanV + otherDedV;
  const net = Math.max(0, gross - totalDed);

  const handleSave = async () => {
    if (!empId) return toast.error('Select an employee');
    setLoading(true);
    try {
      await api.post('/salaries', {
        employeeId: empId, month, year,
        earnings: { basic: b, hra: h, da: d, otherAllowances: oa, overtime: ot, bonus: bn },
        deductions: { pf: pfV, esi: esiV, loan: loanV, other: otherDedV },
        workingDays,
        presentDays: Math.max(0, workingDays - lopDays)
      });
      toast.success('Salary record created!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Add Salary Record — ${MONTHS[month - 1]} ${year}`} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !empId}>
          {loading ? 'Creating...' : 'Create Salary Record'}
        </button>
      </>}>

      {/* Cascading employee filter */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Select Employee</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Role</label>
            <AntSelect
              style={{ width: '100%' }}
              value={roleFilter || undefined}
              placeholder="All Roles"
              allowClear
              onChange={val => { setRoleFilter(val ?? ''); setDeptFilter(''); setEmpId(''); }}
              options={roles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Department / Subject</label>
            <AntSelect
              style={{ width: '100%' }}
              value={deptFilter || undefined}
              placeholder="All Departments"
              allowClear
              disabled={!roleFilter && departments.length === 0}
              onChange={val => { setDeptFilter(val ?? ''); setEmpId(''); }}
              options={departments.map(dep => ({ value: dep, label: dep }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Employee *</label>
            <AntSelect
              style={{ width: '100%' }}
              value={empId || undefined}
              placeholder={filteredEmps.length === 0 ? 'No employees' : 'Select employee'}
              showSearch
              optionFilterProp="label"
              onChange={val => setEmpId(val ?? '')}
              options={filteredEmps.map(e => ({ value: e._id, label: e.name }))}
            />
          </div>
        </div>
      </div>

      {/* Attendance summary — auto from backend */}
      {empId && (
        <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: attFetching ? '#f8fafc' : '#f0f7ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attendance — {MONTHS[month - 1]} {year}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{workingDays} working days</span>
          </div>
          {attFetching ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading attendance…</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <SalaryAttChip label="Present" count={attStats.present} color="#166534" bg="#dcfce7" />
                <SalaryAttChip label="Absent" count={attStats.absent} color="#dc2626" bg="#fee2e2" />
                <SalaryAttChip label="Half Day" count={attStats.half_day} color="#92400e" bg="#fef9c3" />
                <SalaryAttChip label="CL (Leave)" count={attStats.leave} color="#1d4ed8" bg="#dbeafe" />
                <SalaryAttChip label="Late" count={attStats.late} color="#6b7280" bg="#f3f4f6" />
                {!Object.values(attStats).some(v => v > 0) && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No attendance records found for this month</span>
                )}
              </div>
              {lopDays > 0 && (
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>LOP: {lopDays} day{lopDays !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Absent = 1 day · Half day = 0.5 day · CL = no deduction</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Earnings */}
        <div>
          <SalaryFieldHead>Earnings (₹)</SalaryFieldHead>
          <SalaryField label="Basic Salary" value={basic} onChange={setBasic} />
          <SalaryField label="HRA" value={hra} onChange={setHra} />
          <SalaryField label="DA" value={da} onChange={setDa} />
          <SalaryField label="Other Allowances" value={otherAllow} onChange={setOtherAllow} />
          <SalaryField label="Overtime" value={overtime} onChange={setOvertime} />
          <SalaryField label="Bonus" value={bonus} onChange={setBonus} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 6, background: '#f0fdf4', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>Gross Salary</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>₹{gross.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Deductions */}
        <div>
          <SalaryFieldHead>Deductions (₹)</SalaryFieldHead>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Auto-calculated · you can override</div>
          <SalaryField label="EPF (12% of basic)" value={pf} onChange={setPf} />
          <SalaryField label="ESI (0.75% of gross)" value={esi} onChange={setEsi} />
          <SalaryField label="Advance / Loan" value={loan} onChange={setLoan} />
          <SalaryField label="Other Deductions" value={otherDed} onChange={setOtherDed} />
          {lop > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#ef4444' }}>
              <span>Loss of Pay ({lopDays}d)</span>
              <span style={{ fontWeight: 600 }}>₹{lop.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 6, background: '#fef2f2', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Total Deductions</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>₹{totalDed.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Net Salary */}
      <div style={{ marginTop: 20, background: 'var(--primary)', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>Net Salary — {MONTHS[month - 1]} {year}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Gross ₹{gross.toLocaleString('en-IN')} − Deductions ₹{totalDed.toLocaleString('en-IN')}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'white' }}>₹{net.toLocaleString('en-IN')}</div>
      </div>
    </Modal>
  );
}

// After an advance is saved, ask which payment category it's paid from so the
// amount is deducted from that method's running balance.
function AdvanceMethodModal({ target, methods, onClose, onSuccess }) {
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.put(`/salaries/${target.salaryId}/advance-method`, { method });
      toast.success('Advance payment recorded');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Advance — Payment Category"
      footer={
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
      }>
      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <div className="text-14-semibold" style={{ color: '#92400e' }}>{target.employeeName}</div>
        <div className="text-13-regular" style={{ color: '#92400e', marginTop: 2 }}>
          Advance of ₹{(target.amount || 0).toLocaleString('en-IN')} — choose the account it's paid from. This amount will be deducted from that category's balance.
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Payment Category</label>
        <AntSelect style={{ width: '100%' }} value={method} onChange={setMethod} options={methods} />
      </div>
    </Modal>
  );
}

function EditSalaryModal({ sal, methods = [], onClose, onSuccess }) {
  const originalAdvance = Number(sal.deductions?.loan) || 0;
  // Pre-fill from existing record
  const [basic, setBasic] = useState(String(sal.earnings?.basic || ''));
  const [hra, setHra] = useState(String(sal.earnings?.hra || ''));
  const [da, setDa] = useState(String(sal.earnings?.da || ''));
  const [otherAllow, setOtherAllow] = useState(String(sal.earnings?.otherAllowances || ''));
  const [overtime, setOvertime] = useState(String(sal.earnings?.overtime || ''));
  const [bonus, setBonus] = useState(String(sal.earnings?.bonus || ''));

  const [pf, setPf] = useState(String(sal.deductions?.pf || ''));
  const [esi, setEsi] = useState(String(sal.deductions?.esi || ''));
  const [loan, setLoan] = useState(String(sal.deductions?.loan || ''));
  const [otherDed, setOtherDed] = useState(String(sal.deductions?.other || ''));

  const [loading, setLoading] = useState(false);

  const empId = sal.employee?._id || sal.employee;
  const { month, year } = sal;

  // Attendance from backend
  const { data: attData, isFetching: attFetching } = useQuery({
    queryKey: ['salary-att-preview', empId, month, year],
    queryFn: () => api.get(`/salaries/attendance-preview?employeeId=${empId}&month=${month}&year=${year}`),
    enabled: !!empId,
  });

  const workingDays = attData?.workingDays || sal.workingDays || new Date(year, month, 0).getDate();
  const attStats = attData?.stats || {};
  const lopDays = attData?.lopDays ?? (sal.leaveDays || 0);

  // Live calc
  const b = Number(basic) || 0;
  const h = Number(hra) || 0;
  const d = Number(da) || 0;
  const oa = Number(otherAllow) || 0;
  const ot = Number(overtime) || 0;
  const bn = Number(bonus) || 0;
  const gross = b + h + d + oa + ot + bn;
  const lop = lopDays > 0 && b > 0 ? Math.round((b / workingDays) * lopDays) : 0;
  const pfV = Number(pf) || 0;
  const esiV = Number(esi) || 0;
  const loanV = Number(loan) || 0;
  const otherDedV = Number(otherDed) || 0;
  const totalDed = pfV + esiV + lop + loanV + otherDedV;
  const net = Math.max(0, gross - totalDed);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/salaries/${sal._id}`, {
        earnings: { basic: b, hra: h, da: d, otherAllowances: oa, overtime: ot, bonus: bn },
        deductions: { pf: pfV, esi: esiV, loan: loanV, lossOfPay: lop, other: otherDedV },
        workingDays,
        presentDays: Math.max(0, workingDays - lopDays),
        leaveDays: lopDays,
        grossSalary: gross,
        totalDeductions: totalDed,
        netSalary: net,
      });
      toast.success('Salary updated!');
      // If an advance was newly given (or its amount changed), ask which account
      // it's paid from so the balance is deducted from that category.
      const needsMethod = loanV > 0 && loanV !== originalAdvance;
      onSuccess(needsMethod ? { needsMethod: true, salaryId: sal._id, amount: loanV, employeeName: sal.employee?.name } : undefined);
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit Salary — ${MONTHS[month - 1]} ${year}`} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </>}>

      {/* Employee info */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="text-14-semibold">{sal.employee?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{sal.employee?.role} · {sal.employee?.employeeId}</div>
        </div>
        <StatusBadge status={sal.status} />
      </div>

      {/* Attendance summary */}
      <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: attFetching ? '#f8fafc' : '#f0f7ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Attendance — {MONTHS[month - 1]} {year}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{workingDays} working days</span>
        </div>
        {attFetching ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading attendance…</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <SalaryAttChip label="Present" count={attStats.present} color="#166534" bg="#dcfce7" />
              <SalaryAttChip label="Absent" count={attStats.absent} color="#dc2626" bg="#fee2e2" />
              <SalaryAttChip label="Half Day" count={attStats.half_day} color="#92400e" bg="#fef9c3" />
              <SalaryAttChip label="CL (Leave)" count={attStats.leave} color="#1d4ed8" bg="#dbeafe" />
              <SalaryAttChip label="Late" count={attStats.late} color="#6b7280" bg="#f3f4f6" />
              {!Object.values(attStats).some(v => v > 0) && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No attendance records found for this month</span>
              )}
            </div>
            {lopDays > 0 && (
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>LOP: {lopDays} day{lopDays !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--text-muted)' }}>Absent = 1 day · Half day = 0.5 day · CL = no deduction</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Earnings */}
        <div>
          <SalaryFieldHead>Earnings (₹)</SalaryFieldHead>
          <SalaryField label="Basic Salary" value={basic} onChange={setBasic} />
          <SalaryField label="HRA" value={hra} onChange={setHra} />
          <SalaryField label="DA" value={da} onChange={setDa} />
          <SalaryField label="Other Allowances" value={otherAllow} onChange={setOtherAllow} />
          <SalaryField label="Overtime" value={overtime} onChange={setOvertime} />
          <SalaryField label="Bonus" value={bonus} onChange={setBonus} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 6, background: '#f0fdf4', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>Gross Salary</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>₹{gross.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Deductions */}
        <div>
          <SalaryFieldHead>Deductions (₹)</SalaryFieldHead>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Auto-calculated · you can override</div>
          <SalaryField label="EPF (12% of basic)" value={pf} onChange={setPf} />
          <SalaryField label="ESI (0.75% of gross)" value={esi} onChange={setEsi} />
          <SalaryField label="Advance Amount" value={loan} onChange={setLoan} highlight />
          <SalaryField label="Other Deductions" value={otherDed} onChange={setOtherDed} />
          {lop > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#ef4444' }}>
              <span>Loss of Pay ({lopDays}d)</span>
              <span style={{ fontWeight: 600 }}>₹{lop.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 6, background: '#fef2f2', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Total Deductions</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>₹{totalDed.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Net Salary */}
      <div style={{ marginTop: 20, background: 'var(--primary)', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>Net Salary — {MONTHS[month - 1]} {year}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Gross ₹{gross.toLocaleString('en-IN')} − Deductions ₹{totalDed.toLocaleString('en-IN')}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'white' }}>₹{net.toLocaleString('en-IN')}</div>
      </div>
    </Modal>
  );
}

function ViewSalaryModal({ sal, onClose, onEdit, onDownload, onPay, onRevert, reverting }) {
  const e = sal.earnings || {};
  const ded = sal.deductions || {};

  const Row = ({ label, value, color, bold, highlight }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
      background: highlight ? '#fffbeb' : 'transparent', borderRadius: highlight ? 4 : 0
    }}>
      <span style={{ fontSize: 13, color: highlight ? '#92400e' : 'var(--text-secondary)', fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );

  const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  return (
    <Modal open onClose={onClose} title={`Salary Details — ${MONTHS[sal.month - 1]} ${sal.year}`} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        <button className="btn btn-secondary" onClick={onDownload}><Download size={14} /> Payslip</button>
        <button className="btn btn-secondary" onClick={onEdit}><Edit2 size={14} /> Edit</button>
        {sal.status === 'pending' && (
          <button className="btn btn-success" onClick={onPay} style={{ fontWeight: 600, background: '#16a34a', borderColor: '#16a34a', color: 'white' }}>Pay Now</button>
        )}
      </>}>

      {/* Employee header */}
      <div style={{ background: 'linear-gradient(135deg, #1a56e8 0%, #3b82f6 100%)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{sal.employee?.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize', marginTop: 2 }}>
            {sal.employee?.role} · {sal.employee?.employeeId}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 700,
              background: sal.status === 'paid' ? '#dcfce7' : '#fef9c3',
              color: sal.status === 'paid' ? '#166534' : '#92400e'
            }}>{sal.status?.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Net Salary</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{fmt(sal.netSalary)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{sal.presentDays}/{sal.workingDays} days present</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Earnings */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', background: '#f0fdf4', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(sal.grossSalary)}</span>
          </div>
          {e.basic > 0 && <Row label="Basic Salary" value={fmt(e.basic)} />}
          {e.hra > 0 && <Row label="HRA" value={fmt(e.hra)} />}
          {e.da > 0 && <Row label="DA" value={fmt(e.da)} />}
          {e.otherAllowances > 0 && <Row label="Other Allowances" value={fmt(e.otherAllowances)} />}
          {e.overtime > 0 && <Row label="Overtime" value={fmt(e.overtime)} />}
          {e.bonus > 0 && <Row label="Bonus" value={fmt(e.bonus)} />}
          <Row label="Gross Total" value={fmt(sal.grossSalary)} color="#16a34a" bold />
        </div>

        {/* Deductions */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', background: '#fef2f2', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deductions</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmt(sal.totalDeductions)}</span>
          </div>
          {ded.pf > 0 && <Row label="EPF (12%)" value={fmt(ded.pf)} />}
          {ded.esi > 0 && <Row label="ESI (0.75%)" value={fmt(ded.esi)} />}
          {ded.loan > 0 && <Row label="Advance Amount" value={fmt(ded.loan)} highlight />}
          {ded.lossOfPay > 0 && <Row label={`Loss of Pay (${sal.leaveDays || 0}d)`} value={fmt(ded.lossOfPay)} color="#ef4444" />}
          {ded.tax > 0 && <Row label="Tax" value={fmt(ded.tax)} />}
          {ded.other > 0 && <Row label="Other" value={fmt(ded.other)} />}
          <Row label="Total Deductions" value={fmt(sal.totalDeductions)} color="#dc2626" bold />
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Gross', value: fmt(sal.grossSalary), color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Deductions', value: fmt(sal.totalDeductions), color: '#dc2626', bg: '#fef2f2' },
          { label: 'Advance', value: fmt(ded.loan), color: '#92400e', bg: '#fffbeb' },
          { label: 'Net Pay', value: fmt(sal.netSalary), color: '#1a56e8', bg: '#eff6ff' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Payment info if paid */}
      {sal.status === 'paid' && sal.payment && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, color: '#16a34a' }}>Paid via {sal.payment.method?.replace('_', ' ')}</span>
            {sal.payment.transactionId && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>· Ref: {sal.payment.transactionId}</span>}
            {sal.payment.date && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>· {new Date(sal.payment.date).toLocaleDateString('en-IN')}</span>}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onRevert} disabled={reverting}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <RotateCcw size={13} /> {reverting ? 'Reverting…' : 'Revert to Pending'}
          </button>
        </div>
      )}
    </Modal>
  );
}
