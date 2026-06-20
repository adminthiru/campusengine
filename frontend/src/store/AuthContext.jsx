import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
    if (token) {
      api.get('/auth/me').then(res => {
        setUser(res.user);
        localStorage.setItem('user', JSON.stringify(res.user));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    // If VITE_API_URL is unset/wrong, /api/* hits the static server's SPA fallback
    // and returns index.html (200) instead of JSON — guard with a clear message.
    if (!res || !res.token || !res.user) {
      throw new Error('Could not reach the API. Check the VITE_API_URL setting for this app.');
    }
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  const updateUser = (updatedUser) => {
    const merged = { ...user, ...updatedUser };
    setUser(merged);
    localStorage.setItem('user', JSON.stringify(merged));
  };

  const value = { user, loading, login, register, logout, updateUser };

  if (loading) {
    // App-shell skeleton on first load (sidebar + header + content) — no spinner.
    const sk = (w, h, r = 8, style) => <span className="skeleton" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />;
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f4f8' }}>
        <div style={{ width: 260, background: '#0f172a', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, opacity: 0.25 }} />
            <span className="skeleton" style={{ width: 120, height: 16, borderRadius: 6, opacity: 0.25 }} />
          </div>
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className="skeleton" style={{ width: '100%', height: 30, borderRadius: 8, opacity: 0.18 }} />)}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 64, background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
            {sk(180, 18)}
            {sk(36, 36, 18)}
          </div>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card" style={{ flex: 1, padding: 18 }}>{sk(90, 12)}{sk(60, 26, 8, { marginTop: 12 })}</div>)}
            </div>
            <div className="card" style={{ padding: 18 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ display: 'flex', gap: 20, padding: '12px 0' }}>{[150, 120, 90, 70].map((w, j) => sk(w, 14))}</div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
