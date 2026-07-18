import * as cache from "../store/cache.js";
import { getCurrentFY, getYearsInData, monthAbbrOnly } from "../core/fy.js";
import { formatUSD, roundCents } from "../core/money.js";
import { getCategoryById } from "../data/categories.js";
import { getExpenseCrosstab, getIncomeCrosstab, getYoYExpenseComparison } from "../reports/aggregations.js";
import { createBarChart, destroyChart, PALETTE } from "../charts/chartFactory.js";
import { showToast } from "../utils/toast.js";

const YOY_CHART_ID = "reports-yoy-chart";

let activeTab = "expense";
let selectedFY = getCurrentFY();
let incomeDraft = null; // { "YYYY-MM": { salary, farm, mf, others } } for the selected FY only
let unsubscribe = null;

const SOURCE_LABELS = { salary: "Salary", farm: "Farm", mf: "Mutual Funds", others: "Others" };

export function initReportsView() {
  return {
    onActivate() {
      resetIncomeDraft();
      render();
      unsubscribe = cache.subscribe(() => {
        if (!isIncomeDirty()) resetIncomeDraft();
        render();
      });
    },
    onDeactivate() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      destroyChart(YOY_CHART_ID);
    },
  };
}

function resetIncomeDraft() {
  const { incomeData } = cache.getSettings();
  incomeDraft = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${selectedFY}-${String(m).padStart(2, "0")}`;
    incomeDraft[key] = { ...(incomeData[key] || {}) };
  }
}

function isIncomeDirty() {
  const { incomeData } = cache.getSettings();
  return Object.keys(incomeDraft).some((month) => {
    const saved = incomeData[month] || {};
    const draft = incomeDraft[month] || {};
    return ["salary", "farm", "mf", "others"].some((s) => (Number(saved[s]) || 0) !== (Number(draft[s]) || 0));
  });
}

function fyOptions() {
  const expenses = cache.getExpenses();
  const years = getYearsInData(expenses.map((e) => e.date));
  if (!years.includes(selectedFY)) selectedFY = years[0];
  return years.map((y) => `<option value="${y}" ${y === selectedFY ? "selected" : ""}>${y}</option>`).join("");
}

function render() {
  const section = document.getElementById("view-reports");
  if (!section) return;

  section.innerHTML = `
    <div class="view-header">
      <h2>Income &amp; Expense Reports</h2>
      <div class="controls">
        <button class="btn ${activeTab === "expense" ? "btn-primary" : ""}" id="tab-expense" type="button">Expense Report</button>
        <button class="btn ${activeTab === "income" ? "btn-primary" : ""}" id="tab-income" type="button">Income Report</button>
        <label class="text-muted">Financial Year</label>
        <select id="reports-fy">${fyOptions()}</select>
      </div>
    </div>
    <div id="reports-body"></div>
  `;

  section.querySelector("#tab-expense").addEventListener("click", () => { activeTab = "expense"; render(); });
  section.querySelector("#tab-income").addEventListener("click", () => { activeTab = "income"; render(); });
  section.querySelector("#reports-fy").addEventListener("change", (e) => {
    selectedFY = Number(e.target.value);
    resetIncomeDraft();
    render();
  });

  const body = document.getElementById("reports-body");
  if (activeTab === "expense") renderExpenseTab(body);
  else renderIncomeTab(body);
}

// ============================================================
// Expense crosstab + YoY chart
// ============================================================

function renderExpenseTab(container) {
  const expenses = cache.getExpenses();
  const crosstab = getExpenseCrosstab(expenses, selectedFY);
  const yoy = getYoYExpenseComparison(expenses, selectedFY);

  container.innerHTML = `
    <div class="chart-card">
      <h3>Year-on-Year Expense Comparison</h3>
      <div class="chart-container"><canvas id="${YOY_CHART_ID}"></canvas></div>
    </div>
    <div class="table-wrap">
      ${expenseCrosstabHTML(crosstab)}
    </div>
  `;

  createBarChart(YOY_CHART_ID, {
    labels: crosstab.months.map((m) => monthAbbrOnly(m)),
    datasets: [
      { label: `FY ${selectedFY}`, data: yoy.current, color: PALETTE.blue },
      { label: `FY ${selectedFY - 1}`, data: yoy.previous, color: PALETTE.mutedText },
    ],
  });
}

function expenseCrosstabHTML(crosstab) {
  if (crosstab.categoryIds.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">📊</div><h2>No expense data</h2><p>Add or import transactions for FY ${selectedFY}.</p></div>`;
  }
  const cell = (v) => (v > 0 ? `<td class="num">${formatUSD(v)}</td>` : `<td class="num cell-dash">—</td>`);

  return `
    <table class="crosstab">
      <thead><tr>
        <th>Category</th>
        ${crosstab.months.map((m) => `<th class="num">${monthAbbrOnly(m)}</th>`).join("")}
        <th class="num">Total</th>
      </tr></thead>
      <tbody>
        ${crosstab.categoryIds
          .map((id) => {
            const cat = getCategoryById(id);
            return `<tr>
              <td><span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
              ${crosstab.months.map((m) => cell(crosstab.cells[id]?.[m] || 0)).join("")}
              <td class="num"><strong>${formatUSD(crosstab.rowTotals[id])}</strong></td>
            </tr>`;
          })
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          ${crosstab.months.map((m) => `<td class="num">${formatUSD(crosstab.colTotals[m])}</td>`).join("")}
          <td class="num">${formatUSD(crosstab.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>`;
}

