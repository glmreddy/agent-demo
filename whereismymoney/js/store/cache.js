import * as fs from "../services/firestore.js";
import { setSaving, showToast } from "../utils/toast.js";

const state = {
  userId: null,
  loaded: false,
  expenses: new Map(),
  income: new Map(),
  categoryMappings: new Map(),
  settings: { budgets: {}, incomeData: {}, paymentCycles: {} },
  pendingWrites: 0,
};

const listeners = new Set();

function notify() {
  for (const listener of listeners) listener(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function trackWrite(promise, rollback) {
  state.pendingWrites++;
  setSaving(true);
  promise
    .catch((err) => {
      console.error("Write failed:", err);
      showToast("Failed to save changes. Please retry.", "error");
      if (rollback) rollback();
      notify();
    })
    .finally(() => {
      state.pendingWrites--;
      if (state.pendingWrites <= 0) setSaving(false);
    });
}

// ============ Lifecycle ============

export async function initCache(userId) {
  state.userId = userId;
  state.loaded = false;
  state.expenses.clear();
  state.income.clear();
  state.categoryMappings.clear();
  state.settings = { budgets: {}, incomeData: {}, paymentCycles: {} };

  const data = await fs.loadAllUserData(userId);
  for (const e of data.expenses) state.expenses.set(e.id, e);
  for (const i of data.income) state.income.set(i.id, i);
  for (const m of data.categoryMappings) state.categoryMappings.set(m.id, m);
  state.settings = data.settings;
  state.loaded = true;
  notify();
}

export function resetCache() {
  state.userId = null;
  state.loaded = false;
  state.expenses.clear();
  state.income.clear();
  state.categoryMappings.clear();
  state.settings = { budgets: {}, incomeData: {}, paymentCycles: {} };
  state.pendingWrites = 0;
  notify();
}

// ============ Read (synchronous selectors) ============

export function getState() {
  return state;
}

export function getExpenses({ month, fy, category, type, from, to, search } = {}) {
  let rows = Array.from(state.expenses.values());
  if (month) rows = rows.filter((r) => r.date && r.date.startsWith(month));
  if (fy) rows = rows.filter((r) => r.date && r.date.startsWith(String(fy)));
  if (category) rows = rows.filter((r) => r.category === category);
  if (type) rows = rows.filter((r) => r.type === type);
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => (r.description || "").toLowerCase().includes(q));
  }
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""));
  return rows;
}

export function getIncome({ month, fy } = {}) {
  let rows = Array.from(state.income.values());
  if (month) rows = rows.filter((r) => r.date && r.date.startsWith(month));
  if (fy) rows = rows.filter((r) => r.date && r.date.startsWith(String(fy)));
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return rows;
}

export function getCategoryMappings() {
  return Array.from(state.categoryMappings.values());
}

export function getSettings() {
  return state.settings;
}

// ============ Write (optimistic) ============

export function addExpense(expense) {
  const id = expense.id || newId();
  const record = { ...expense, id, type: "expense" };
  state.expenses.set(id, record);
  notify();
  trackWrite(fs.writeExpense(state.userId, record), () => state.expenses.delete(id));
  return id;
}

export function updateExpense(id, patch) {
  const existing = state.expenses.get(id);
  if (!existing) return;
  const updated = { ...existing, ...patch, id };
  state.expenses.set(id, updated);
  notify();
  trackWrite(fs.writeExpense(state.userId, updated), () => state.expenses.set(id, existing));
}

export function deleteExpense(id) {
  const existing = state.expenses.get(id);
  if (!existing) return;
  state.expenses.delete(id);
  notify();
  trackWrite(fs.deleteExpenseDoc(state.userId, id), () => state.expenses.set(id, existing));
}

export function addIncome(income) {
  const id = income.id || newId();
  const record = { ...income, id, type: "income" };
  state.income.set(id, record);
  notify();
  trackWrite(fs.writeIncome(state.userId, record), () => state.income.delete(id));
  return id;
}

export function updateIncome(id, patch) {
  const existing = state.income.get(id);
  if (!existing) return;
  const updated = { ...existing, ...patch, id };
  state.income.set(id, updated);
  notify();
  trackWrite(fs.writeIncome(state.userId, updated), () => state.income.set(id, existing));
}

export function deleteIncome(id) {
  const existing = state.income.get(id);
  if (!existing) return;
  state.income.delete(id);
  notify();
  trackWrite(fs.deleteIncomeDoc(state.userId, id), () => state.income.set(id, existing));
}

export function addCategoryMapping(mapping) {
  const id = mapping.id || newId();
  const record = { ...mapping, id };
  state.categoryMappings.set(id, record);
  notify();
  trackWrite(fs.writeCategoryMapping(state.userId, record), () => state.categoryMappings.delete(id));
  return id;
}

export function updateCategoryMapping(id, patch) {
  const existing = state.categoryMappings.get(id);
  if (!existing) return;
  const updated = { ...existing, ...patch, id };
  state.categoryMappings.set(id, updated);
  notify();
  trackWrite(fs.writeCategoryMapping(state.userId, updated), () => state.categoryMappings.set(id, existing));
}

export function deleteCategoryMapping(id) {
  const existing = state.categoryMappings.get(id);
  if (!existing) return;
  state.categoryMappings.delete(id);
  notify();
  trackWrite(fs.deleteCategoryMappingDoc(state.userId, id), () => state.categoryMappings.set(id, existing));
}

/** Shallow-merges into in-memory settings first, then persists the whole doc. */
export function updateSettings(patch) {
  const previous = state.settings;
  state.settings = { ...state.settings, ...patch };
  notify();
  trackWrite(fs.writeSettingsDoc(state.userId, state.settings), () => {
    state.settings = previous;
  });
}

/**
 * Bulk-commit an import (FR-IMP-3: Overwrite replaces all existing expenses,
 * Append adds to what's there). Cache updates immediately (optimistic);
 * batched Firestore writes happen in chunks and partial-chunk failures are
 * reported rather than rolling back the whole import.
 */
export async function bulkImportExpenses(newExpenses, mode = "append") {
  setSaving(true);
  try {
    if (mode === "overwrite") {
      const existingIds = Array.from(state.expenses.keys());
      state.expenses.clear();
      if (existingIds.length) await fs.batchDeleteExpenses(state.userId, existingIds);
    }
    const withIds = newExpenses.map((e) => ({ ...e, id: e.id || newId(), type: "expense" }));
    for (const e of withIds) state.expenses.set(e.id, e);
    notify();
    const result = await fs.batchWriteExpenses(state.userId, withIds);
    return { imported: result.succeeded, failed: result.failed };
  } finally {
    setSaving(false);
  }
}

export async function bulkImportIncome(newIncome, mode = "append") {
  setSaving(true);
  try {
    if (mode === "overwrite") {
      const existingIds = Array.from(state.income.keys());
      state.income.clear();
      if (existingIds.length) await fs.batchDeleteIncome(state.userId, existingIds);
    }
    const withIds = newIncome.map((i) => ({ ...i, id: i.id || newId(), type: "income" }));
    for (const i of withIds) state.income.set(i.id, i);
    notify();
    const result = await fs.batchWriteIncome(state.userId, withIds);
    return { imported: result.succeeded, failed: result.failed };
  } finally {
    setSaving(false);
  }
}
