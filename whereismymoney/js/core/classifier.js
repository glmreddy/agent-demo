import { CATEGORIES, OTHER_CATEGORY_ID } from "../data/categories.js";

/**
 * Classify a transaction description into a category id.
 *
 * FR-CLS-1: pure function of (description, mappingTable) — same input always
 * yields the same output, no hidden state.
 *
 * Precedence (FR-CLS-4):
 *   1. User mapping table — case-insensitive substring match, first match in
 *      table order wins. Lets the user override the built-in classifier.
 *   2. Built-in keyword rules — case-insensitive substring match, category
 *      array order = precedence, first match wins.
 *   3. Fallback — "other" (FR-CLS-5: every transaction gets exactly one
 *      category).
 *
 * @param {string} description
 * @param {{keyword: string, category: string}[]} userMappings
 * @returns {string} category id
 */
export function classify(description, userMappings = []) {
  const text = String(description || "").toLowerCase();
  if (!text.trim()) return OTHER_CATEGORY_ID;

  for (const mapping of userMappings) {
    const kw = String(mapping.keyword || "").toLowerCase().trim();
    if (kw && text.includes(kw)) return mapping.category;
  }

  for (const category of CATEGORIES) {
    for (const kw of category.keywords) {
      if (text.includes(kw.toLowerCase())) return category.id;
    }
  }

  return OTHER_CATEGORY_ID;
}
