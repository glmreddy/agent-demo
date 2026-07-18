import { renderPlaceholder } from "../utils/placeholder.js";

export function initImportView() {
  return {
    onActivate() {
      renderPlaceholder("import", "📥", "Import Statements", "Coming in Milestone 3.");
    },
  };
}
