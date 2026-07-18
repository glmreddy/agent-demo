import { renderPlaceholder } from "../utils/placeholder.js";

export function initDashboardView() {
  return {
    onActivate() {
      renderPlaceholder("dashboard", "📊", "Dashboard", "Coming in Milestone 4.");
    },
  };
}
