// Initialise the Firebase Admin SDK for sending FCM push notifications.
// Uses the modular subpath imports (firebase-admin v13+ API).
// Credentials come from env (so nothing secret is committed):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the full key; \n escapes are handled)
// …or set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.
// If none are present the app still runs — push is just disabled (no crash).
const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getMessaging: adminGetMessaging } = require('firebase-admin/messaging');

let messaging = null;

(function initFirebase() {
  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        privateKey = privateKey.replace(/\\n/g, '\n');
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initializeApp({ credential: applicationDefault() });
      } else {
        console.warn('⚠️  Firebase Admin not configured — push notifications disabled. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.');
        return;
      }
    }
    messaging = adminGetMessaging();
    console.log('🔔 Firebase Admin initialized — push notifications enabled');
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
})();

module.exports = {
  getMessaging: () => messaging,
  isPushEnabled: () => !!messaging,
};
