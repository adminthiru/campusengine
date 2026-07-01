import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Select as AntSelect } from 'antd';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { PageLoader, EmptyState, SearchInput } from '../../components/ui';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const DEFAULT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online (UPI/NEFT)' },
];

// Icon + accent for each ledger entry kind.
const KIND_META = {
  opening:  { label: 'Opening balance', color: '#7c3aed', bg: '#f5f3ff' },
  fee:      { label: 'Fee collected',   color: '#16a34a', bg: '#f0fdf4' },
  salary:   { label: 'Salary paid',     color: '#dc2626', bg: '#fef2f2' },
  advance:  { label: 'Advance paid',    color: '#d97706', bg: '#fffbeb' },
  expense:  { label: 'Expense',         color: '#dc2626', bg: '#fef2f2' },
};

// Group transactions under human date headers (Today / Yesterday / date).
const dayLabel = (d) => {
  const dt = new Date(d); const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(dt)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const timeLabel = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export default function BalanceLedger() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [methodFilter, setMethodFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: bal } = useQuery({ queryKey: ['fees-method-balances'], queryFn: () => api.get('/fees/method-balances') });
  const { data: school } = useQuery({ queryKey: ['school'], queryFn: () => api.get('/school') });
  const { data, isLoading } = useQuery({
    queryKey: ['fees-ledger', methodFilter, typeFilter],
    queryFn: () => api.get(`/fees/ledger?method=${methodFilter}&type=${typeFilter}`),
  });

  // Undo a manual adjustment (only these are deletable — fees/salaries/expenses
  // are managed in their own modules).
  const undoAdjustment = async (id) => {
    if (!id || !window.confirm('Delete this manual adjustment? The balance will be updated.')) return;
    try {
      await api.delete(`/fees/adjustments/${id}`);
      toast.success('Adjustment removed');
      qc.invalidateQueries(['fees-ledger']);
      qc.invalidateQueries(['fees-method-balances']);
    } catch (e) { toast.error(e?.message || 'Failed'); }
  };

  const methodBalances = bal?.methods || {};
  const customMethods = (school?.school?.paymentMethods || []).map(m => ({ value: m, label: m }));
  const methods = [...DEFAULT_METHODS, ...customMethods];
  const methodLabel = (k) => methods.find(m => m.value === k)?.label || k;

  const txns = (data?.transactions || []).filter(t => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.subtitle?.toLowerCase().includes(q);
  });

  // Group by day for the Google-Pay-style sectioned list.
  const groups = [];
  txns.forEach(t => {
    const label = dayLabel(t.date);
    let g = groups.find(x => x.label === label);
    if (!g) { g = { label, items: [] }; groups.push(g); }
    g.items.push(t);
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/fees')} style={{ marginBottom: 14 }}><ArrowLeft size={14} /> Back to Fees</button>

      {/* Balance hero */}
      <div className="card" style={{ padding: 22, marginBottom: 16, background: 'linear-gradient(135deg,#1a56e8 0%,#0f172a 100%)', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.8 }}><Wallet size={15} /> Total Balance (All Methods)</div>
        <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{inr(bal?.total)}</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TrendingUp size={15} color="#86efac" /> In {inr(data?.totalIn)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TrendingDown size={15} color="#fca5a5" /> Out {inr(data?.totalOut)}</span>
        </div>
        {/* Per-method chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {methods.filter(m => methodBalances[m.value]).map(m => (
            <span key={m.value} style={{ fontSize: 12, background: 'rgba(255,255,255,0.14)', borderRadius: 20, padding: '4px 12px' }}>
              {m.label}: <strong>{inr(methodBalances[m.value]?.balance)}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 220 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or reason..." />
        </div>
        <AntSelect style={{ minWidth: 160 }} value={methodFilter || undefined} placeholder="All methods" allowClear
          onChange={v => setMethodFilter(v ?? '')}
          options={methods.filter(m => methodBalances[m.value]).map(m => ({ value: m.value, label: m.label }))} />
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
          {[['', 'All'], ['credit', 'Money In'], ['debit', 'Money Out']].map(([v, l]) => (
            <button key={v} onClick={() => setTypeFilter(v)}
              className={typeFilter === v ? 'text-13-semibold' : 'text-13-regular'}
              style={{ border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8,
                background: typeFilter === v ? 'white' : 'transparent',
                color: typeFilter === v ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: typeFilter === v ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {isLoading ? <PageLoader /> : txns.length === 0 ? (
        <div className="card" style={{ padding: 8 }}><EmptyState icon={Wallet} message="No transactions yet." /></div>
      ) : (
        groups.map(g => (
          <div key={g.label} style={{ marginBottom: 16 }}>
            <div className="text-12-regular" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 4px 8px' }}>{g.label}</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {g.items.map((t, i) => {
                const credit = t.direction === 'credit';
                const meta = KIND_META[t.kind] || KIND_META.expense;
                const Icon = credit ? ArrowDownLeft : ArrowUpRight;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={19} color={meta.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-14-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {meta.label}{t.subtitle ? ` · ${t.subtitle}` : ''} · {methodLabel(t.method)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="text-14-bold" style={{ color: credit ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                        {credit ? '+' : '−'}{inr(t.amount)}
                      </div>
                      <div className="text-12-regular" style={{ color: 'var(--text-muted)' }}>{timeLabel(t.date)}</div>
                    </div>
                    {t.kind === 'adjustment' && t.id && (
                      <button onClick={() => undoAdjustment(t.id)} title="Delete this manual adjustment"
                        className="btn btn-secondary btn-sm btn-icon" style={{ flexShrink: 0, color: '#dc2626' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
