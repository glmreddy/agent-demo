import { CATEGORIES, getCategoryById } from "../data/categories.js";
import { classify } from "../core/classifier.js";
import { formatUSD, sum } from "../core/money.js";
import { getCurrentFY, getYearsInData } from "../core/fy.js";
import * as cache from "../store/cache.js";
import { openModal, confirmDialog } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";

const filters = {
  fy: "",
  from: "",
  to: "",
  search: "",
  category: "",
};

let unsubscribe = null;

export function initTransactionsView() {
  return {
    onActivate() {
      render();
      unsubscribe = cache.subscribe(render);
    },
    onDeactivate() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
    },
  };
}

function categoryOptions(selected) {
  return (
    `<option value="">All categories</option>` +
    CATEGORIES.map(
      (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${c.name}</option>`
    ).join("")
  );
}

function fyOptions(selected) {
  const years = getYearsInData(cache.getExpenses().map((e) => e.date));
  return (
    `<option value="">All years</option>` +
    years.map((y) => `<option value="${y}" ${String(y) === String(selected) ? "selected" : ""}>${y}</option>`).join("")
  );
}

function badge(categoryId) {
  const cat = getCategoryById(categoryId);
  return `<span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span>`;
}

function render() {
  const section = document.getElementById("view-transactions");
  if (!section) return;

  const rows = cache.getExpenses({
    fy: filters.fy || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    search: filters.search || undefined,
    category: filters.category || undefined,
  });
  const total = sum(rows.map((r) => r.amount));

  section.innerHTML = `
    <div class="view-header">
      <h2>Transactions</h2>
      <div class="controls">
        <button id="btn-add-txn" class="btn btn-primary" type="button">+ Add Transaction</button>
      </div>
    </div>

    <div class="filters-bar">
      <select id="f-fy">${fyOptions(filters.fy)}</select>
      <input id="f-from" type="date" value="${filters.from}" title="From date" />
      <input id="f-to" type="date" value="${filters.to}" title="To date" />
      <input id="f-search" type="text" placeholder="Search description…" value="${escapeAttr(filters.search)}" />
      <select id="f-category">${categoryOptions(filters.category)}</select>
      <span class="text-muted">${rows.length} transaction${rows.length === 1 ? "" : "s"} · <strong>${formatUSD(total)}</strong></span>
    </div>

    ${rows.length === 0 ? emptyState() : tableHTML(rows)}
  `;

  wireFilters(section);
  wireTableActions(section);
  document.getElementById("btn-add-txn").addEventListener("click", () => openTransactionModal());
}

function emptyState() {
  return `<div class="empty-state"><div class="empty-icon">🧾</div><h2>No transactions</h2><p>Add one manually or import a statement.</p></div>`;
}

function tableHTML(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>#</th><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th></th>
        </tr></thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `
            <tr data-id="${r.id}">
              <td>${i + 1}</td>
              <td>${r.date}</td>
              <td>${escapeHTML(r.description)}</td>
              <td>${badge(r.category)}</td>
              <td class="num">${formatUSD(r.amount)}</td>
              <td>
                <button class="btn btn-sm btn-icon btn-edit" type="button" title="Edit">✏️</button>
                <button class="btn btn-sm btn-icon btn-outline-danger btn-delete" type="button" title="Delete">🗑️</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function wireFilters(section) {
  section.querySelector("#f-fy").addEventListener("change", (e) => {
    filters.fy = e.target.value;
    render();
  });
  section.querySelector("#f-from").addEventListener("change", (e) => {
    filters.from = e.target.value;
    render();
  });
  section.querySelector("#f-to").addEventListener("change", (e) => {
    filters.to = e.target.value;
    render();
  });
  section.querySelector("#f-category").addEventListener("change", (e) => {
    filters.category = e.target.value;
    render();
  });
  let searchTimer;
  section.querySelector("#f-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value;
    searchTimer = setTimeout(() => {
      filters.search = value;
      render();
      // Restore focus + caret since the whole table (including this input) re-renders.
      const input = document.getElementById("f-search");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 250);
  });
}

function wireTableActions(section) {
  section.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      const txn = cache.getState().expenses.get(id);
      if (txn) openTransactionModal(txn);
    });
  });
  section.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      if (confirmDialog("Delete this transaction? This can't be undone.")) {
        cache.deleteExpense(id);
        showToast("Transaction deleted", "success");
      }
    });
  });
}

function openTransactionModal(existing) {
  const isEdit = !!existing;
  const { body, close } = openModal({
    title: isEdit ? "Edit Transaction" : "Add Transaction",
    bodyHTML: `
      <form id="txn-form">
        <div class="form-row">
          <label for="txn-date">Date</label>
          <input id="txn-date" type="date" value="${existing?.date || todayISO()}" required />
        </div>
        <div class="form-row">
          <label for="txn-desc">Description</label>
          <input id="txn-desc" type="text" value="${escapeAttr(existing?.description || "")}" required />
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label for="txn-amount">Amount ($)</label>
            <input id="txn-amount" type="number" step="0.01" min="0" value="${existing?.amount ?? ""}" required />
          </div>
          <div class="form-row">
            <label for="txn-category">Category</label>
            <select id="txn-category">
              ${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === existing?.category ? "selected" : ""}>${c.icon} ${c.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <p id="txn-form-error" class="field-error" hidden></p>
        <div class="modal-actions">
          <button type="button" class="btn" id="txn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Add Transaction"}</button>
        </div>
      </form>`,
  });

  body.querySelector("#txn-cancel").addEventListener("click", close);

  // Auto-suggest a category as the user types a description, but don't
  // fight a category the user has already picked manually.
  let categoryTouched = isEdit;
  body.querySelector("#txn-category").addEventListener("change", () => {
    categoryTouched = true;
  });
  body.querySelector("#txn-desc").addEventListener("input", (e) => {
    if (categoryTouched) return;
    const suggested = classify(e.target.value, cache.getCategoryMappings());
    body.querySelector("#txn-category").value = suggested;
  });

  body.querySelector("#txn-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = body.querySelector("#txn-date").value;
    const description = body.querySelector("#txn-desc").value.trim();
    const amount = Number(body.querySelector("#txn-amount").value);
    const category = body.querySelector("#txn-category").value;
    const errorEl = body.querySelector("#txn-form-error");

    if (!date || !description || Number.isNaN(amount)) {
      errorEl.textContent = "Date, description, and amount are required.";
      errorEl.hidden = false;
      return;
    }
    if (amount < 0) {
      errorEl.textContent = "Amount can't be negative.";
      errorEl.hidden = false;
      return;
    }

    if (isEdit) {
      cache.updateExpense(existing.id, { date, description, amount, category });
      showToast("Transaction updated", "success");
    } else {
      cache.addExpense({ date, description, amount, category, sourceId: "manual" });
      showToast("Transaction added", "success");
    }
    close();
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}
