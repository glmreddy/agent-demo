// ---------------------------------------------------------------------------
// The statement-parsing pipeline. Pure functions, no DOM/Firestore/network
// access — takes header+data rows (already extracted by SheetJS) and
// produces classified transactions + diagnostics. Testable standalone.
//
// See the "Parser Algorithm" section of the implementation plan for the
// full design rationale.
// ---------------------------------------------------------------------------
import { CATEGORIES } from "../data/categories.js";
import { classify } from "../core/classifier.js";

const SAMPLE_SIZE = 50;

const HEADER_KEYWORDS = {
  date: ["date", "txn date", "transaction date", "value date", "posting date", "posted"],
  description: ["description", "narration", "particulars", "details", "merchant", "payee", "remarks", "transaction details"],
  amount: ["amount", "amt", "value", "transaction amount"],
  debit: ["debit", "withdrawal", "debit amount", "paid out", "spent", "dr"],
  credit: ["credit", "deposit", "credit amount", "paid in", "received", "cr"],
  category: ["category", "spend category"],
};

const NUMERIC_DATE_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const TEXT_DATE_RE_1 = /^(\d{1,2})\s+([A-Za-z]{3,9})[,'\s]*\s*(\d{2,4})$/; // "02 Jan '26"
const TEXT_DATE_RE_2 = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{2,4})$/; // "Jan 02, 2026"
const TEXT_DATE_NO_YEAR_RE_1 = /^(\d{1,2})\s+([A-Za-z]{3,9})$/; // "10 Jun" (year omitted)
const TEXT_DATE_NO_YEAR_RE_2 = /^([A-Za-z]{3,9})\s+(\d{1,2})$/; // "Jun 10" (year omitted)
const TEXT_DATE_PLAUSIBLE_RE = /^\d{1,2}\s+[A-Za-z]{3,9}[,'\s]*\d{2,4}$/;
const TEXT_DATE_PLAUSIBLE_RE_2 = /^[A-Za-z]{3,9}\s+\d{1,2},?\s*\d{2,4}$/;

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isMonthToken(token) {
  return MONTHS[String(token || "").toLowerCase().slice(0, 3)] !== undefined;
}

/**
 * Infers the year for a month/day with no year given (e.g. "Jun 10") — many
 * card-issuer "recent activity" exports omit it. Assumes the current year,
 * unless that would land in the future, in which case it's last year's
 * transaction (handles statements spanning a Dec/Jan year boundary).
 */
function inferYear(month, day) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const candidate = new Date(currentYear, month - 1, day);
  return candidate > now ? currentYear - 1 : currentYear;
}

// ============================================================
// Column analysis
// ============================================================

export function looksLikeDate(raw) {
  if (raw instanceof Date) return !isNaN(raw);
  if (typeof raw === "number") return false;
  const s = String(raw ?? "").trim();
  if (!s) return false;
  if (
    ISO_DATE_RE.test(s) ||
    NUMERIC_DATE_RE.test(s) ||
    TEXT_DATE_PLAUSIBLE_RE.test(s) ||
    TEXT_DATE_PLAUSIBLE_RE_2.test(s)
  ) {
    return true;
  }

  const noYear1 = s.match(TEXT_DATE_NO_YEAR_RE_1);
  if (noYear1 && isMonthToken(noYear1[2])) return true;
  const noYear2 = s.match(TEXT_DATE_NO_YEAR_RE_2);
  if (noYear2 && isMonthToken(noYear2[1])) return true;

  return false;
}

function stripAmountToken(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return { text: "", explicitSign: null, parenNegative: false };

  let parenNegative = false;
  if (/^\(.*\)$/.test(s)) {
    parenNegative = true;
    s = s.slice(1, -1).trim();
  }

  let explicitSign = null;
  const suffix = s.match(/\s*(Dr|DR|dr|Cr|CR|cr)\.?$/);
  if (suffix) {
    explicitSign = /d/i.test(suffix[1]) ? "debit" : "credit";
    s = s.slice(0, suffix.index).trim();
  }
  if (!explicitSign) {
    const prefix = s.match(/^(Dr|DR|dr|Cr|CR|cr)\.?\s*/);
    if (prefix) {
      explicitSign = /d/i.test(prefix[1]) ? "debit" : "credit";
      s = s.slice(prefix[0].length).trim();
    }
  }

  s = s.replace(/[$€£₹,\s]/g, "");
  return { text: s, explicitSign, parenNegative };
}

