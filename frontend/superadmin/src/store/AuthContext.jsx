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
    // This is the super-admin portal — always authenticate as the product owner.
    const res = await api.post('/auth/login', { ...credentials, isSuperAdmin: true });
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

  const value = { user, loading, login, logout, updateUser };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4f8' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
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
