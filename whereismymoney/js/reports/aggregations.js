// Pure functions over plain data (expenses[], income[], settings) — no
// cache/DOM/Firestore access, so these are unit-testable in isolation.
import { CATEGORIES } from "../data/categories.js";
import { getFYMonths } from "../core/fy.js";
import { sum, roundCents } from "../core/money.js";

export function getExpensesInFY(expenses, fy) {
  const prefix = String(fy);
  return expenses.filter((e) => e.date && e.date.startsWith(prefix));
}

export function getTotalSpend(expenses, fy) {
  const rows = getExpensesInFY(expenses, fy);
  return { total: sum(rows.map((r) => r.amount)), count: rows.length };
}

/** [{categoryId, total}] sorted by spend descending, only categories with spend > 0. */
export function getCategoryBreakdown(expenses, fy) {
  const rows = getExpensesInFY(expenses, fy);
  const totals = new Map();
  for (const r of rows) {
    totals.set(r.category, roundCents((totals.get(r.category) || 0) + Number(r.amount || 0)));
  }
  return Array.from(totals.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function getTopCategory(expenses, fy) {
  const breakdown = getCategoryBreakdown(expenses, fy);
  const { total: grandTotal } = getTotalSpend(expenses, fy);
  if (!breakdown.length || grandTotal === 0) return null;
  const top = breakdown[0];
  return { categoryId: top.categoryId, total: top.total, share: roundCents((top.total / grandTotal) * 100) };
}

/** {"YYYY-MM": total} for all 12 FY months (0 where no spend). */
export function getMonthlyExpenseTotals(expenses, fy) {
  const months = getFYMonths(fy);
  const map = Object.fromEntries(months.map((m) => [m, 0]));
  for (const e of getExpensesInFY(expenses, fy)) {
    const month = e.date.slice(0, 7);
    if (month in map) map[month] = roundCents(map[month] + Number(e.amount || 0));
  }
  return map;
}

/** {"YYYY-MM": total} from the incomeData crosstab (salary+farm+mf+others), per FR-DASH-4. */
export function getMonthlyIncomeTotals(incomeData, fy) {
  const months = getFYMonths(fy);
  const map = {};
  for (const m of months) {
    const row = incomeData[m];
    map[m] = row ? roundCents((row.salary || 0) + (row.farm || 0) + (row.mf || 0) + (row.others || 0)) : 0;
  }
  return map;
}

/** Dashboard summary table: Income / Expense / Net Savings / running Ending Balance, + Total column. */
export function getMonthlySummary(expenses, incomeData, fy) {
  const months = getFYMonths(fy);
  const incomeByMonth = getMonthlyIncomeTotals(incomeData, fy);
  const expenseByMonth = getMonthlyExpenseTotals(expenses, fy);

  let running = 0;
  const rows = months.map((m) => {
    const income = incomeByMonth[m];
    const expense = expenseByMonth[m];
    const net = roundCents(income - expense);
    running = roundCents(running + net);
    return { month: m, income, expense, net, endingBalance: running };
  });

  return {
    months: rows,
    totals: {
      income: sum(rows.map((r) => r.income)),
      expense: sum(rows.map((r) => r.expense)),
      net: sum(rows.map((r) => r.net)),
      endingBalance: running,
    },
  };
}

/** Top-N transactions per month, for the dashboard's "top transactions" list, newest month first. */
export function getTopTransactionsPerMonth(expenses, fy, n = 3) {
  const months = getFYMonths(fy).slice().reverse();
  const rows = getExpensesInFY(expenses, fy);
  return months
    .map((month) => {
      const inMonth = rows.filter((r) => r.date.startsWith(month)).sort((a, b) => b.amount - a.amount);
      return { month, transactions: inMonth.slice(0, n) };
    })
    .filter((m) => m.transactions.length > 0);
}

/** Category x Month crosstab for the Expense Report (FR-EXP-1..4). */
export function getExpenseCrosstab(expenses, fy) {
  const months = getFYMonths(fy);
  const rows = getExpensesInFY(expenses, fy);

  const cells = {}; // categoryId -> { month -> total }
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    cells[r.category] = cells[r.category] || {};
    cells[r.category][month] = roundCents((cells[r.category][month] || 0) + Number(r.amount || 0));
  }

  const categoryIds = CATEGORIES.map((c) => c.id).filter((id) => {
    const rowCells = cells[id];
    return rowCells && Object.values(rowCells).some((v) => v > 0);
  });

  // Preserve CATEGORIES display order but sort by total spend descending (bigger categories first).
  const rowTotals = {};
  for (const id of categoryIds) {
    rowTotals[id] = roundCents(months.reduce((acc, m) => acc + (cells[id]?.[m] || 0), 0));
  }
  categoryIds.sort((a, b) => rowTotals[b] - rowTotals[a]);

  const colTotals = {};
  for (const m of months) {
    colTotals[m] = roundCents(categoryIds.reduce((acc, id) => acc + (cells[id]?.[m] || 0), 0));
  }
  const grandTotal = roundCents(Object.values(rowTotals).reduce((a, b) => a + b, 0));

  return { months, categoryIds, cells, rowTotals, colTotals, grandTotal };
}

/** Editable Income Report crosstab (FR-INC-1..2): sources x months, from incomeData settings. */
export function getIncomeCrosstab(incomeData, fy) {
  const months = getFYMonths(fy);
  const sources = ["salary", "farm", "mf", "others"];
  const rowTotals = {};
  for (const s of sources) {
    rowTotals[s] = roundCents(months.reduce((acc, m) => acc + (incomeData[m]?.[s] || 0), 0));
  }
  const colTotals = {};
  for (const m of months) {
    colTotals[m] = roundCents(sources.reduce((acc, s) => acc + (incomeData[m]?.[s] || 0), 0));
  }
  const grandTotal = roundCents(Object.values(rowTotals).reduce((a, b) => a + b, 0));
  return { months, sources, rowTotals, colTotals, grandTotal };
}

/** Year-on-year expense comparison, month-by-month (FR-EXP-3). */
export function getYoYExpenseComparison(expenses, fy) {
  const months = getFYMonths(fy);
  const prevMonths = getFYMonths(fy - 1);
  const current = getMonthlyExpenseTotals(expenses, fy);
  const previous = getMonthlyExpenseTotals(expenses, fy - 1);
  return {
    months,
    current: months.map((m) => current[m]),
    // Zipped by index (both arrays are Jan..Dec in order), so previous[i]
    // is the same calendar month one year earlier.
    previous: prevMonths.map((m) => previous[m]),
  };
}
