import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { LayoutDashboard, Building2, CreditCard, Package, Settings, LogOut, ShieldCheck } from 'lucide-react';

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Tenants', icon: Building2, path: '/tenants' },
  { label: 'Plans', icon: Package, path: '/plans' },
  { label: 'Payments', icon: CreditCard, path: '/payments' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 250, background: '#0f172a', color: 'white', position: 'fixed', top: 0, bottom: 0, left: 0, padding: '20px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 22px' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={20} color="white" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>School ERP</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Platform Admin</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {NAV.map(n => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9, textDecoration: 'none', fontSize: 14,
                color: isActive ? 'white' : 'rgba(255,255,255,0.65)', background: isActive ? 'var(--primary)' : 'transparent', fontWeight: isActive ? 600 : 400,
              })}>
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => { logout(); navigate('/login'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.65)', background: 'transparent', textAlign: 'left' }}>
          <LogOut size={17} /> Logout
        </button>
      </aside>

      {/* Content */}
      <main style={{ marginLeft: 250, flex: 1, minWidth: 0 }}>
        <header style={{ height: 60, background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 28px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{(user?.name || 'S')[0]}</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{user?.name || 'Super Admin'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{user?.email}</div>
            </div>
          </div>
        </header>
        <div style={{ padding: 28 }}>{children}</div>
      </main>
    </div>
  );
}
