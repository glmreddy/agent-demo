import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../js/core/classifier.js";

test("classifies a built-in keyword match, case-insensitively", () => {
  assert.equal(classify("STARBUCKS #4021 SEATTLE"), "dining");
  assert.equal(classify("costco wholesale"), "groceries");
});

test("falls back to 'other' when nothing matches", () => {
  assert.equal(classify("XYZ RANDOM MERCHANT 998"), "other");
});

test("empty/blank description falls back to 'other'", () => {
  assert.equal(classify(""), "other");
  assert.equal(classify("   "), "other");
  assert.equal(classify(undefined), "other");
});

test("user mapping table takes priority over built-in rules", () => {
  // "starbucks" would normally classify as dining; user override says shopping.
  const mappings = [{ keyword: "starbucks", category: "shopping" }];
  assert.equal(classify("STARBUCKS #4021", mappings), "shopping");
});

test("user mapping match is a case-insensitive substring", () => {
  const mappings = [{ keyword: "Acme Corp", category: "household" }];
  assert.equal(classify("payment to acme corp llc", mappings), "household");
});

test("first matching user mapping wins when multiple could match", () => {
  const mappings = [
    { keyword: "acme", category: "household" },
    { keyword: "acme corp", category: "shopping" },
  ];
  assert.equal(classify("ACME CORP PAYMENT", mappings), "household");
});

test("built-in category order determines precedence on multi-category text", () => {
  // "amazon" (shopping) appears after "netflix" isn't relevant here; construct
  // a description that could plausibly hit two lists and confirm array order wins.
  // "walmart" -> groceries comes before "shopping" list in CATEGORIES order.
  assert.equal(classify("walmart supercenter amazon locker"), "groceries");
});

test("classification is a pure function of its inputs (same input -> same output)", () => {
  const mappings = [{ keyword: "foo", category: "farm" }];
  const a = classify("Foo Bar Payment", mappings);
  const b = classify("Foo Bar Payment", mappings);
  assert.equal(a, b);
});
