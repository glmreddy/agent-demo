import { signOutUser } from "../auth.js";

export function renderUser(user) {
  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const avatarEl = document.getElementById("user-avatar");

  nameEl.textContent = user.displayName || "Signed in";
  emailEl.textContent = user.email || "";

  if (user.photoURL) {
    avatarEl.src = user.photoURL;
    avatarEl.alt = user.displayName || "";
    avatarEl.hidden = false;
  } else {
    avatarEl.hidden = true;
  }
}

export function initShell() {
  document.getElementById("btn-signout").addEventListener("click", async () => {
    await signOutUser();
  });
}