// ============================================================
// Income crosstab (editable)
// ============================================================

function renderIncomeTab(container) {
  const crosstab = getIncomeCrosstabFromDraft();

  container.innerHTML = `
    <div class="table-wrap">
      <table class="crosstab">
        <thead><tr>
          <th>Source</th>
          ${crosstab.months.map((m) => `<th class="num">${monthAbbrOnly(m)}</th>`).join("")}
          <th class="num">Total</th>
        </tr></thead>
        <tbody>
          ${crosstab.sources
            .map(
              (s) => `<tr data-source="${s}">
                <td>${SOURCE_LABELS[s]}</td>
                ${crosstab.months
                  .map(
                    (m) =>
                      `<td class="num"><input type="number" step="0.01" min="0" class="cell-input income-cell" data-month="${m}" data-source="${s}" value="${incomeDraft[m]?.[s] || ""}" /></td>`
                  )
                  .join("")}
                <td class="num" id="row-total-${s}"><strong>${formatUSD(crosstab.rowTotals[s])}</strong></td>
              </tr>`
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            ${crosstab.months.map((m) => `<td class="num" id="col-total-${m}">${formatUSD(crosstab.colTotals[m])}</td>`).join("")}
            <td class="num" id="grand-total">${formatUSD(crosstab.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="modal-actions" style="justify-content:flex-start">
      <button class="btn btn-primary" id="btn-save-income" type="button">Save Income</button>
    </div>
  `;

  container.querySelectorAll(".income-cell").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { month, source } = e.target.dataset;
      const value = e.target.value === "" ? 0 : Number(e.target.value);
      incomeDraft[month] = incomeDraft[month] || {};
      incomeDraft[month][source] = value;
      recalcIncomeTotals(container);
    });
  });

  container.querySelector("#btn-save-income").addEventListener("click", () => saveIncome());
}

function getIncomeCrosstabFromDraft() {
  return getIncomeCrosstab(incomeDraft, selectedFY);
}

function recalcIncomeTotals(container) {
  const crosstab = getIncomeCrosstabFromDraft();
  for (const s of crosstab.sources) {
    const el = container.querySelector(`#row-total-${s}`);
    if (el) el.innerHTML = `<strong>${formatUSD(crosstab.rowTotals[s])}</strong>`;
  }
  for (const m of crosstab.months) {
    const el = container.querySelector(`#col-total-${m}`);
    if (el) el.textContent = formatUSD(crosstab.colTotals[m]);
  }
  const grand = container.querySelector("#grand-total");
  if (grand) grand.textContent = formatUSD(crosstab.grandTotal);
}

function saveIncome() {
  const { incomeData } = cache.getSettings();
  const merged = { ...incomeData };

  for (const [month, row] of Object.entries(incomeDraft)) {
    const cleaned = {};
    for (const [source, value] of Object.entries(row)) {
      const n = roundCents(Number(value) || 0);
      if (n > 0) cleaned[source] = n; // empty/zero cells are not stored (FR-INC-3)
    }
    if (Object.keys(cleaned).length > 0) merged[month] = cleaned;
    else delete merged[month];
  }

  cache.updateSettings({ incomeData: merged });
  showToast("Income saved", "success");
}
