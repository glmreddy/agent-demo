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
  apiKey: "PLACEHOLDER_GET_FROM_FIREBASE_CONSOLE",
  authDomain: "PLACEHOLDER.firebaseapp.com",
  projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER.appspot.com",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER",
};

export const isFirebaseConfigured = () =>
  !Object.values(firebaseConfig).some((v) => String(v).startsWith("PLACEHOLDER"));

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
