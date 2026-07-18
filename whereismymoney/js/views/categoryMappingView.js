import { CATEGORIES } from "../data/categories.js";
import * as cache from "../store/cache.js";
import { confirmDialog } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";

let draft = []; // [{id, keyword, category, dirty, isNew}]
let searchTerm = "";
let unsubscribe = null;

export function initCategoryMappingView() {
  return {
    onActivate() {
      resetDraftFromCache();
      render();
      unsubscribe = cache.subscribe(() => {
        // Only re-sync from cache when nothing is being edited locally, so
        // an in-flight edit isn't clobbered by an unrelated cache update.
        if (!draft.some((r) => r.dirty || r.isNew)) resetDraftFromCache();
        render();
      });
    },
    onDeactivate() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
    },
  };
}

function resetDraftFromCache() {
  draft = cache.getCategoryMappings().map((m) => ({ ...m, dirty: false, isNew: false }));
}

function categorySelect(selected) {
  return CATEGORIES.map(
    (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${c.name}</option>`
  ).join("");
}

function render() {
  const section = document.getElementById("view-category-mapping");
  if (!section) return;

  const hasUnsaved = draft.some((r) => r.dirty || r.isNew);
  const visible = draft.filter((r) =>
    !searchTerm || r.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  section.innerHTML = `
    <div class="view-header">
      <h2>Category Mapping</h2>
      <div class="controls">
        <button id="btn-seed" class="btn" type="button">Seed from Transactions</button>
        <button id="btn-add-rule" class="btn" type="button">+ Add Rule</button>
        <button id="btn-save-mapping" class="btn btn-primary" type="button" ${hasUnsaved ? "" : "disabled"}>
          Save${hasUnsaved ? " Changes" : "d"}
        </button>
      </div>
    </div>
    <p class="text-muted">User rules take priority over the built-in keyword classifier. Matching is a case-insensitive substring against the transaction description.</p>

    <div class="filters-bar">
      <input id="mapping-search" type="text" placeholder="Search keywords…" value="${escapeAttr(searchTerm)}" />
      <span class="text-muted">${visible.length} rule${visible.length === 1 ? "" : "s"}</span>
    </div>

    ${
      visible.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🏷️</div><h2>No mapping rules yet</h2><p>Add a rule, or seed rules from your existing transactions.</p></div>`
        : tableHTML(visible)
    }
  `;

  wireEvents(section);
}

function tableHTML(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Keyword</th><th>Category</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr data-id="${r.id}">
              <td><input type="text" class="cell-input mapping-keyword" style="width:100%;text-align:left" value="${escapeAttr(r.keyword)}" placeholder="e.g. starbucks" /></td>
              <td><select class="mapping-category">${categorySelect(r.category)}</select></td>
              <td><button class="btn btn-sm btn-icon btn-outline-danger btn-delete-rule" type="button" title="Delete">🗑️</button></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function wireEvents(section) {
  section.querySelector("#btn-add-rule").addEventListener("click", () => {
    draft.unshift({ id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`, keyword: "", category: CATEGORIES[0].id, dirty: false, isNew: true });
    render();
    section.querySelector(".mapping-keyword")?.focus();
  });

  section.querySelector("#btn-seed").addEventListener("click", seedFromTransactions);

  section.querySelector("#btn-save-mapping").addEventListener("click", saveAll);

  let searchTimer;
  section.querySelector("#mapping-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value;
    searchTimer = setTimeout(() => {
      searchTerm = value;
      render();
      const input = document.getElementById("mapping-search");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 200);
  });

  section.querySelectorAll("tbody tr").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector(".mapping-keyword").addEventListener("input", (e) => {
      const item = draft.find((r) => r.id === id);
      if (item) {
        item.keyword = e.target.value;
        if (!item.isNew) item.dirty = true;
        updateSaveButtonState(section);
      }
    });
    row.querySelector(".mapping-category").addEventListener("change", (e) => {
      const item = draft.find((r) => r.id === id);
      if (item) {
        item.category = e.target.value;
        if (!item.isNew) item.dirty = true;
        updateSaveButtonState(section);
      }
    });
    row.querySelector(".btn-delete-rule").addEventListener("click", () => {
      if (!confirmDialog("Delete this mapping rule?")) return;
      const item = draft.find((r) => r.id === id);
      draft = draft.filter((r) => r.id !== id);
      if (item && !item.isNew) {
        cache.deleteCategoryMapping(id);
        showToast("Rule deleted", "success");
      }
      render();
    });
  });
}

function updateSaveButtonState(section) {
  const btn = section.querySelector("#btn-save-mapping");
  const hasUnsaved = draft.some((r) => r.dirty || r.isNew);
  btn.disabled = !hasUnsaved;
  btn.textContent = hasUnsaved ? "Save Changes" : "Saved";
}

function saveAll() {
  const seen = new Set();
  for (const row of draft) {
    const keyword = row.keyword.trim();
    if (!keyword) continue;
    seen.add(row.id);
    if (row.isNew) {
      const newId = cache.addCategoryMapping({ keyword, category: row.category });
      row.id = newId;
      row.isNew = false;
      row.dirty = false;
    } else if (row.dirty) {
      cache.updateCategoryMapping(row.id, { keyword, category: row.category });
      row.dirty = false;
    }
  }
  draft = draft.filter((r) => r.keyword.trim());
  showToast("Category mapping saved", "success");
  render();
}

function seedFromTransactions() {
  const existingKeywords = draft.map((r) => r.keyword.toLowerCase()).filter(Boolean);
  const expenses = cache.getExpenses();
  const seenDescriptions = new Set();
  let count = 0;

  for (const expense of expenses) {
    const desc = (expense.description || "").trim();
    if (!desc) continue;
    const lower = desc.toLowerCase();
    if (seenDescriptions.has(lower)) continue;
    seenDescriptions.add(lower);

    // Skip duplicates: don't add if an existing (or already-seeded) keyword
    // already matches this description.
    const alreadyCovered = existingKeywords.some((kw) => lower.includes(kw));
    if (alreadyCovered) continue;

    draft.unshift({
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}_${count}`,
      keyword: desc,
      category: expense.category,
      dirty: false,
      isNew: true,
    });
    existingKeywords.push(lower);
    count++;
  }

  render();
  showToast(count > 0 ? `Seeded ${count} rule(s) from transactions. Review and Save.` : "Nothing new to seed.", count > 0 ? "success" : "info");
}

function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}
