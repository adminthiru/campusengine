/* Firebase Cloud Messaging service worker — handles push notifications while the
   app is in the background or closed. Uses the compat SDK (required in SWs). */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC4RWt5_I82rngZWVwjlAwFBKSYvONj0BA',
  authDomain: 'campusengine-d1168.firebaseapp.com',
  projectId: 'campusengine-d1168',
  storageBucket: 'campusengine-d1168.firebasestorage.app',
  messagingSenderId: '387397605372',
  appId: '1:387397605372:web:c3aa887c5c419d01e80479',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'CampusEngine';
  const body = payload.notification?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
  });
});

// Focus/open the app when the user taps a notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) { if ('focus' in client) return client.focus(); }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
