import { renderPlaceholder } from "../utils/placeholder.js";

export function initPaymentCyclesView() {
  return {
    onActivate() {
      renderPlaceholder("payment-cycles", "🔁", "Payment Cycles", "Coming in Milestone 5.");
    },
  };
}
