// ---------------------------------------------------------------------------
// Firebase project configuration.
//
// These are PLACEHOLDER values. The app will load and show the login screen,
// but Google sign-in will fail until you replace this object with the real
// config from your own Firebase project.
//
// See README.md → "Firebase setup" for exact steps (create project, enable
// Google sign-in, create a Firestore database, copy the web app config here).
//
// Note: a Firebase *web* config is not a secret — it's safe to ship in
// client-side code. Per-user data isolation is enforced by firestore.rules
// (deployed separately to your Firebase project), not by hiding this object.
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: "AIzaSyCNGIU92V6xRy4VHSPgdgvrwqKPshQHEjY",
  authDomain: "whereismymoney-firebase.firebaseapp.com",
  projectId: "whereismymoney-firebase",
  storageBucket: "whereismymoney-firebase.firebasestorage.app",
  messagingSenderId: "1011385302272",
  appId: "1:1011385302272:web:c8dcac1200dd8e8ebf07e5",
  measurementId: "G-JMZNQY6YW5"
};

export const isFirebaseConfigured = () =>
  !Object.values(firebaseConfig).some((v) => String(v).startsWith("PLACEHOLDER") || String(v).startsWith("YOUR_"));

// ---------------------------------------------------------------------------
// Firebase SDK init (v10 modular, loaded directly from the CDN as ES
// modules — no bundler/npm install needed). `auth` and `db` are shared
// singletons imported by auth.js and services/firestore.js.
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
