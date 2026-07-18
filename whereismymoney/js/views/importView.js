import * as importCtl from "../import/importController.js";
import { getCategoryById } from "../data/categories.js";
import { formatUSD } from "../core/money.js";
import { showToast } from "../utils/toast.js";
import { exportAllAsCSV, exportAllAsJSON } from "../utils/export.js";

let activeTab = "expense";

export function initImportView() {
  return {
    onActivate() {
      render();
    },
  };
}

function render() {
  const section = document.getElementById("view-import");
  if (!section) return;

  section.innerHTML = `
    <div class="view-header"><h2>Import Statements</h2></div>
    <div class="filters-bar" role="tablist">
      <button class="btn ${activeTab === "expense" ? "btn-primary" : ""}" id="tab-expense" type="button">Expense Import</button>
      <button class="btn ${activeTab === "income" ? "btn-primary" : ""}" id="tab-income" type="button">Income Import</button>
    </div>
    <div id="import-panel-root"></div>

    <div class="card mt-2">
      <h3>Export Data</h3>
      <p class="text-muted">Download everything — transactions, income, category mapping, budgets, and payment cycles.</p>
      <div class="modal-actions" style="justify-content:flex-start">
        <button class="btn" id="btn-export-csv" type="button">Export as CSV</button>
        <button class="btn" id="btn-export-json" type="button">Export as JSON</button>
      </div>
    </div>
  `;

  section.querySelector("#tab-expense").addEventListener("click", () => { activeTab = "expense"; render(); });
  section.querySelector("#tab-income").addEventListener("click", () => { activeTab = "income"; render(); });
  section.querySelector("#btn-export-csv").addEventListener("click", () => {
    exportAllAsCSV();
    showToast("CSV export downloaded", "success");
  });
  section.querySelector("#btn-export-json").addEventListener("click", () => {
    exportAllAsJSON();
    showToast("JSON export downloaded", "success");
  });

  mountPanel(document.getElementById("import-panel-root"), activeTab);
}

// ============================================================
// One reusable panel, instantiated per rowKind ("expense" | "income").
// ============================================================

const panelStates = {
  expense: freshState(),
  income: freshState(),
};

function freshState() {
  return {
    url: "",
    localFile: null,
    sourceType: null, // 'sheet' | 'drive-file' | 'drive-folder' | null
    folderFiles: null,
    folderNotConfigured: false,
    selectedFolderFileId: "",
    mode: "append",
    loading: false,
    error: null,
    result: null, // parseStatement-shaped result
    lastCommitSummary: null,
  };
}

function mountPanel(root, rowKind) {
  const state = panelStates[rowKind];
  root.innerHTML = panelHTML(state, rowKind);
  wirePanel(root, rowKind);
}

