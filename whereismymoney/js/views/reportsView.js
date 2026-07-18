import { renderPlaceholder } from "../utils/placeholder.js";

export function initReportsView() {
  return {
    onActivate() {
      renderPlaceholder("reports", "📈", "Income & Expense Reports", "Coming in Milestone 4.");
    },
  };
}
