import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStatement,
  detectDateColumn,
  detectDescriptionColumn,
  detectAmountColumns,
  detectDateFormat,
  parseDate,
  looksLikeDate,
  looksLikeNumber,
  parseAmountToken,
  analyzeColumns,
} from "../js/import/parser.js";

// ---------- looksLikeDate / looksLikeNumber ----------

test("looksLikeDate recognizes ISO, numeric, and text-month dates", () => {
  assert.equal(looksLikeDate("2026-01-02"), true);
  assert.equal(looksLikeDate("02/01/2026"), true);
  assert.equal(looksLikeDate("2/1/26"), true);
  assert.equal(looksLikeDate("02 Jan '26"), true);
  assert.equal(looksLikeDate("Jan 02, 2026"), true);
  assert.equal(looksLikeDate("not a date"), false);
  assert.equal(looksLikeDate(""), false);
});

test("looksLikeNumber strips currency symbols, commas, Dr/Cr, parens", () => {
  assert.equal(looksLikeNumber("$1,234.56"), true);
  assert.equal(looksLikeNumber("1234.56 Dr"), true);
  assert.equal(looksLikeNumber("(45.00)"), true);
  assert.equal(looksLikeNumber("₹500"), true);
  assert.equal(looksLikeNumber("not a number"), false);
});

test("parseAmountToken handles parentheses as negative and explicit Dr/Cr", () => {
  assert.deepEqual(parseAmountToken("(45.00)"), { value: -45, explicitSign: null });
  assert.deepEqual(parseAmountToken("1,234.56 Dr"), { value: 1234.56, explicitSign: "debit" });
  assert.deepEqual(parseAmountToken("500.00 Cr"), { value: 500, explicitSign: "credit" });
  assert.deepEqual(parseAmountToken("$99.99"), { value: 99.99, explicitSign: null });
});

// ---------- Column detection ----------

test("detects date/description/amount columns via header keywords", () => {
  const headerRow = ["Transaction Date", "Details", "Amount"];
  const dataRows = [
    ["01/15/2026", "Starbucks Coffee", "5.75"],
    ["01/16/2026", "Amazon.com", "42.10"],
  ];
  const { stats } = analyzeColumns(headerRow, dataRows);
  assert.equal(detectDateColumn(headerRow, stats), 0);
  const used = new Set([0]);
  assert.equal(detectDescriptionColumn(headerRow, stats, used), 1);
  used.add(1);
  assert.deepEqual(detectAmountColumns(headerRow, stats, used), { mode: "single", amountCol: 2 });
});

test("detects split debit/credit columns via header keywords, even when 'amount' is a substring", () => {
  const headerRow = ["Date", "Narration", "Debit Amount", "Credit Amount"];
  const { stats } = analyzeColumns(headerRow, [["01/01/2026", "Test", "10.00", ""]]);
  const used = new Set([0, 1]);
  assert.deepEqual(detectAmountColumns(headerRow, stats, used), { mode: "split", debitCol: 2, creditCol: 3 });
});

test("falls back to positional numeric detection with no header keywords", () => {
  const headerRow = ["Col A", "Col B", "Col C"];
  const dataRows = [
    ["01/15/2026", "Some merchant description here", "12.34"],
    ["01/16/2026", "Another merchant description", "56.78"],
  ];
  const { stats } = analyzeColumns(headerRow, dataRows);
  const dateCol = detectDateColumn(headerRow, stats);
  assert.equal(dateCol, 0);
  const used = new Set([dateCol]);
  const descCol = detectDescriptionColumn(headerRow, stats, used);
  assert.equal(descCol, 1);
  used.add(descCol);
  assert.deepEqual(detectAmountColumns(headerRow, stats, used), { mode: "single", amountCol: 2 });
});

test("reports ambiguous amount columns when two numeric columns have no header hints", () => {
  const headerRow = ["Col A", "Col B", "Col C", "Col D"];
  const dataRows = [["01/15/2026", "A merchant description", "12.34", "99.00"]];
  const { stats } = analyzeColumns(headerRow, dataRows);
  const used = new Set([0, 1]);
  const result = detectAmountColumns(headerRow, stats, used);
  assert.equal(result.mode, "ambiguous");
  assert.deepEqual(result.candidates, [2, 3]);
});