function panelHTML(state, rowKind) {
  const isIncome = rowKind === "income";
  return `
    <div class="card mb-1">
      <h3>${isIncome ? "Import Income" : "Import Expenses"}</h3>
      <p class="text-muted">Paste a Google Sheets link, a Drive file share link, or a Drive folder link (shared "Anyone with the link"). Or upload a file directly.</p>

      <div class="form-row">
        <label>Google Sheets / Drive URL</label>
        <input type="url" id="src-url" placeholder="https://docs.google.com/spreadsheets/d/…" value="${escapeAttr(state.url)}" ${state.localFile ? "disabled" : ""} />
      </div>
      <div class="form-row">
        <label>…or upload a file (CSV / XLSX)</label>
        <input type="file" id="src-file" accept=".csv,.xlsx,.xls" />
        ${state.localFile ? `<p class="text-muted mt-1">Selected: ${escapeHTML(state.localFile.name)} <button class="btn btn-sm" id="clear-file" type="button">Clear</button></p>` : ""}
      </div>

      ${
        state.folderFiles
          ? `<div class="form-row">
              <label>File in folder</label>
              <select id="folder-file-select">
                <option value="">Choose a file…</option>
                ${state.folderFiles.map((f) => `<option value="${f.id}" ${f.id === state.selectedFolderFileId ? "selected" : ""}>${escapeHTML(f.name)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
      ${state.folderNotConfigured ? `<p class="field-error">Folder import needs a Google API key configured in js/data/googleApiConfig.js — see README. Try a single Sheets or Drive file link instead.</p>` : ""}

      <div class="modal-actions" style="justify-content:flex-start">
        <button class="btn btn-primary" id="btn-analyze" type="button" ${state.loading ? "disabled" : ""}>
          ${state.loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      ${state.error ? `<p class="field-error mt-1">${escapeHTML(state.error)}</p>` : ""}
    </div>

    ${state.result && !state.result.fatalError && !state.result.needsManualAmountColumn ? previewHTML(state, rowKind) : ""}
    ${state.result && state.result.needsManualAmountColumn ? manualColumnHTML(state) : ""}
    ${state.lastCommitSummary ? `<div class="diag-chip ok mb-1">${escapeHTML(state.lastCommitSummary)}</div>` : ""}
  `;
}

function manualColumnHTML(state) {
  const r = state.result;
  return `
    <div class="card mb-1">
      <h3>Which column is the amount?</h3>
      <p>${escapeHTML(r.message)}</p>
      <div class="form-row">
        <select id="manual-amount-col">
          ${r.candidateColumns.map((c) => `<option value="${c.index}">${escapeHTML(c.header || `Column ${c.index + 1}`)}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-primary" id="btn-use-manual-col" type="button">Use this column</button>
    </div>`;
}

function previewHTML(state, rowKind) {
  const r = state.result;
  const isIncome = rowKind === "income";
  const dupes = !isIncome ? importCtl.countLikelyDuplicates(r.transactions) : 0;
  const previewRows = r.transactions.slice(0, 15);

  return `
    <div class="card mb-1">
      <h3>Preview — ${r.sourceLabel || "source"}</h3>

      <div class="diagnostics-bar">
        <span class="diag-chip ok">${r.diagnostics.imported} ready to import</span>
        ${r.diagnostics.skippedCredits ? `<span class="diag-chip">${r.diagnostics.skippedCredits} credits/refunds skipped</span>` : ""}
        ${r.diagnostics.skippedBlank ? `<span class="diag-chip">${r.diagnostics.skippedBlank} blank rows skipped</span>` : ""}
        ${r.diagnostics.errors ? `<span class="diag-chip err">${r.diagnostics.errors} rows had errors</span>` : ""}
        ${dupes ? `<span class="diag-chip warn">${dupes} look like duplicates of existing data</span>` : ""}
        ${r.dateFormatAssumed ? `<span class="diag-chip warn">Date format was ambiguous — assumed MM/DD</span>` : ""}
      </div>

      ${
        r.diagnostics.errorSamples?.length
          ? `<p class="text-muted">Sample errors: ${r.diagnostics.errorSamples.map((e) => `row ${e.rowIndex}: ${escapeHTML(e.reason)}`).join("; ")}</p>`
          : ""
      }

      ${
        previewRows.length === 0
          ? `<div class="empty-state"><div class="empty-icon">🤷</div><h3>Nothing to import</h3><p>No valid rows were found in this file.</p></div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th>${isIncome ? "" : "<th>Category</th>"}<th class="num">Amount</th></tr></thead>
                <tbody>
                  ${previewRows
                    .map(
                      (t) => `<tr>
                        <td>${t.date}</td>
                        <td>${escapeHTML(t.description)}</td>
                        ${isIncome ? "" : `<td>${badge(t.category)}</td>`}
                        <td class="num">${formatUSD(t.amount)}</td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
              ${r.transactions.length > previewRows.length ? `<p class="text-muted" style="padding:.6em .9em">…and ${r.transactions.length - previewRows.length} more</p>` : ""}
            </div>`
      }

      <div class="form-row mt-2">
        <label>Import mode</label>
        <label style="font-weight:400"><input type="radio" name="import-mode" value="append" ${state.mode === "append" ? "checked" : ""}/> Append — add to existing ${isIncome ? "income" : "expenses"}</label><br/>
        <label style="font-weight:400"><input type="radio" name="import-mode" value="overwrite" ${state.mode === "overwrite" ? "checked" : ""}/> Overwrite — replace all existing ${isIncome ? "income" : "expenses"}</label>
      </div>

      <button class="btn btn-primary" id="btn-commit" type="button" ${previewRows.length === 0 && r.transactions.length === 0 ? "disabled" : ""}>
        Confirm Import (${r.transactions.length})
      </button>
    </div>`;
}

function badge(categoryId) {
  const cat = getCategoryById(categoryId);
  return `<span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span>`;
}

function wirePanel(root, rowKind) {
  const state = panelStates[rowKind];

  root.querySelector("#src-url").addEventListener("input", (e) => {
    state.url = e.target.value;
  });

  root.querySelector("#src-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      state.localFile = file;
      state.url = "";
      state.folderFiles = null;
      mountPanel(root, rowKind);
    }
  });

  root.querySelector("#clear-file")?.addEventListener("click", () => {
    state.localFile = null;
    mountPanel(root, rowKind);
  });

  root.querySelector("#folder-file-select")?.addEventListener("change", async (e) => {
    state.selectedFolderFileId = e.target.value;
    if (!state.selectedFolderFileId) return;
    const file = state.folderFiles.find((f) => f.id === state.selectedFolderFileId);
    await runAnalyze(root, rowKind, { folderFile: file });
  });

  root.querySelector("#btn-analyze").addEventListener("click", () => runAnalyze(root, rowKind));

  root.querySelector("#btn-use-manual-col")?.addEventListener("click", () => {
    const amountCol = Number(root.querySelector("#manual-amount-col").value);
    const r = state.result;
    runAnalyze(root, rowKind, {
      overrides: { mode: "single", dateCol: r.dateCol, descCol: r.descCol, amountCol },
    });
  });

  root.querySelector("#btn-commit")?.addEventListener("click", () => commitImport(root, rowKind));

  root.querySelectorAll('input[name="import-mode"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      state.mode = e.target.value;
    });
  });
}

