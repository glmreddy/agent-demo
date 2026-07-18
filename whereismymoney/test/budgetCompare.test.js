import { test } from "node:test";
import assert from "node:assert/strict";
import { getCategoryActuals, getBudgetVsActual, getBudgetSummary } from "../js/reports/budgetCompare.js";

const expenses = [
  { id: "1", date: "2026-06-05", description: "Costco", amount: 120, category: "groceries" },
  { id: "2", date: "2026-06-10", description: "Costco", amount: 30, category: "groceries" },
  { id: "3", date: "2026-06-12", description: "Starbucks", amount: 8, category: "dining" },
  { id: "4", date: "2026-07-01", description: "Costco", amount: 999, category: "groceries" }, // different month
];

test("getCategoryActuals sums only the given month", () => {
  const actuals = getCategoryActuals(expenses, "2026-06");
  assert.equal(actuals.groceries, 150);
  assert.equal(actuals.dining, 8);
  assert.equal(actuals.farm, undefined);
});

test("getBudgetVsActual flags over-budget categories and computes remaining", () => {
  const budget = { total: 500, allocations: { groceries: 100, dining: 50 } };
  const rows = getBudgetVsActual(expenses, budget, "2026-06");
  const groceries = rows.find((r) => r.categoryId === "groceries");
  const dining = rows.find((r) => r.categoryId === "dining");

  assert.equal(groceries.allocation, 100);
  assert.equal(groceries.actual, 150);
  assert.equal(groceries.overBudget, true);
  assert.equal(groceries.remaining, -50);

  assert.equal(dining.overBudget, false);
  assert.equal(dining.remaining, 42);
});

test("getBudgetVsActual includes categories with actual spend even without an allocation", () => {
  const budget = { total: 500, allocations: { dining: 50 } };
  const rows = getBudgetVsActual(expenses, budget, "2026-06");
  const groceries = rows.find((r) => r.categoryId === "groceries");
  assert.ok(groceries);
  assert.equal(groceries.allocation, 0);
  assert.equal(groceries.actual, 150);
  assert.equal(groceries.pct, 100); // no allocation but spend > 0 -> treated as fully "used"
});

test("getBudgetSummary computes Total Planned, Total Spent, Remaining/Over", () => {
  const budget = { total: 500, allocations: { groceries: 100, dining: 50 } };
  const summary = getBudgetSummary(expenses, budget, "2026-06");
  assert.equal(summary.totalPlanned, 500);
  assert.equal(summary.totalSpent, 158);
  assert.equal(summary.remaining, 342);
});