// ---------- Date format disambiguation ----------

test("detects DD/MM from an unambiguous row (day > 12)", () => {
  const result = detectDateFormat(["25/01/2026", "02/03/2026"]);
  assert.deepEqual(result, { format: "DD/MM", assumed: false });
});

test("detects MM/DD from an unambiguous row (month slot > 12 impossible, day slot does the job)", () => {
  const result = detectDateFormat(["01/25/2026", "02/03/2026"]);
  assert.deepEqual(result, { format: "MM/DD", assumed: false });
});

test("defaults to MM/DD and flags assumed=true when every row is ambiguous", () => {
  const result = detectDateFormat(["01/02/2026", "03/04/2026"]);
  assert.deepEqual(result, { format: "MM/DD", assumed: true });
});

// ---------- Date parsing ----------

test("parses ISO dates directly", () => {
  assert.equal(parseDate("2026-07-18", "MM/DD"), "2026-07-18");
});

test("parses DD/MM vs MM/DD according to detected format", () => {
  assert.equal(parseDate("25/01/2026", "DD/MM"), "2026-01-25");
  assert.equal(parseDate("01/25/2026", "MM/DD"), "2026-01-25");
});

test("expands 2-digit years using the 00-49/50-99 window", () => {
  assert.equal(parseDate("01/02/26", "MM/DD"), "2026-01-02");
  assert.equal(parseDate("01/02/85", "MM/DD"), "1985-01-02");
});

test("parses text-month dates like \"02 Jan '26\" and \"Jan 02, 2026\"", () => {
  assert.equal(parseDate("02 Jan '26", "MM/DD"), "2026-01-02");
  assert.equal(parseDate("Jan 02, 2026", "MM/DD"), "2026-01-02");
});

test("parses year-omitted text dates like \"Jun 10\" and \"10 Jun\", inferring the year", () => {
  const thisYear = new Date().getFullYear();
  assert.equal(parseDate("Jun 10", "MM/DD"), `${thisYear}-06-10`);
  assert.equal(parseDate("10 Jun", "MM/DD"), `${thisYear}-06-10`);
});

test("year-omitted dates in the future roll back to last year (statement spanning a year boundary)", () => {
  const now = new Date();
  if (now.getMonth() === 11 && now.getDate() === 31) return; // no "future" to prove on Dec 31 itself
  const currentYear = now.getFullYear();
  const candidateThisYear = new Date(currentYear, 11, 31); // Dec 31 is always >= today except on Dec 31
  const expectedYear = candidateThisYear > now ? currentYear - 1 : currentYear;
  assert.equal(parseDate("Dec 31", "MM/DD"), `${expectedYear}-12-31`);
});

test("looksLikeDate recognizes year-omitted text dates but not random two-word text", () => {
  assert.equal(looksLikeDate("Jun 10"), true);
  assert.equal(looksLikeDate("10 Jun"), true);
  assert.equal(looksLikeDate("50 Off"), false);
  assert.equal(looksLikeDate("Big Mac"), false);
});

test("rejects invalid dates (e.g. day 31 in a 30-day month)", () => {
  assert.equal(parseDate("31/02/2026", "DD/MM"), null);
  assert.equal(parseDate("not a date", "MM/DD"), null);
});

// ---------- Full pipeline: parseStatement ----------

test("parseStatement classifies a clean single-amount statement end to end", () => {
  const headerRow = ["Date", "Description", "Amount"];
  const dataRows = [
    ["01/15/2026", "STARBUCKS STORE #123", "5.75"],
    ["01/16/2026", "COSTCO WHOLESALE", "142.30"],
    ["01/17/2026", "UNKNOWN MERCHANT XYZ", "20.00"],
  ];
  const result = parseStatement({ headerRow, dataRows });
  assert.equal(result.fatalError, null);
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[0].category, "dining");
  assert.equal(result.transactions[1].category, "groceries");
  assert.equal(result.transactions[2].category, "other");
  assert.equal(result.diagnostics.imported, 3);
});

