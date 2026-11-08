/** All money in Sippy Brew is integer cents. Never use floats for money. */
export function assertCents(value: number, label = "amount"): void {
  if (!Number.isInteger(value)) throw new Error(`${label} must be integer cents, got ${value}`);
}

export function formatCents(cents: number, opts: { showZeroCents?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const rem = abs % 100;
  const body = rem === 0 && !opts.showZeroCents ? `$${dollars}` : `$${dollars}.${String(rem).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  return total;
}
