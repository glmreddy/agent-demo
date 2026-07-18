import * as cache from "../store/cache.js";
import { getCurrentFY, getYearsInData, monthAbbrOnly } from "../core/fy.js";
import { formatUSD } from "../core/money.js";
import { getCategoryById } from "../data/categories.js";
import {
  getTotalSpend,
  getTopCategory,
  getMonthlySummary,
  getTopTransactionsPerMonth,
} from "../reports/aggregations.js";
import { createLineChart, destroyChart, PALETTE } from "../charts/chartFactory.js";

const CHART_ID = "dashboard-income-expense-chart";
let selectedFY = getCurrentFY();
let unsubscribe = null;

export function initDashboardView() {
  return {
    onActivate() {
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

function fyOptions() {
  const expenses = cache.getExpenses();
  const years = getYearsInData(expenses.map((e) => e.date));
  if (!years.includes(selectedFY)) selectedFY = years[0];
  return years.map((y) => `<option value="${y}" ${y === selectedFY ? "selected" : ""}>${y}</option>`).join("");
}

function render() {
  const section = document.getElementById("view-dashboard");
  if (!section) return;

  const expenses = cache.getExpenses();
  const { incomeData } = cache.getSettings();

  const { total: totalSpend, count } = getTotalSpend(expenses, selectedFY);
  const topCategory = getTopCategory(expenses, selectedFY);
  const summary = getMonthlySummary(expenses, incomeData, selectedFY);
  const topTxnsByMonth = getTopTransactionsPerMonth(expenses, selectedFY, 3);

  section.innerHTML = `
    <div class="view-header">
      <h2>Dashboard</h2>
      <div class="controls">
        <label class="text-muted">Financial Year</label>
        <select id="dash-fy">${fyOptions()}</select>
      </div>
    </div>

    <div class="stat-grid">
      <div class="card">
        <div class="card-title">Total Spend (FY ${selectedFY})</div>
        <div class="card-value">${formatUSD(totalSpend)}</div>
        <div class="card-sub">${count} transaction${count === 1 ? "" : "s"}</div>
      </div>
      <div class="card">
        <div class="card-title">Top Category</div>
        ${
          topCategory
            ? `<div class="card-value">${getCategoryById(topCategory.categoryId).icon} ${getCategoryById(topCategory.categoryId).name}</div>
               <div class="card-sub">${formatUSD(topCategory.total)} · ${topCategory.share}% of spend</div>`
            : `<div class="card-value text-muted">—</div><div class="card-sub">No spend yet</div>`
        }
      </div>
      <div class="card">
        <div class="card-title">Net Savings (FY)</div>
        <div class="card-value ${summary.totals.net < 0 ? "neg" : ""}">${formatUSD(summary.totals.net, { parensForNegative: true })}</div>
        <div class="card-sub">Ending balance ${formatUSD(summary.totals.endingBalance, { parensForNegative: true })}</div>
      </div>
    </div>

    <div class="chart-card">
      <h3>Income vs Expense</h3>
      <div class="chart-container"><canvas id="${CHART_ID}"></canvas></div>
    </div>

    <div class="grid-2">
      <div class="table-wrap">
        ${summaryTableHTML(summary)}
      </div>
      <div class="card">
        <h3>Top Transactions by Month</h3>
        ${topTransactionsHTML(topTxnsByMonth)}
      </div>
    </div>
  `;

  section.querySelector("#dash-fy").addEventListener("change", (e) => {
    selectedFY = Number(e.target.value);
    render();
  });

  createLineChart(CHART_ID, {
    labels: summary.months.map((m) => monthAbbrOnly(m.month)),
    datasets: [
      { label: "Income", data: summary.months.map((m) => m.income), color: PALETTE.blue },
      { label: "Expense", data: summary.months.map((m) => m.expense), color: PALETTE.red },
    ],
  });
}

function summaryTableHTML(summary) {
  const fmt = (n) => formatUSD(n, { parensForNegative: true });
  const rowHTML = (label, key) => `
    <tr>
      <td>${label}</td>
      ${summary.months.map((m) => `<td class="num ${m[key] < 0 ? "neg" : ""}">${fmt(m[key])}</td>`).join("")}
      <td class="num"><strong>${fmt(summary.totals[key])}</strong></td>
    </tr>`;

  return `
    <table>
      <thead><tr>
        <th>Month</th>
        ${summary.months.map((m) => `<th class="num">${monthAbbrOnly(m.month)}</th>`).join("")}
        <th class="num">Total</th>
      </tr></thead>
      <tbody>
        ${rowHTML("Income", "income")}
        ${rowHTML("Expense", "expense")}
        ${rowHTML("Net Savings", "net")}
        ${rowHTML("Ending Balance", "endingBalance")}
      </tbody>
    </table>`;
}

function topTransactionsHTML(monthsWithTxns) {
  if (!monthsWithTxns.length) {
    return `<div class="empty-state"><div class="empty-icon">📭</div><p>No transactions yet this FY.</p></div>`;
  }
  return monthsWithTxns
    .map(
      (m) => `
      <div class="mt-2">
        <strong class="text-muted">${monthAbbrOnly(m.month)}</strong>
        <table>
          <tbody>
            ${m.transactions
              .map((t) => {
                const cat = getCategoryById(t.category);
                return `<tr>
                  <td>${t.date}</td>
                  <td>${escapeHTML(t.description)}</td>
                  <td><span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
                  <td class="num">${formatUSD(t.amount)}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`
    )
    .join("");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
