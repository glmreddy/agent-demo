export function renderPlaceholder(viewId, icon, title, desc) {
  const section = document.getElementById(`view-${viewId}`);
  if (!section) return;
  section.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h2>${title}</h2>
      <p>${desc}</p>
    </div>`;
}
