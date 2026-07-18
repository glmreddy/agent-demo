import * as cache from "../store/cache.js";
import { CATEGORIES, getCategoryById } from "../data/categories.js";
import { getCurrentFY, getYearsInData, getFYMonths, monthAbbrOnly } from "../core/fy.js";
import { formatUSD, roundCents } from "../core/money.js";
import { openModal, confirmDialog } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";

let selectedFY = getCurrentFY();
let draft = []; // [{id, category, subCategory, details, months:{"YYYY-MM":amount}, dirty, isNew}]
let unsubscribe = null;

export function initPaymentCyclesView() {
  return {
    onActivate() {
      resetDraft();
      render();
      unsubscribe = cache.subscribe(() => {
        if (!draft.some((r) => r.dirty || r.isNew)) resetDraft();
        render();
      });
    },
    onDeactivate() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
    },
  };
}

function resetDraft() {
  const { paymentCycles } = cache.getSettings();
  const rows = paymentCycles[String(selectedFY)] || [];
  draft = rows.map((r) => ({ ...r, months: { ...r.months }, dirty: false, isNew: false }));
}

function fyOptions() {
  const { paymentCycles } = cache.getSettings();
  const years = new Set(getYearsInData(cache.getExpenses().map((e) => e.date)));
  Object.keys(paymentCycles).forEach((y) => years.add(Number(y)));
  const sorted = Array.from(years).sort((a, b) => b - a);
  if (!sorted.includes(selectedFY)) selectedFY = sorted[0];
  return sorted.map((y) => `<option value="${y}" ${y === selectedFY ? "selected" : ""}>${y}</option>`).join("");
}

