import * as cache from "../store/cache.js";
import { CATEGORIES, getCategoryById } from "../data/categories.js";
import { formatUSD, roundCents } from "../core/money.js";
import { getBudgetVsActual, getBudgetSummary } from "../reports/budgetCompare.js";
import { createBarChart, destroyChart, PALETTE } from "../charts/chartFactory.js";
import { showToast } from "../utils/toast.js";

const CHART_ID = "budget-vs-actual-chart";

let selectedMonth = currentMonth();
let draft = { total: 0, allocations: {} };
let unsubscribe = null;

export function initBudgetView() {
  return {
    onActivate() {
      resetDraft();
      render();
      unsubscribe = cache.subscribe(render);
    },
    onDeactivate() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      destroyChart(CHART_ID);
    },
  };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function resetDraft() {
  const { budgets } = cache.getSettings();
  const existing = budgets[selectedMonth];
  draft = {
    total: existing?.total || 0,
    allocations: { ...(existing?.allocations || {}) },
  };
}

function render() {
  const section = document.getElementById("view-budget");
  if (!section) return;

  const expenses = cache.getExpenses({ month: selectedMonth });
  const rows = getBudgetVsActual(expenses, draft, selectedMonth);
  const allRows = CATEGORIES.filter((c) => c.id !== "other" || rows.some((r) => r.categoryId === "other")).map((c) => {
    const existing = rows.find((r) => r.categoryId === c.id);
    return (
      existing || {
        categoryId: c.id,
        allocation: roundCents(draft.allocations[c.id] || 0),
        actual: 0,
        remaining: roundCents(draft.allocations[c.id] || 0),
        overBudget: false,
        pct: 0,
      }
    );
  });
  const summary = getBudgetSummary(expenses, draft, selectedMonth);

  section.innerHTML = `
    <div class="view-header">
      <h2>Budget Planner</h2>
      <div class="controls">
        <label class="text-muted">Month</label>
        <input type="month" id="budget-month" value="${selectedMonth}" />
      </div>
    </div>

    <div class="stat-grid">
      <div class="card">
        <div class="card-title">Total Monthly Budget</div>
        <input type="number" id="budget-total" min="0" step="0.01" value="${draft.total || ""}" style="font-size:1.4rem;font-weight:700;border:none;width:100%;padding:0" />
      </div>
      <div class="card">
        <div class="card-title">Total Spent</div>
        <div class="card-value">${formatUSD(summary.totalSpent)}</div>
      </div>
      <div class="card">
        <div class="card-title">${summary.remaining < 0 ? "Over Budget" : "Remaining"}</div>
        <div class="card-value ${summary.remaining < 0 ? "neg" : ""}">${summary.remaining < 0 ? `Over by ${formatUSD(Math.abs(summary.remaining))}` : formatUSD(summary.remaining)}</div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Category</th><th class="num">Allocation</th><th>Progress</th><th class="num">Spent</th><th class="num">Left / Over</th></tr></thead>
        <tbody>
          ${allRows.map((r) => budgetRowHTML(r)).join("")}
        </tbody>
      </table>
    </div>

    <div class="chart-card">
      <h3>Budget vs Actual</h3>
      <div class="chart-container"><canvas id="${CHART_ID}"></canvas></div>
    </div>

    <div class="modal-actions" style="justify-content:flex-start">
      <button class="btn btn-primary" id="btn-save-budget" type="button">Save Budget</button>
    </div>
  `;

  wireEvents(section, allRows);

  const chartRows = allRows.filter((r) => r.allocation > 0 || r.actual > 0);
  createBarChart(CHART_ID, {
    labels: chartRows.map((r) => getCategoryById(r.categoryId).name),
    datasets: [
      { label: "Planned", data: chartRows.map((r) => r.allocation), color: PALETTE.blue },
      { label: "Actual", data: chartRows.map((r) => r.actual), color: PALETTE.orange },
    ],
  });
}

function budgetRowHTML(r) {
  const cat = getCategoryById(r.categoryId);
  const pctClamped = Math.min(100, r.pct);
  const fillClass = r.overBudget ? "over" : r.pct >= 80 ? "warn" : "";
  return `
    <tr data-category="${r.categoryId}">
      <td><span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
      <td class="num"><input type="number" class="cell-input alloc-input" min="0" step="0.01" data-category="${r.categoryId}" value="${r.allocation || ""}" /></td>
      <td style="min-width:140px">
        <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${pctClamped}%"></div></div>
      </td>
      <td class="num">${formatUSD(r.actual)}</td>
      <td class="num ${r.overBudget ? "neg" : ""}">${r.overBudget ? `Over by ${formatUSD(Math.abs(r.remaining))}` : formatUSD(r.remaining)}</td>
    </tr>`;
}

function wireEvents(section) {
  section.querySelector("#budget-month").addEventListener("change", (e) => {
    selectedMonth = e.target.value;
    resetDraft();
    render();
  });
  section.querySelector("#budget-total").addEventListener("input", (e) => {
    draft.total = Number(e.target.value) || 0;
  });
  section.querySelectorAll(".alloc-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const catId = e.target.dataset.category;
      draft.allocations[catId] = Number(e.target.value) || 0;
      render();
      // Re-focus the same input since the whole table re-renders on each keystroke.
      const el = document.querySelector(`.alloc-input[data-category="${catId}"]`);
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  });
  section.querySelector("#btn-save-budget").addEventListener("click", saveBudget);
}

function saveBudget() {
  const { budgets } = cache.getSettings();
  const cleanedAllocations = {};
  for (const [catId, amount] of Object.entries(draft.allocations)) {
    const n = roundCents(Number(amount) || 0);
    if (n > 0) cleanedAllocations[catId] = n;
  }
  const merged = { ...budgets, [selectedMonth]: { total: roundCents(draft.total || 0), allocations: cleanedAllocations } };
  cache.updateSettings({ budgets: merged });
  showToast("Budget saved", "success");
}
