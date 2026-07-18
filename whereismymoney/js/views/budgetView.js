import { renderPlaceholder } from "../utils/placeholder.js";

export function initBudgetView() {
  return {
    onActivate() {
      renderPlaceholder("budget", "🎯", "Budget Planner", "Coming in Milestone 5.");
    },
  };
}