async function runAnalyze(root, rowKind, extra = {}) {
  const state = panelStates[rowKind];
  state.loading = true;
  state.error = null;
  mountPanel(root, rowKind);

  try {
    if (!extra.folderFile && !extra.overrides && !state.localFile) {
      if (!state.url.trim()) throw new Error("Paste a Google Sheets/Drive URL, or choose a file to upload.");
      const resolved = await importCtl.resolveSource(state.url.trim());
      state.sourceType = resolved.type;
      if (resolved.type === "drive-folder") {
        state.folderFiles = resolved.files;
        state.folderNotConfigured = resolved.notConfigured;
        state.loading = false;
        mountPanel(root, rowKind);
        return; // wait for the user to pick a file from the dropdown
      }
    }

    const result = await importCtl.analyzeSource({
      type: state.sourceType || "unknown",
      url: state.url.trim(),
      rowKind,
      localFile: state.localFile,
      ...extra,
    });

    if (result.fatalError) {
      state.error = result.fatalError;
      state.result = null;
    } else {
      state.result = result;
      state.error = null;
    }
  } catch (err) {
    console.error(err);
    state.error = err.message || "Something went wrong while importing.";
    state.result = null;
  } finally {
    state.loading = false;
    mountPanel(root, rowKind);
  }
}

async function commitImport(root, rowKind) {
  const state = panelStates[rowKind];
  const r = state.result;
  if (!r || !r.transactions.length) return;

  const btn = root.querySelector("#btn-commit");
  btn.disabled = true;
  btn.textContent = "Importing…";

  try {
    const outcome =
      rowKind === "income"
        ? await importCtl.commitIncomeImport(r.transactions, state.mode, r.sourceLabel)
        : await importCtl.commitExpenseImport(r.transactions, state.mode, r.sourceLabel);

    state.lastCommitSummary = `Imported ${outcome.imported} ${rowKind === "income" ? "income row(s)" : "transaction(s)"}${outcome.failed ? ` — ${outcome.failed} failed, please retry` : ""} from ${r.sourceLabel}.`;
    showToast(state.lastCommitSummary, outcome.failed ? "error" : "success");

    // Reset for the next import, keeping the mode preference.
    const mode = state.mode;
    panelStates[rowKind] = { ...freshState(), mode, lastCommitSummary: state.lastCommitSummary };
    mountPanel(root, rowKind);
  } catch (err) {
    console.error(err);
    showToast("Import failed. Nothing was changed.", "error");
    btn.disabled = false;
    btn.textContent = `Confirm Import (${r.transactions.length})`;
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}
