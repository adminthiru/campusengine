import { Link } from 'react-router-dom';
import { Lock, ArrowUpRight } from 'lucide-react';
import { MODULES } from '../config/modules';

// Shown when a school admin opens a module that is not unlocked by their
// subscription plan. Drives the upgrade upsell instead of a hard 403 page.
export default function UpgradeRequired({ module }) {
  const label = MODULES.find(m => m.key === module)?.label || 'This feature';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
      <div className="card" style={{ maxWidth: 460, textAlign: 'center', padding: '40px 32px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary-light, #eef2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Lock size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{label} is locked</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          {label} is not included in your current plan. Upgrade your subscription to unlock it for your school.
        </p>
        <Link to="/settings/subscription" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          View Plans <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
}
