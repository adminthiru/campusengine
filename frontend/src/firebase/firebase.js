// Firebase web app initialization + messaging (FCM).
import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC4RWt5_I82rngZWVwjlAwFBKSYvONj0BA",
  authDomain: "campusengine-d1168.firebaseapp.com",
  projectId: "campusengine-d1168",
  storageBucket: "campusengine-d1168.firebasestorage.app",
  messagingSenderId: "387397605372",
  appId: "1:387397605372:web:c3aa887c5c419d01e80479"
};

export const app = initializeApp(firebaseConfig);

// Messaging only works where Service Workers + Notifications are supported
// (https or localhost). Resolves to null elsewhere so callers can no-op safely.
export const messagingPromise = isSupported()
  .then((ok) => (ok ? getMessaging(app) : null))
  .catch(() => null);
