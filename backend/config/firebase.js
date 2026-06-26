const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');

// Initialise the Firebase Admin SDK for sending FCM push notifications.
// Credentials come from env (so nothing secret is committed):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the full key; \n escapes are handled)
// …or set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.
// If none are present the app still runs — push is just disabled (no crash).
let messaging = null;

(function initFirebase() {
  try {
    if (getApps().length) { messaging = admin.messaging(); return; }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
      messaging = admin.messaging();
      console.log('🔔 Firebase Admin initialized — push notifications enabled');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      messaging = admin.messaging();
      console.log('🔔 Firebase Admin initialized (application default credentials)');
    } else {
      console.warn('⚠️  Firebase Admin not configured — push notifications disabled. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.');
    }
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
})();

module.exports = {
  admin,
  getMessaging: () => messaging,
  isPushEnabled: () => !!messaging,
};
