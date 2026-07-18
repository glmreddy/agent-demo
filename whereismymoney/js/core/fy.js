// Financial Year = calendar year, Jan–Dec (resolved with the user; overrides
// any Apr–Mar wording elsewhere in the original spec).

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function getCurrentFY() {
  return new Date().getFullYear();
}

/** @returns {string[]} the 12 "YYYY-MM" month keys for a given FY, Jan..Dec */
export function getFYMonths(fy) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${fy}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export function getFYFromDate(isoDate) {
  return Number(String(isoDate).slice(0, 4));
}

export function monthLabel(yyyymm) {
  const [y, m] = yyyymm.split("-");
  return `${MONTH_ABBR[Number(m) - 1]} ${y}`;
}

export function monthAbbrOnly(yyyymm) {
  const [, m] = yyyymm.split("-");
  return MONTH_ABBR[Number(m) - 1];
}

/**
 * Years present across a set of ISO date strings, plus the current FY,
 * sorted descending (newest first) — used to populate FY selectors.
 */
export function getYearsInData(isoDates) {
  const years = new Set([getCurrentFY()]);
  for (const d of isoDates) {
    if (d) years.add(getFYFromDate(d));
  }
  return Array.from(years).sort((a, b) => b - a);
}
