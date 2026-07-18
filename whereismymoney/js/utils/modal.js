/**
 * Minimal reusable modal. Returns the modal body element (to query form
 * fields from) plus a close() function.
 */
export function openModal({ title, bodyHTML, onClose }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
    </div>`;
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKeydown);
    if (onClose) onClose();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".modal-close").addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);

  return { body: overlay.querySelector(".modal-body"), overlay, close };
}

export function confirmDialog(message) {
  return window.confirm(message);
}
