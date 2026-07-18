import { auth, googleProvider, isFirebaseConfigured } from "./firebase-config.js";
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

let currentUser = null;

/**
 * Wires Firebase auth-state persistence (FR-AUTH-4: a returning user stays
 * signed in across reloads without re-authenticating).
 * @param {(user: import("firebase/auth").User) => void} onLogin
 * @param {() => void} onLogout
 */
export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) onLogin(user);
    else onLogout();
  });
}

export function getCurrentUser() {
  return currentUser;
}

/** @returns {Promise<{ok: true} | {ok: false, message: string}>} */
export async function signIn() {
  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      message:
        "Firebase isn't configured yet. Add your project's credentials to js/firebase-config.js (see README).",
    };
  }
  try {
    await signInWithPopup(auth, googleProvider);
    return { ok: true };
  } catch (err) {
    console.error("Sign-in failed:", err);
    return { ok: false, message: friendlyAuthError(err) };
  }
}

export async function signOutUser() {
  await fbSignOut(auth);
}

function friendlyAuthError(err) {
  const code = err && err.code;
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Please allow popups for this site and try again.";
    case "auth/network-request-failed":
      return "Network error during sign-in. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in yet. Add it under Firebase Console → Authentication → Settings → Authorized domains.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
