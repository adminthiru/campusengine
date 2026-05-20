import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Info, SlidersHorizontal } from 'lucide-react';

// Modal
export function Modal({ open, onClose, title, children, size = '', footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? `modal-${size}` : ''}`}>
        <div className="modal-header">
          <h3 className="text-18-bold">{title}</h3>
          <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Confirm Dialog
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            {danger
              ? <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto' }} />
              : <Info size={48} style={{ color: 'var(--primary)', margin: '0 auto' }} />}
          </div>
          <h3 style={{ marginBottom: 8 }}>{title}</h3>
          <p className="text-14-regular" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Status Badge
export function StatusBadge({ status }) {
  const map = {
    active: 'success', inactive: 'danger', pending: 'warning',
    paid: 'success', partial: 'info', overdue: 'danger',
    trial: 'warning', expired: 'danger', cancelled: 'secondary',
    present: 'success', absent: 'danger', late: 'warning', excused: 'info',
    completed: 'success', ongoing: 'info', scheduled: 'warning', cancelled: 'secondary',
    on_leave: 'warning', resigned: 'secondary', terminated: 'danger',
  };
  const variant = map[status] || 'secondary';
  const displayStatus = status === 'inactive' ? 'IN ACTIVE' : status?.replace(/_/g, ' ').toUpperCase();
  return <span className={`badge badge-${variant}`}>{displayStatus}</span>;
}

// Pagination
export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onPage(page - 1)} disabled={page === 1}>
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        let p;
        if (pages <= 7) p = i + 1;
        else if (page <= 4) p = i + 1;
        else if (page >= pages - 3) p = pages - 6 + i;
        else p = page - 3 + i;
        return (
          <button
            key={p}
            className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minWidth: 36, padding: '6px 10px' }}
            onClick={() => onPage(p)}
          >{p}</button>
        );
      })}
      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onPage(page + 1)} disabled={page === pages}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// Search Input
export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="search-bar">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button onClick={() => onChange('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={14} /></button>}
    </div>
  );
}

// Avatar with fallback
export function Avatar({ src, name, size = 36 }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  if (src) return <img src={src} alt={name} className="avatar" style={{ width: size, height: size }} />;
  return (
    <div className="avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

// Loading spinner
export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

// Page loader
export function PageLoader() {
  return <div className="page-loader"><Spinner size={36} /></div>;
}

// Empty state
export function EmptyState({ icon: Icon, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{Icon && <Icon size={28} />}</div>
      <p className="text-14-regular" style={{ marginBottom: action ? 16 : 0 }}>{message}</p>
      {action}
    </div>
  );
}

// Form row helper
export function FormRow({ children, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
      {children}
    </div>
  );
}

// Info card
export function InfoItem({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className="text-14-medium" style={{ color: 'var(--text-primary)' }}>{value || '—'}</div>
    </div>
  );
}

// Stat Card
export function useColumnSelector(storageKey, cols) {
  const [visible, setVisible] = useState(() => {
    let initial = new Set(cols.filter(c => c.default !== false).map(c => c.key));
    try {
      const saved = localStorage.getItem(`cols_${storageKey}`);
      if (saved) {
        initial = new Set(JSON.parse(saved));
      }
    } catch {}
    cols.filter(c => c.required).forEach(c => initial.add(c.key));
    return initial;
  });
  const set = (next) => {
    const nextSet = new Set(next);
    cols.filter(c => c.required).forEach(c => nextSet.add(c.key));
    setVisible(nextSet);
    try { localStorage.setItem(`cols_${storageKey}`, JSON.stringify([...nextSet])); } catch {}
  };
  return [visible, set];
}

export function ColumnSelector({ storageKey, cols, visible, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (key) => {
    const col = cols.find(c => c.key === key);
    if (col?.required) return;
    const next = new Set(visible);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  const allOn = cols.every(c => visible.has(c.key));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-secondary" type="button" onClick={() => setOpen(o => !o)}>
        <SlidersHorizontal size={15} /> Columns
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
          background: 'white', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          minWidth: 210, maxHeight: 360, overflowY: 'auto',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={allOn} onChange={() => onChange(allOn ? new Set(cols.filter(c => c.required).map(c => c.key)) : new Set(cols.map(c => c.key)))} />
            Select All
          </label>
          {cols.map(col => (
            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: col.required ? 'not-allowed' : 'pointer', fontSize: 14, color: col.required ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              <input type="checkbox" checked={visible.has(col.key)} onChange={() => toggle(col.key)} disabled={col.required} />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatCard({ title, value, sub, icon: Icon, color = '#1a56e8', bg = '#eff6ff' }) {
  return (
    <div className="stat-card">
      <div>
        <div className="text-14-regular" style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{title}</div>
        <div className="text-24-bold" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{value}</div>
        {sub && <div className="text-12-regular" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
      <div className="stat-icon" style={{ background: bg }}>
        {Icon && <Icon size={22} color={color} />}
      </div>
    </div>
  );
}
