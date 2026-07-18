const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Consistent $ USD formatting. Negative values shown in parentheses (FR-DASH-5). */
export function formatUSD(amount, { parensForNegative = false } = {}) {
  const n = Number(amount) || 0;
  if (parensForNegative && n < 0) {
    return `(${usdFormatter.format(Math.abs(n))})`;
  }
  return usdFormatter.format(n);
}

export function roundCents(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function sum(values) {
  return roundCents(values.reduce((acc, v) => acc + (Number(v) || 0), 0));
}
