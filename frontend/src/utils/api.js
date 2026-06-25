import axios from 'axios';

// In dev the Vite proxy forwards /api → backend. In production (frontend served
// on its own domain) set VITE_API_URL to the API's public base, e.g.
// https://campusengine-production.up.railway.app/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const url = error.config?.url || '';
    // 401 on the login/register calls themselves just means bad credentials —
    // let the form show the message instead of nuking the session and reloading.
    const isAuthSubmit = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthSubmit) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Avoid a reload loop when we're already on the login page.
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