test("parseStatement drops credit rows via majority sign-flip (negative-as-spend convention)", () => {
  const headerRow = ["Date", "Description", "Amount"];
  const dataRows = [
    ["01/15/2026", "Grocery Store", "-45.00"],
    ["01/16/2026", "Gas Station", "-30.00"],
    ["01/17/2026", "Coffee Shop", "-5.00"],
    ["01/18/2026", "Refund", "45.00"], // minority positive -> dropped as credit
  ];
  const result = parseStatement({ headerRow, dataRows });
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions.every((t) => t.amount > 0), true);
  assert.equal(result.diagnostics.skippedCredits, 1);
});

test("parseStatement handles split debit/credit columns, ignoring credit entirely", () => {
  const headerRow = ["Date", "Narration", "Debit", "Credit"];
  const dataRows = [
    ["01/15/2026", "Grocery Store", "45.00", ""],
    ["01/16/2026", "Salary Deposit", "", "3000.00"],
  ];
  const result = parseStatement({ headerRow, dataRows });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amount, 45);
  assert.equal(result.diagnostics.skippedCredits, 1);
});

test("parseStatement uses an existing category column from the file when present", () => {
  const headerRow = ["Date", "Description", "Amount", "Category"];
  const dataRows = [["01/15/2026", "Random merchant text", "10.00", "Entertainment"]];
  const result = parseStatement({ headerRow, dataRows });
  assert.equal(result.transactions[0].category, "entertainment");
});

test("parseStatement fails safely with a clear message when no date column can be found", () => {
  const headerRow = ["Foo", "Bar", "Baz"];
  const dataRows = [["x", "y", "z"]];
  const result = parseStatement({ headerRow, dataRows });
  assert.ok(result.fatalError);
  assert.equal(result.transactions, undefined);
});

test("parseStatement surfaces needsManualAmountColumn instead of guessing on ambiguous numeric columns", () => {
  const headerRow = ["Date", "Description", "Col C", "Col D"];
  const dataRows = [["01/15/2026", "A merchant description here", "12.34", "99.00"]];
  const result = parseStatement({ headerRow, dataRows });
  assert.equal(result.needsManualAmountColumn, true);
  assert.equal(result.candidateColumns.length, 2);
});

test("parseStatement respects manual column overrides", () => {
  const headerRow = ["Date", "Description", "Col C", "Col D"];
  const dataRows = [["01/15/2026", "A merchant description here", "12.34", "99.00"]];
  const result = parseStatement(
    { headerRow, dataRows },
    { overrides: { mode: "single", dateCol: 0, descCol: 1, amountCol: 2 } }
  );
  assert.equal(result.fatalError, null);
  assert.equal(result.transactions[0].amount, 12.34);
});

test("parseStatement respects the user mapping table over built-in keywords", () => {
  const headerRow = ["Date", "Description", "Amount"];
  const dataRows = [["01/15/2026", "STARBUCKS STORE #123", "5.75"]];
  const result = parseStatement(
    { headerRow, dataRows },
    { userMappings: [{ keyword: "starbucks", category: "shopping" }] }
  );
  assert.equal(result.transactions[0].category, "shopping");
});

test("parseStatement in income mode treats every amount as money received, no credit-drop logic", () => {
  const headerRow = ["Date", "Description", "Amount"];
  const dataRows = [
    ["01/15/2026", "Salary", "3000.00"],
    ["01/20/2026", "Freelance payment", "-500.00"], // would be dropped as minority in expense mode
  ];
  const result = parseStatement({ headerRow, dataRows }, { rowKind: "income" });
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].amount, 3000);
  assert.equal(result.transactions[1].amount, 500);
  assert.equal(result.transactions[0].category, undefined);
});

test("parseStatement in income mode with split columns treats the credit side as money received", () => {
  const headerRow = ["Date", "Narration", "Debit", "Credit"];
  const dataRows = [
    ["01/15/2026", "Salary Deposit", "", "3000.00"],
    ["01/16/2026", "ATM Withdrawal", "100.00", ""],
  ];
  const result = parseStatement({ headerRow, dataRows }, { rowKind: "income" });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amount, 3000);
  assert.equal(result.diagnostics.skippedCredits, 1);
});

test("parseStatement is a pure function — same input always yields the same output", () => {
  const headerRow = ["Date", "Description", "Amount"];
  const dataRows = [["01/15/2026", "Costco", "10.00"]];
  const a = parseStatement({ headerRow, dataRows });
  const b = parseStatement({ headerRow, dataRows });
  assert.deepEqual(a, b);
});
