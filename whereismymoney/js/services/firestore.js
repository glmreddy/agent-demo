import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const BATCH_LIMIT = 500;

const expensesCol = (uid) => collection(db, "users", uid, "expenses");
const incomeCol = (uid) => collection(db, "users", uid, "income");
const mappingCol = (uid) => collection(db, "users", uid, "category_mapping");
const settingsRef = (uid) => doc(db, "users", uid, "config", "settings");

const DEFAULT_SETTINGS = { budgets: {}, incomeData: {}, paymentCycles: {} };

/** One-time full load of everything under users/{uid} at login. */
export async function loadAllUserData(uid) {
  const [expenseSnap, incomeSnap, mappingSnap, settingsSnap] = await Promise.all([
    getDocs(expensesCol(uid)),
    getDocs(incomeCol(uid)),
    getDocs(mappingCol(uid)),
    getDoc(settingsRef(uid)),
  ]);

  return {
    expenses: expenseSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    income: incomeSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    categoryMappings: mappingSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    settings: settingsSnap.exists()
      ? { ...DEFAULT_SETTINGS, ...settingsSnap.data() }
      : { ...DEFAULT_SETTINGS },
  };
}

export async function writeExpense(uid, expense) {
  await setDoc(doc(expensesCol(uid), expense.id), expense);
}
export async function deleteExpenseDoc(uid, id) {
  await deleteDoc(doc(expensesCol(uid), id));
}

export async function writeIncome(uid, income) {
  await setDoc(doc(incomeCol(uid), income.id), income);
}
export async function deleteIncomeDoc(uid, id) {
  await deleteDoc(doc(incomeCol(uid), id));
}

export async function writeCategoryMapping(uid, mapping) {
  await setDoc(doc(mappingCol(uid), mapping.id), mapping);
}
export async function deleteCategoryMappingDoc(uid, id) {
  await deleteDoc(doc(mappingCol(uid), id));
}

export async function writeSettingsDoc(uid, settings) {
  await setDoc(settingsRef(uid), settings, { merge: true });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Batched writes, chunked to Firestore's 500-ops-per-batch limit. Chunks run
 * sequentially so a failure partway through reports exactly how many
 * succeeded rather than an all-or-nothing outcome.
 * @returns {Promise<{succeeded: number, failed: number}>}
 */
export async function batchWriteExpenses(uid, expenses) {
  let succeeded = 0;
  let failed = 0;
  for (const group of chunk(expenses, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    for (const expense of group) {
      batch.set(doc(expensesCol(uid), expense.id), expense);
    }
    try {
      await batch.commit();
      succeeded += group.length;
    } catch (err) {
      console.error("Batch write failed:", err);
      failed += group.length;
    }
  }
  return { succeeded, failed };
}

export async function batchDeleteExpenses(uid, ids) {
  for (const group of chunk(ids, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    for (const id of group) batch.delete(doc(expensesCol(uid), id));
    await batch.commit();
  }
}

export async function batchWriteIncome(uid, incomeRows) {
  let succeeded = 0;
  let failed = 0;
  for (const group of chunk(incomeRows, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    for (const row of group) batch.set(doc(incomeCol(uid), row.id), row);
    try {
      await batch.commit();
      succeeded += group.length;
    } catch (err) {
      console.error("Batch write failed:", err);
      failed += group.length;
    }
  }
  return { succeeded, failed };
}

export async function batchDeleteIncome(uid, ids) {
  for (const group of chunk(ids, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    for (const id of group) batch.delete(doc(incomeCol(uid), id));
    await batch.commit();
  }
}
