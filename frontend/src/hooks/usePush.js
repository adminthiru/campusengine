import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../store/AuthContext';
import { registerDevice, onForegroundMessage } from '../firebase/messaging';
import api from '../utils/api';

// Registers this device for push when a user is logged in, and shows foreground
// messages as a toast while refreshing the in-app notification bell.
export function usePush() {
  const { user, updateUser } = useAuth();

  useEffect(() => {
    if (!user) return;
    let unsub = () => {};

    registerDevice();

    onForegroundMessage(async (payload) => {
      const n = payload.notification || {};
      if (n.title || n.body) {
        toast(`${n.title || 'Notification'} — ${n.body || ''}`, { icon: '🔔', duration: 6000 });
      }
      // Pull the freshly-saved in-app notification so the bell updates live.
      try {
        const res = await api.get('/auth/me');
        if (res?.user) updateUser(res.user);
      } catch { /* ignore */ }
    }).then((fn) => { unsub = fn; });

    return () => { unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);
}