function render() {
  const section = document.getElementById("view-payment-cycles");
  if (!section) return;

  const months = getFYMonths(selectedFY);
  const hasUnsaved = draft.some((r) => r.dirty || r.isNew);
  const groups = CATEGORIES.map((c) => ({ category: c, rows: draft.filter((r) => r.category === c.id) })).filter(
    (g) => g.rows.length > 0
  );

  const colTotals = {};
  for (const m of months) {
    colTotals[m] = roundCents(draft.reduce((acc, r) => acc + (Number(r.months[m]) || 0), 0));
  }
  const grandTotal = roundCents(Object.values(colTotals).reduce((a, b) => a + b, 0));

  section.innerHTML = `
    <div class="view-header">
      <h2>Payment Cycles</h2>
      <div class="controls">
        <label class="text-muted">Financial Year</label>
        <select id="pay-fy">${fyOptions()}</select>
        <button class="btn" id="btn-add-cycle" type="button">+ Add Row</button>
        <button class="btn btn-primary" id="btn-save-cycles" type="button" ${hasUnsaved ? "" : "disabled"}>Save${hasUnsaved ? " Changes" : "d"}</button>
      </div>
    </div>
    <p class="text-muted">Track recurring payments (EMIs, subscriptions, salaries) month over month for FY ${selectedFY}.</p>

    ${
      groups.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🔁</div><h2>No payment cycles yet</h2><p>Add a recurring EMI, subscription, or salary row.</p></div>`
        : `<div class="table-wrap">
            <table class="crosstab">
              <thead><tr>
                <th>Sub-Category</th><th>Details</th>
                ${months.map((m) => `<th class="num">${monthAbbrOnly(m)}</th>`).join("")}
                <th class="num">Total</th><th></th>
              </tr></thead>
              ${groups.map((g) => groupHTML(g, months)).join("")}
              <tfoot>
                <tr>
                  <td colspan="2">Grand Total</td>
                  ${months.map((m) => `<td class="num">${formatUSD(colTotals[m])}</td>`).join("")}
                  <td class="num">${formatUSD(grandTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>`
    }
  `;

  wireEvents(section, months);
}

function groupHTML(group, months) {
  const subtotal = {};
  for (const m of months) {
    subtotal[m] = roundCents(group.rows.reduce((acc, r) => acc + (Number(r.months[m]) || 0), 0));
  }
  const subtotalSum = roundCents(Object.values(subtotal).reduce((a, b) => a + b, 0));

  return `
    <tbody data-category-group="${group.category.id}">
      <tr><td colspan="${months.length + 4}" style="background:${group.category.color}14;font-weight:700;color:${group.category.color}">${group.category.icon} ${group.category.name}</td></tr>
      ${group.rows.map((r) => rowHTML(r, months)).join("")}
      <tr class="subtotal-row">
        <td colspan="2">Subtotal</td>
        ${months.map((m) => `<td class="num">${formatUSD(subtotal[m])}</td>`).join("")}
        <td class="num">${formatUSD(subtotalSum)}</td>
        <td></td>
      </tr>
    </tbody>`;
}

function rowHTML(r, months) {
  return `
    <tr data-id="${r.id}">
      <td><input type="text" class="cell-input row-subcat" style="width:100%;text-align:left" value="${escapeAttr(r.subCategory)}" placeholder="e.g. Car Loan" /></td>
      <td><input type="text" class="cell-input row-details" style="width:100%;text-align:left" value="${escapeAttr(r.details)}" placeholder="Details" /></td>
      ${months
        .map(
          (m) =>
            `<td class="num"><input type="number" class="cell-input row-month" min="0" step="0.01" data-month="${m}" value="${r.months[m] || ""}" /></td>`
        )
        .join("")}
      <td class="num"><strong>${formatUSD(months.reduce((acc, m) => acc + (Number(r.months[m]) || 0), 0))}</strong></td>
      <td><button class="btn btn-sm btn-icon btn-outline-danger btn-delete-cycle" type="button" title="Delete">🗑️</button></td>
    </tr>`;
}

function wireEvents(section, months) {
  section.querySelector("#pay-fy").addEventListener("change", (e) => {
    selectedFY = Number(e.target.value);
    resetDraft();
    render();
  });

  section.querySelector("#btn-add-cycle").addEventListener("click", () => openAddCycleModal());
  section.querySelector("#btn-save-cycles").addEventListener("click", saveAll);

  section.querySelectorAll("tbody[data-category-group] tr[data-id]").forEach((row) => {
    const id = row.dataset.id;
    const item = draft.find((r) => r.id === id);
    if (!item) return;

    row.querySelector(".row-subcat").addEventListener("input", (e) => {
      item.subCategory = e.target.value;
      if (!item.isNew) item.dirty = true;
      updateSaveButton(section);
    });
    row.querySelector(".row-details").addEventListener("input", (e) => {
      item.details = e.target.value;
      if (!item.isNew) item.dirty = true;
      updateSaveButton(section);
    });
    row.querySelectorAll(".row-month").forEach((input) => {
      input.addEventListener("input", (e) => {
        item.months[e.target.dataset.month] = Number(e.target.value) || 0;
        if (!item.isNew) item.dirty = true;
        updateRowTotal(row, item, months);
        updateSaveButton(section);
      });
    });
    row.querySelector(".btn-delete-cycle").addEventListener("click", async () => {
      if (!confirmDialog("Delete this payment cycle row?")) return;
      draft = draft.filter((r) => r.id !== id);
      if (!item.isNew) await persistDraftToSettings();
      render();
    });
  });
}

function updateRowTotal(rowEl, item, months) {
  const total = months.reduce((acc, m) => acc + (Number(item.months[m]) || 0), 0);
  const totalCell = rowEl.children[rowEl.children.length - 2];
  totalCell.innerHTML = `<strong>${formatUSD(total)}</strong>`;
}

function updateSaveButton(section) {
  const btn = section.querySelector("#btn-save-cycles");
  const hasUnsaved = draft.some((r) => r.dirty || r.isNew);
  btn.disabled = !hasUnsaved;
  btn.textContent = hasUnsaved ? "Save Changes" : "Saved";
}

function openAddCycleModal() {
  const { body, close } = openModal({
    title: "Add Payment Cycle",
    bodyHTML: `
      <form id="cycle-form">
        <div class="form-row">
          <label for="cycle-category">Category</label>
          <select id="cycle-category">${CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("")}</select>
        </div>
        <div class="form-row">
          <label for="cycle-subcat">Sub-Category</label>
          <input id="cycle-subcat" type="text" required placeholder="e.g. Car Loan" />
        </div>
        <div class="form-row">
          <label for="cycle-details">Details</label>
          <input id="cycle-details" type="text" placeholder="Optional notes" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" id="cycle-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Row</button>
        </div>
      </form>`,
  });

  body.querySelector("#cycle-cancel").addEventListener("click", close);
  body.querySelector("#cycle-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const category = body.querySelector("#cycle-category").value;
    const subCategory = body.querySelector("#cycle-subcat").value.trim();
    const details = body.querySelector("#cycle-details").value.trim();
    if (!subCategory) return;

    draft.unshift({
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      category,
      subCategory,
      details,
      months: {},
      dirty: false,
      isNew: true,
    });
    close();
    render();
  });
}

async function persistDraftToSettings() {
  const { paymentCycles } = cache.getSettings();
  const cleaned = draft.map(({ dirty, isNew, ...rest }) => {
    const months = {};
    for (const [m, v] of Object.entries(rest.months)) {
      const n = roundCents(Number(v) || 0);
      if (n > 0) months[m] = n;
    }
    return { ...rest, months };
  });
  const merged = { ...paymentCycles, [String(selectedFY)]: cleaned };
  cache.updateSettings({ paymentCycles: merged });
}

async function saveAll() {
  await persistDraftToSettings();
  draft = draft.map((r) => ({ ...r, dirty: false, isNew: false }));
  showToast("Payment cycles saved", "success");
  render();
}

function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}
