import { signIn } from "../auth.js";

export function initLoginView() {
  const btn = document.getElementById("btn-google-signin");
  const errorEl = document.getElementById("login-error");
  const originalHTML = btn.innerHTML;

  btn.addEventListener("click", async () => {
    errorEl.hidden = true;
    btn.disabled = true;
    btn.innerHTML = "Signing in…";

    const result = await signIn();

    btn.disabled = false;
    btn.innerHTML = originalHTML;

    if (!result.ok) {
      errorEl.textContent = result.message;
      errorEl.hidden = false;
    }
    // On success, onAuthStateChanged (wired in app.js) handles the transition
    // to the app shell — nothing else to do here.
  });
}

export function showLoginScreen() {
  document.getElementById("view-login").style.display = "flex";
  document.getElementById("app-shell").hidden = true;
}

export function hideLoginScreen() {
  document.getElementById("view-login").style.display = "none";
  document.getElementById("app-shell").hidden = false;
}
