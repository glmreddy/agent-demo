// Pure functions comparing actual expenses (from cache-derived data) against
// a month's budget allocations. No cache/DOM access.
import { CATEGORIES } from "../data/categories.js";
import { roundCents, sum } from "../core/money.js";

/** {categoryId: totalSpent} for a given "YYYY-MM" month. */
export function getCategoryActuals(expenses, month) {
  const totals = {};
  for (const e of expenses) {
    if (!e.date || !e.date.startsWith(month)) continue;
    totals[e.category] = roundCents((totals[e.category] || 0) + Number(e.amount || 0));
  }
  return totals;
}

/**
 * Per-category planned-vs-actual rows for the Budget Planner (FR-BUD-2/3).
 * Includes every category that has either an allocation or actual spend.
 */
export function getBudgetVsActual(expenses, budgetForMonth, month) {
  const allocations = budgetForMonth?.allocations || {};
  const actuals = getCategoryActuals(expenses, month);

  const categoryIds = CATEGORIES.map((c) => c.id).filter(
    (id) => (allocations[id] || 0) > 0 || (actuals[id] || 0) > 0
  );

  return categoryIds.map((categoryId) => {
    const allocation = roundCents(allocations[categoryId] || 0);
    const actual = roundCents(actuals[categoryId] || 0);
    const remaining = roundCents(allocation - actual);
    const pct = allocation > 0 ? Math.min(999, roundCents((actual / allocation) * 100)) : actual > 0 ? 100 : 0;
    return { categoryId, allocation, actual, remaining, overBudget: remaining < 0, pct };
  });
}

/** Total Planned / Total Spent / Remaining summary for the whole month (FR-BUD-4). */
export function getBudgetSummary(expenses, budgetForMonth, month) {
  const actuals = getCategoryActuals(expenses, month);
  const totalPlanned = roundCents(budgetForMonth?.total || 0);
  const totalSpent = sum(Object.values(actuals));
  return { totalPlanned, totalSpent, remaining: roundCents(totalPlanned - totalSpent) };
}
