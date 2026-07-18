import { renderPlaceholder } from "../utils/placeholder.js";

export function initTransactionsView() {
  return {
    onActivate() {
      renderPlaceholder("transactions", "🧾", "Transactions", "Coming in Milestone 2.");
    },
  };
}
