import { renderPlaceholder } from "../utils/placeholder.js";

export function initCategoryMappingView() {
  return {
    onActivate() {
      renderPlaceholder("category-mapping", "🏷️", "Category Mapping", "Coming in Milestone 2.");
    },
  };
}
