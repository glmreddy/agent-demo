const CONTAINER_ID = "toast-container";

export function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .2s";
    setTimeout(() => el.remove(), 200);
  }, duration);
}

export function setSaving(isSaving) {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  el.hidden = !isSaving;
}