export function looksLikeNumber(raw) {
  if (raw instanceof Date) return false;
  if (typeof raw === "number") return Number.isFinite(raw);
  const { text } = stripAmountToken(raw);
  return !!text && /^-?\d+(\.\d+)?$/.test(text);
}

export function parseAmountToken(raw) {
  if (typeof raw === "number") return { value: Number.isFinite(raw) ? raw : null, explicitSign: null };
  const { text, explicitSign, parenNegative } = stripAmountToken(raw);
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) return { value: null, explicitSign };
  let value = parseFloat(text);
  if (parenNegative) value = -Math.abs(value);
  return { value, explicitSign };
}

/** Analyzes each column over a sample of rows (date/numeric ratios, avg text length). */
export function analyzeColumns(headerRow, dataRows) {
  const nonBlankRows = dataRows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  const sample = nonBlankRows.slice(0, SAMPLE_SIZE);
  const n = sample.length || 1;

  const stats = headerRow.map((_, c) => {
    let dateHits = 0, numHits = 0, blanks = 0, textLenSum = 0, textCount = 0;
    for (const row of sample) {
      const cell = row[c];
      const str = String(cell ?? "").trim();
      if (!str) { blanks++; continue; }
      if (looksLikeDate(cell)) dateHits++;
      if (looksLikeNumber(cell)) numHits++;
      else { textLenSum += str.length; textCount++; }
    }
    return {
      index: c,
      dateRatio: dateHits / n,
      numericRatio: numHits / n,
      avgTextLength: textCount ? textLenSum / textCount : 0,
      blankRatio: blanks / n,
    };
  });

  return { stats, sampleSize: sample.length, nonBlankRowCount: nonBlankRows.length };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headerMatches(header, keywords) {
  const h = String(header ?? "");
  if (!h.trim()) return false;
  return keywords.some((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(h));
}

// ============================================================
// Column role detection
// ============================================================

export function detectDateColumn(headerRow, stats) {
  for (let i = 0; i < headerRow.length; i++) {
    if (headerMatches(headerRow[i], HEADER_KEYWORDS.date)) return i;
  }
  let best = null;
  for (const s of stats) {
    if (s.dateRatio >= 0.6 && (!best || s.dateRatio > best.dateRatio)) best = s;
  }
  return best ? best.index : -1;
}

export function detectDescriptionColumn(headerRow, stats, excludeSet) {
  for (let i = 0; i < headerRow.length; i++) {
    if (excludeSet.has(i)) continue;
    if (headerMatches(headerRow[i], HEADER_KEYWORDS.description)) return i;
  }
  let best = null;
  for (const s of stats) {
    if (excludeSet.has(s.index)) continue;
    if (s.numericRatio < 0.3 && (!best || s.avgTextLength > best.avgTextLength)) best = s;
  }
  return best ? best.index : -1;
}

export function detectAmountColumns(headerRow, stats, excludeSet) {
  let debitIdx = -1, creditIdx = -1;
  for (let i = 0; i < headerRow.length; i++) {
    if (excludeSet.has(i)) continue;
    if (debitIdx === -1 && headerMatches(headerRow[i], HEADER_KEYWORDS.debit)) debitIdx = i;
    if (creditIdx === -1 && headerMatches(headerRow[i], HEADER_KEYWORDS.credit)) creditIdx = i;
  }
  if (debitIdx !== -1 && creditIdx !== -1) {
    return { mode: "split", debitCol: debitIdx, creditCol: creditIdx };
  }

  for (let i = 0; i < headerRow.length; i++) {
    if (excludeSet.has(i)) continue;
    if (headerMatches(headerRow[i], HEADER_KEYWORDS.amount)) return { mode: "single", amountCol: i };
  }

  const candidates = stats.filter((s) => !excludeSet.has(s.index) && s.numericRatio >= 0.6);
  if (candidates.length === 1) return { mode: "single", amountCol: candidates[0].index };
  if (candidates.length >= 2) {
    return { mode: "ambiguous", candidates: candidates.map((c) => c.index) };
  }
  return null;
}

function detectCategoryColumn(headerRow, excludeSet) {
  for (let i = 0; i < headerRow.length; i++) {
    if (excludeSet.has(i)) continue;
    if (headerMatches(headerRow[i], HEADER_KEYWORDS.category)) return i;
  }
  return -1;
}

// ============================================================
// Date format detection & parsing
// ============================================================

/** DD/MM vs MM/DD, from the first unambiguous row (a day-part > 12). */
export function detectDateFormat(sampleValues) {
  for (const raw of sampleValues) {
    if (raw instanceof Date) continue;
    const s = String(raw ?? "").trim();
    const m = s.match(NUMERIC_DATE_RE);
    if (!m) continue;
    const p1 = Number(m[1]), p2 = Number(m[2]);
    if (p1 > 12 && p1 <= 31) return { format: "DD/MM", assumed: false };
    if (p2 > 12 && p2 <= 31) return { format: "MM/DD", assumed: false };
  }
  return { format: "MM/DD", assumed: true };
}

function expandYear(y) {
  if (y >= 100) return y;
  return y <= 49 ? 2000 + y : 1900 + y;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function isValidDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

export function parseDate(raw, format) {
  if (raw instanceof Date) {
    if (isNaN(raw)) return null;
    return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  }
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let m = s.match(ISO_DATE_RE);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    return isValidDate(y, mo, d) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }

  m = s.match(TEXT_DATE_RE_1);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!mon) return null;
    const d = Number(m[1]), y = expandYear(Number(m[3]));
    return isValidDate(y, mon, d) ? `${y}-${pad(mon)}-${pad(d)}` : null;
  }

  m = s.match(TEXT_DATE_RE_2);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (!mon) return null;
    const d = Number(m[2]), y = expandYear(Number(m[3]));
    return isValidDate(y, mon, d) ? `${y}-${pad(mon)}-${pad(d)}` : null;
  }

  m = s.match(NUMERIC_DATE_RE);
  if (m) {
    const p1 = Number(m[1]), p2 = Number(m[2]), y = expandYear(Number(m[3]));
    const [mo, d] = format === "DD/MM" ? [p2, p1] : [p1, p2];
    return isValidDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // Year-omitted text dates (e.g. "10 Jun" / "Jun 10") — common in
  // card-issuer "recent activity" exports. Year is inferred.
  m = s.match(TEXT_DATE_NO_YEAR_RE_1);
  if (m && isMonthToken(m[2])) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    const d = Number(m[1]);
    const y = inferYear(mon, d);
    return isValidDate(y, mon, d) ? `${y}-${pad(mon)}-${pad(d)}` : null;
  }

  m = s.match(TEXT_DATE_NO_YEAR_RE_2);
  if (m && isMonthToken(m[1])) {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
    const d = Number(m[2]);
    const y = inferYear(mon, d);
    return isValidDate(y, mon, d) ? `${y}-${pad(mon)}-${pad(d)}` : null;
  }

  return null;
}

