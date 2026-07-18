import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getTotalSpend,
  getCategoryBreakdown,
  getTopCategory,
  getExpenseCrosstab,
  getMonthlySummary,
  getYoYExpenseComparison,
  getIncomeCrosstab,
} from "../js/reports/aggregations.js";

const expenses = [
  { id: "1", date: "2026-01-05", description: "Costco", amount: 100, category: "groceries" },
  { id: "2", date: "2026-01-20", description: "Starbucks", amount: 5, category: "dining" },
  { id: "3", date: "2026-02-10", description: "Costco", amount: 50, category: "groceries" },
  { id: "4", date: "2025-01-10", description: "Costco", amount: 40, category: "groceries" },
];

test("getExpenseCrosstab grand total equals getTotalSpend (AC-4 invariant)", () => {
  const crosstab = getExpenseCrosstab(expenses, 2026);
  const { total } = getTotalSpend(expenses, 2026);
  assert.equal(crosstab.grandTotal, total);
  assert.equal(total, 155);
});

test("getCategoryBreakdown only includes categories with spend, sorted descending", () => {
  const breakdown = getCategoryBreakdown(expenses, 2026);
  assert.deepEqual(breakdown, [
    { categoryId: "groceries", total: 150 },
    { categoryId: "dining", total: 5 },
  ]);
});

test("getTopCategory computes correct share of total spend", () => {
  const top = getTopCategory(expenses, 2026);
  assert.equal(top.categoryId, "groceries");
  assert.equal(top.total, 150);
  assert.ok(Math.abs(top.share - (150 / 155) * 100) < 0.01);
});

test("getMonthlySummary running ending balance accumulates net savings month over month", () => {
  const incomeData = {
    "2026-01": { salary: 1000 },
    "2026-02": { salary: 1000 },
  };
  const summary = getMonthlySummary(expenses, incomeData, 2026);
  const jan = summary.months.find((m) => m.month === "2026-01");
  const feb = summary.months.find((m) => m.month === "2026-02");
  assert.equal(jan.income, 1000);
  assert.equal(jan.expense, 105);
  assert.equal(jan.net, 895);
  assert.equal(jan.endingBalance, 895);
  assert.equal(feb.expense, 50);
  assert.equal(feb.net, 950);
  assert.equal(feb.endingBalance, 895 + 950);
});

test("getYoYExpenseComparison zips current and previous FY by same calendar month", () => {
  const yoy = getYoYExpenseComparison(expenses, 2026);
  assert.equal(yoy.current[0], 105); // Jan 2026
  assert.equal(yoy.previous[0], 40); // Jan 2025
  assert.equal(yoy.current[1], 50); // Feb 2026
  assert.equal(yoy.previous[1], 0); // Feb 2025 had no spend
});

test("getIncomeCrosstab computes row/col/grand totals correctly", () => {
  const incomeData = {
    "2026-01": { salary: 1000, others: 100 },
    "2026-03": { salary: 1200 },
  };
  const crosstab = getIncomeCrosstab(incomeData, 2026);
  assert.equal(crosstab.rowTotals.salary, 2200);
  assert.equal(crosstab.rowTotals.others, 100);
  assert.equal(crosstab.colTotals["2026-01"], 1100);
  assert.equal(crosstab.grandTotal, 2300);
});
