import * as cache from "../store/cache.js";

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsvRow(values) {
  return values.map(csvEscape).join(",");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function exportAllAsJSON() {
  const state = cache.getState();
  const data = {
    exportedAt: new Date().toISOString(),
    expenses: Array.from(state.expenses.values()),
    income: Array.from(state.income.values()),
    categoryMapping: Array.from(state.categoryMappings.values()),
    settings: state.settings,
  };
  downloadFile(`whereismymoney-export-${dateStamp()}.json`, JSON.stringify(data, null, 2), "application/json");
}

/** One CSV file, sectioned per collection (blank-line separated) so all data is included, not just the transaction ledger. */
export function exportAllAsCSV() {
  const state = cache.getState();
  const lines = [];

  lines.push("# Expenses");
  lines.push(toCsvRow(["id", "date", "description", "amount", "category", "sourceId"]));
  for (const e of state.expenses.values()) {
    lines.push(toCsvRow([e.id, e.date, e.description, e.amount, e.category, e.sourceId || ""]));
  }
  lines.push("");

  lines.push("# Income");
  lines.push(toCsvRow(["id", "date", "description", "amount", "sourceId"]));
  for (const i of state.income.values()) {
    lines.push(toCsvRow([i.id, i.date, i.description, i.amount, i.sourceId || ""]));
  }
  lines.push("");

  lines.push("# Category Mapping");
  lines.push(toCsvRow(["id", "keyword", "category"]));
  for (const m of state.categoryMappings.values()) {
    lines.push(toCsvRow([m.id, m.keyword, m.category]));
  }
  lines.push("");

  lines.push("# Budgets");
  lines.push(toCsvRow(["month", "total", "category", "allocation"]));
  for (const [month, b] of Object.entries(state.settings.budgets || {})) {
    lines.push(toCsvRow([month, b.total || 0, "", ""]));
    for (const [cat, amt] of Object.entries(b.allocations || {})) {
      lines.push(toCsvRow([month, "", cat, amt]));
    }
  }
  lines.push("");

  lines.push("# Income Data (planned)");
  lines.push(toCsvRow(["month", "source", "amount"]));
  for (const [month, row] of Object.entries(state.settings.incomeData || {})) {
    for (const [source, amt] of Object.entries(row)) {
      lines.push(toCsvRow([month, source, amt]));
    }
  }
  lines.push("");

  lines.push("# Payment Cycles");
  lines.push(toCsvRow(["year", "category", "subCategory", "details", "month", "amount"]));
  for (const [year, rows] of Object.entries(state.settings.paymentCycles || {})) {
    for (const row of rows) {
      const entries = Object.entries(row.months || {});
      if (entries.length === 0) {
        lines.push(toCsvRow([year, row.category, row.subCategory, row.details || "", "", ""]));
      }
      for (const [month, amt] of entries) {
        lines.push(toCsvRow([year, row.category, row.subCategory, row.details || "", month, amt]));
      }
    }
  }

  downloadFile(`whereismymoney-export-${dateStamp()}.csv`, lines.join("\n"), "text/csv");
}