// ============================================================
// Category-column resolution (FR-PARSE-6)
// ============================================================

function resolveFileCategory(rawLabel) {
  const norm = String(rawLabel ?? "").trim().toLowerCase();
  if (!norm) return null;
  const match = CATEGORIES.find((c) => c.id === norm || c.name.toLowerCase() === norm);
  return match ? match.id : null;
}

// ============================================================
// Row extraction
// ============================================================

function extractTransactions({ dataRows }, columnMap, dateFormat, userMappings, rowKind = "expense") {
  const diagnostics = { totalRows: 0, imported: 0, skippedCredits: 0, skippedBlank: 0, errors: 0, errorSamples: [] };
  const parsed = [];

  dataRows.forEach((row, idx) => {
    const isBlank = row.every((cell) => String(cell ?? "").trim() === "");
    if (isBlank) return;
    diagnostics.totalRows++;

    const dateRaw = row[columnMap.dateCol];
    const isoDate = parseDate(dateRaw, dateFormat);
    const description = String(row[columnMap.descCol] ?? "").trim();

    if (!isoDate) {
      diagnostics.errors++;
      if (diagnostics.errorSamples.length < 10) {
        diagnostics.errorSamples.push({ rowIndex: idx + 2, reason: `Unrecognized date: "${dateRaw ?? ""}"` });
      }
      return;
    }

    let rawValue = null, explicitSign = null;
    if (columnMap.mode === "split") {
      const debit = parseAmountToken(row[columnMap.debitCol]);
      const credit = parseAmountToken(row[columnMap.creditCol]);
      const hasDebit = debit.value !== null && debit.value !== 0;
      const hasCredit = credit.value !== null && credit.value !== 0;
      if (rowKind === "income") {
        // Income statements: money received is the credit side; debit-only rows are ignored.
        rawValue = hasCredit ? Math.abs(credit.value) : null;
        if (!hasCredit && hasDebit) explicitSign = "debit-only";
      } else {
        rawValue = hasDebit ? Math.abs(debit.value) : null;
        if (!hasDebit && hasCredit) explicitSign = "credit-only";
      }
    } else {
      const amt = parseAmountToken(row[columnMap.amountCol]);
      rawValue = amt.value;
      explicitSign = amt.explicitSign;
    }

    let categoryFromFile = null;
    if (rowKind === "expense" && columnMap.categoryCol !== -1) {
      categoryFromFile = resolveFileCategory(row[columnMap.categoryCol]);
    }

    parsed.push({ idx, isoDate, description, rawValue, explicitSign, categoryFromFile });
  });

  // Majority sign-flip (expense mode only) — computed once across the whole
  // single-amount column. Income statements skip this: every non-blank
  // amount is treated as money received, no credit/refund concept to drop.
  let signFlip = false;
  if (rowKind === "expense" && columnMap.mode === "single") {
    const withValue = parsed.filter((r) => r.rawValue !== null && r.explicitSign !== "debit" && r.explicitSign !== "credit");
    const neg = withValue.filter((r) => r.rawValue < 0).length;
    const pos = withValue.filter((r) => r.rawValue > 0).length;
    signFlip = neg > pos;
  }

  const transactions = [];
  for (const r of parsed) {
    let finalAmount = null;
    let dropReason = null;

    if (rowKind === "income") {
      if (columnMap.mode === "split") {
        finalAmount = r.rawValue;
        dropReason = finalAmount === null ? (r.explicitSign === "debit-only" ? "credit" : "blank") : null;
      } else if (r.rawValue === null) {
        dropReason = "blank";
      } else {
        finalAmount = Math.abs(r.rawValue);
      }
    } else if (columnMap.mode === "split") {
      finalAmount = r.rawValue;
      if (finalAmount === null) dropReason = r.explicitSign === "credit-only" ? "credit" : "blank";
    } else if (r.rawValue === null) {
      dropReason = "blank";
    } else if (r.explicitSign === "debit") {
      finalAmount = Math.abs(r.rawValue);
    } else if (r.explicitSign === "credit") {
      dropReason = "credit";
    } else if (signFlip) {
      finalAmount = r.rawValue < 0 ? Math.abs(r.rawValue) : null;
      if (finalAmount === null) dropReason = "credit";
    } else {
      finalAmount = r.rawValue > 0 ? r.rawValue : null;
      if (finalAmount === null) dropReason = "credit";
    }

    if (finalAmount === null || finalAmount === 0) {
      if (dropReason === "credit") diagnostics.skippedCredits++;
      else diagnostics.skippedBlank++;
      continue;
    }

    if (rowKind === "income") {
      transactions.push({ date: r.isoDate, description: r.description, amount: finalAmount });
    } else {
      const category = r.categoryFromFile || classify(r.description, userMappings);
      transactions.push({ date: r.isoDate, description: r.description, amount: finalAmount, category });
    }
  }

  diagnostics.imported = transactions.length;
  return { transactions, diagnostics };
}

