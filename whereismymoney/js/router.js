const views = new Map(); // name -> { onActivate, onDeactivate }
let currentView = null;

export function registerView(name, handlers = {}) {
  views.set(name, {
    onActivate: handlers.onActivate || (() => {}),
    onDeactivate: handlers.onDeactivate || (() => {}),
  });
}

export function getCurrentView() {
  return currentView;
}

export function navigateTo(name) {
  if (!views.has(name)) {
    console.warn(`No view registered for "${name}"`);
    return;
  }
  if (currentView === name) return;

  if (currentView && views.has(currentView)) {
    views.get(currentView).onDeactivate();
  }

  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach((el) => el.classList.remove("active"));

  const section = document.getElementById(`view-${name}`);
  if (section) section.classList.add("active");
  const navBtn = document.querySelector(`.nav-link[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add("active");

  currentView = name;
  views.get(name).onActivate();

  // Collapse the mobile nav after a selection.
  document.getElementById("app-nav")?.classList.remove("open");
}

export function initNav() {
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.view));
  });
  document.getElementById("btn-nav-toggle")?.addEventListener("click", () => {
    document.getElementById("app-nav")?.classList.toggle("open");
  });
}
