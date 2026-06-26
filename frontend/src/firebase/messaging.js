import { getToken, onMessage } from 'firebase/messaging';
import { messagingPromise } from './firebase';
import api from '../utils/api';

// Web Push certificate (VAPID) public key — safe to expose to the client.
const VAPID_KEY = 'BNeQ9Qe-u-vokp10HcnQ-DHJgzq77RDBRV_EQGp9wMH_fG4r96KKVVzP4q7qJWHx9E9DOhvDsUURdbnCLfKA__8';

let currentToken = null;

// Request permission, get the FCM device token, and register it with the API.
// Safe to call repeatedly — it only re-posts when the token changes.
export async function registerDevice() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    const messaging = await messagingPromise;
    if (!messaging) return null;

    let swReg;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (token && token !== currentToken) {
      currentToken = token;
      await api.post('/notifications/register-token', { token });
    }
    return token;
  } catch (err) {
    console.warn('[push] registerDevice failed:', err?.message || err);
    return null;
  }
}

// Subscribe to foreground messages (app open + focused). Returns an unsubscribe fn.
export async function onForegroundMessage(handler) {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}

// Best-effort: drop this device's token (e.g. on logout).
export async function unregisterDevice() {
  if (!currentToken) return;
  try { await api.post('/notifications/unregister-token', { token: currentToken }); } catch { /* ignore */ }
  currentToken = null;
}