// ============================================================
// Orchestrator
// ============================================================

/**
 * @param {{headerRow: any[], dataRows: any[][]}} sheet
 * @param {{userMappings?: object[], overrides?: object}} opts
 */
export function parseStatement({ headerRow, dataRows }, opts = {}) {
  const { userMappings = [], overrides = null, rowKind = "expense" } = opts;

  if (!headerRow || headerRow.length === 0) {
    return { fatalError: "The file appears to have no header row." };
  }
  if (!dataRows || dataRows.length === 0) {
    return { fatalError: "The file has a header row but no data rows." };
  }

  const { stats } = analyzeColumns(headerRow, dataRows);
  let columnMap;

  if (overrides) {
    columnMap =
      overrides.mode === "split"
        ? { mode: "split", debitCol: overrides.debitCol, creditCol: overrides.creditCol }
        : { mode: "single", amountCol: overrides.amountCol };
    columnMap.dateCol = overrides.dateCol;
    columnMap.descCol = overrides.descCol;
  } else {
    const used = new Set();
    const dateCol = detectDateColumn(headerRow, stats);
    if (dateCol === -1) {
      return { fatalError: "Couldn't detect a date column. Please check the file has a recognizable date column." };
    }
    used.add(dateCol);

    const descCol = detectDescriptionColumn(headerRow, stats, used);
    if (descCol === -1) {
      return { fatalError: "Couldn't detect a description column." };
    }
    used.add(descCol);

    const amountResult = detectAmountColumns(headerRow, stats, used);
    if (!amountResult) {
      return { fatalError: "Couldn't detect an amount column. Please check the file has a numeric amount, or separate debit/credit columns." };
    }
    if (amountResult.mode === "ambiguous") {
      return {
        fatalError: null,
        needsManualAmountColumn: true,
        message: "Two possible amount columns were found — please pick which one is the transaction amount.",
        candidateColumns: amountResult.candidates.map((i) => ({ index: i, header: headerRow[i] })),
        dateCol,
        descCol,
      };
    }

    used.add(amountResult.mode === "split" ? amountResult.debitCol : amountResult.amountCol);
    if (amountResult.mode === "split") used.add(amountResult.creditCol);

    columnMap = { dateCol, descCol, ...amountResult };
  }

  const excludeForCategory = new Set(
    columnMap.mode === "split"
      ? [columnMap.dateCol, columnMap.descCol, columnMap.debitCol, columnMap.creditCol]
      : [columnMap.dateCol, columnMap.descCol, columnMap.amountCol]
  );
  columnMap.categoryCol = detectCategoryColumn(headerRow, excludeForCategory);

  const dateSample = dataRows.slice(0, 200).map((r) => r[columnMap.dateCol]);
  const { format: dateFormat, assumed: dateFormatAssumed } = detectDateFormat(dateSample);

  const { transactions, diagnostics } = extractTransactions({ dataRows }, columnMap, dateFormat, userMappings, rowKind);

  return {
    fatalError: null,
    needsManualAmountColumn: false,
    columnMap,
    headerRow,
    dateFormat,
    dateFormatAssumed,
    transactions,
    diagnostics,
  };
}

/** Uses the global `XLSX` (SheetJS, loaded via CDN script tag) to turn raw bytes/text into {headerRow, dataRows}. */
export function workbookToRows(input, { isText = false } = {}) {
  const workbook = isText
    ? XLSX.read(input, { type: "string", cellDates: true })
    : XLSX.read(input, { type: "array", cellDates: true });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headerRow: [], dataRows: [] };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  if (rows.length === 0) return { headerRow: [], dataRows: [] };

  return { headerRow: rows[0].map((h) => String(h ?? "").trim()), dataRows: rows.slice(1) };
}
