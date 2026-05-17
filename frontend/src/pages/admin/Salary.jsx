import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Download, Play, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { StatusBadge, PageLoader, EmptyState, StatCard, Modal, FormRow, ColumnSelector, useColumnSelector } from '../../components/ui';

const SALARY_COLS = [
  { key: 'basic',       label: 'Basic' },
  { key: 'gross',       label: 'Gross' },
  { key: 'deductions',  label: 'Deductions' },
  { key: 'netSalary',   label: 'Net Salary' },
  { key: 'presentDays', label: 'Present Days' },
  { key: 'status',      label: 'Status' },
];

export default function Salary() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [generating, setGenerating] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [txId, setTxId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['salaries', month, year],
    queryFn: () => api.get(`/salaries?month=${month}&year=${year}`)
  });
  const salaries = data?.salaries || [];

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const totalNetPay = salaries.reduce((s, sal) => s + (sal.netSalary || 0), 0);
  const totalPaid = salaries.filter(s => s.status === 'paid').reduce((s, sal) => s + (sal.netSalary || 0), 0);
  const pendingCount = salaries.filter(s => s.status === 'pending').length;

  const generateSalaries = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/salaries/generate', { month, year });
      toast.success(res.message);
      qc.invalidateQueries(['salaries']);
    } catch (err) {
      toast.error(err.message || 'Failed to generate salaries');
    } finally {
      setGenerating(false);
    }
  };

  const paySalary = useMutation({
    mutationFn: (id) => api.post(`/salaries/${id}/pay`, { method: payMethod, transactionId: txId }),
    onSuccess: () => { qc.invalidateQueries(['salaries']); toast.success('Salary paid!'); setPayModal(null); setTxId(''); },
    onError: (err) => toast.error(err.message || 'Failed')
  });

  const [visibleCols, setVisibleCols] = useColumnSelector('salary', SALARY_COLS);
  const col = (key) => visibleCols.has(key);

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
          <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={generateSalaries} disabled={generating}>
            {generating ? <><div className="spinner" style={{ width: 16, height: 16 }} />Generating...</> : <><Play size={16} /> Generate Salaries</>}
          </button>
          <ColumnSelector storageKey="salary" cols={SALARY_COLS} visible={visibleCols} onChange={setVisibleCols} />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard title="Total Payable" value={`₹${totalNetPay.toLocaleString('en-IN')}`} icon={Banknote} color="#1a56e8" bg="#eff6ff" sub={`${months[month - 1]} ${year}`} />
        <StatCard title="Paid Amount" value={`₹${totalPaid.toLocaleString('en-IN')}`} icon={DollarSign} color="#10b981" bg="#f0fdf4" sub={`${salaries.filter(s => s.status === 'paid').length} employees`} />
        <StatCard title="Pending" value={pendingCount} icon={Banknote} color="#f59e0b" bg="#fffbeb" sub="employees to pay" />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  {col('basic')       && <th>Basic</th>}
                  {col('gross')       && <th>Gross</th>}
                  {col('deductions')  && <th>Deductions</th>}
                  {col('netSalary')   && <th>Net Salary</th>}
                  {col('presentDays') && <th>Present Days</th>}
                  {col('status')      && <th>Status</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaries.length === 0 && (
                  <tr><td colSpan={2 + SALARY_COLS.filter(c => visibleCols.has(c.key)).length}>
                    <EmptyState icon={Banknote} message={`No salary records for ${months[month - 1]} ${year}. Click "Generate Salaries" to create them.`} />
                  </td></tr>
                )}
                {salaries.map(sal => (
                  <tr key={sal._id}>
                    <td>
                      <div className="text-14-semibold">{sal.employee?.name}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{sal.employee?.role}</div>
                    </td>
                    {col('basic')       && <td className="text-14-regular">₹{(sal.earnings?.basic || 0).toLocaleString('en-IN')}</td>}
                    {col('gross')       && <td className="text-14-medium">₹{(sal.grossSalary || 0).toLocaleString('en-IN')}</td>}
                    {col('deductions')  && <td className="text-14-regular" style={{ color: '#ef4444' }}>₹{(sal.totalDeductions || 0).toLocaleString('en-IN')}</td>}
                    {col('netSalary')   && <td className="text-14-bold" style={{ color: '#10b981' }}>₹{(sal.netSalary || 0).toLocaleString('en-IN')}</td>}
                    {col('presentDays') && <td className="text-14-regular">{sal.presentDays}/{sal.workingDays}</td>}
                    {col('status')      && <td><StatusBadge status={sal.status} /></td>}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {sal.status === 'pending' && (
                          <button className="btn btn-success btn-sm text-12-regular" onClick={() => setPayModal(sal)} style={{ padding: '4px 10px' }}>Pay</button>
                        )}
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => downloadPayslip(sal._id)} data-tooltip="Download Payslip">
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
            <select className="form-control" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Transaction ID / Reference</label>
            <input className="form-control" value={txId} onChange={e => setTxId(e.target.value)} placeholder="UTR number or transaction reference" />
          </div>
        </Modal>
      )}
    </div>
  );
}
