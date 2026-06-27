// Firebase Cloud Messaging service worker (web push).
// firebase_messaging loads this automatically from the site root on web.
// Keep the config in sync with DefaultFirebaseOptions.web in firebase_options.dart.
importScripts(
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts(
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC4RWt5_I82rngZWVwjlAwFBKSYvONj0BA',
  appId: '1:387397605372:web:c3aa887c5c419d01e80479',
  messagingSenderId: '387397605372',
  projectId: 'campusengine-d1168',
  authDomain: 'campusengine-d1168.firebaseapp.com',
  storageBucket: 'campusengine-d1168.firebasestorage.app',
});

const messaging = firebase.messaging();

// Show background/terminated push notifications.
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'CampusEngine', {
    body: n.body || '',
    icon: '/icons/Icon-192.png',
    data: payload.data || {},
  });
});

// Focus/open the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
      clients.matchAll({type: 'window', includeUncontrolled: true}).then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/');
      }));
});
