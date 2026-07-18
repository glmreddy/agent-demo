import { workbookToRows, parseStatement } from "./parser.js";
import {
  detectSourceType,
  fetchGoogleSheetCsv,
  fetchDriveFile,
  fetchDriveFolderFiles,
  fetchDriveFolderFile,
} from "./fetchers.js";
import * as cache from "../store/cache.js";

/** Resolves what kind of source a URL is; for folders, lists the spreadsheets inside. */
export async function resolveSource(url) {
  const type = detectSourceType(url);
  if (type === "unknown") {
    throw new Error(
      "That doesn't look like a Google Sheets or Drive link. Paste a Sheets URL, a Drive file share link, or a Drive folder link."
    );
  }
  if (type === "drive-folder") {
    const result = await fetchDriveFolderFiles(url);
    return { type, files: result.files, notConfigured: result.notConfigured };
  }
  return { type, files: null, notConfigured: false };
}

async function fetchRaw({ type, url, folderFile, localFile }) {
  if (localFile) {
    const isCsv = /\.csv$/i.test(localFile.name);
    return isCsv
      ? { text: await localFile.text(), filename: localFile.name }
      : { bytes: await localFile.arrayBuffer(), filename: localFile.name };
  }
  if (type === "sheet") return fetchGoogleSheetCsv(url);
  if (type === "drive-file") return fetchDriveFile(url);
  if (type === "drive-folder" && folderFile) return fetchDriveFolderFile(folderFile);
  throw new Error("Nothing to fetch — pick a source first.");
}

/**
 * Fetch + parse (does NOT write to Firestore). Returns the same shape as
 * parser.parseStatement, plus sourceLabel. A fatalError here means nothing
 * was imported — the store is never touched on a parse failure (FR-PARSE-8).
 */
export async function analyzeSource({ type, url, folderFile, localFile, rowKind, overrides }) {
  const raw = await fetchRaw({ type, url, folderFile, localFile });
  const { headerRow, dataRows } = workbookToRows(raw.text ?? raw.bytes, { isText: !!raw.text });
  const userMappings = cache.getCategoryMappings();
  const result = parseStatement({ headerRow, dataRows }, { userMappings, overrides, rowKind });
  return { ...result, sourceLabel: raw.filename };
}

function makeSourceId(sourceLabel) {
  return `import_${Date.now()}_${String(sourceLabel).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;
}

/** Explicit, separate step from analyze() — a parse preview can never accidentally reach Firestore. */
export async function commitExpenseImport(transactions, mode, sourceLabel) {
  const sourceId = makeSourceId(sourceLabel);
  const withSource = transactions.map((t) => ({ ...t, sourceId }));
  return cache.bulkImportExpenses(withSource, mode);
}

export async function commitIncomeImport(rows, mode, sourceLabel) {
  const sourceId = makeSourceId(sourceLabel);
  const withSource = rows.map((r) => ({ ...r, sourceId }));
  return cache.bulkImportIncome(withSource, mode);
}

/**
 * Cheap duplicate heuristic for the Append-mode preview (date+description+
 * amount already present in the store) — surfaced as a diagnostic, not
 * auto-blocked (no hard dedupe requirement was specified).
 */
export function countLikelyDuplicates(transactions) {
  const existing = new Set(cache.getExpenses().map((e) => `${e.date}|${e.description}|${e.amount}`));
  return transactions.filter((t) => existing.has(`${t.date}|${t.description}|${t.amount}`)).length;
}
