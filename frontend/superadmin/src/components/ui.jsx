import { X } from 'lucide-react';

export const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
  </div>
);

export const Modal = ({ open, onClose, title, children, footer, size = 'md' }) => {
  if (!open) return null;
  const width = size === 'lg' ? 720 : size === 'sm' ? 380 : 520;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div className="text-18-semibold">{title}</div>
          <button onClick={onClose} className="btn btn-secondary btn-icon btn-sm"><X size={16} /></button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, danger }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm"
    footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button></>}>
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
  </Modal>
);

export const StatCard = ({ label, value, icon: Icon, color = 'var(--primary)' }) => (
  <div className="card" style={{ padding: '16px 18px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{value}</div>
      </div>
      {Icon && <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={color} /></div>}
    </div>
  </div>
);

export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <input className="form-control" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ maxWidth: 320 }} />
);

export const EmptyState = ({ icon: Icon, message, action }) => (
  <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
    {Icon && <Icon size={34} style={{ marginBottom: 10, opacity: 0.5 }} />}
    <div style={{ fontSize: 14, marginBottom: 14 }}>{message}</div>
    {action}
  </div>
);

export const FormRow = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
);

const BADGE_COLORS = {
  active: ['#16a34a', '#ecfdf5'], trial: ['#d97706', '#fffbeb'], expired: ['#dc2626', '#fef2f2'],
  suspended: ['#64748b', '#f1f5f9'], paid: ['#16a34a', '#ecfdf5'], pending: ['#d97706', '#fffbeb'], failed: ['#dc2626', '#fef2f2'],
};
export const Badge = ({ status }) => {
  const [c, bg] = BADGE_COLORS[status] || ['#64748b', '#f1f5f9'];
  return <span style={{ fontSize: 12, fontWeight: 600, color: c, background: bg, padding: '2px 10px', borderRadius: 20, textTransform: 'capitalize' }}>{status}</span>;
};
