const SUFFIX_WIDTH = 5;

/** `YYMM` in Asia/Hong_Kong, matching issued invoice numbers such as 260901866. */
export function invoiceNumberPrefixFromDate(now: Date): string {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const [year, month] = ymd.split("-");
  return `${year.slice(-2)}${month}`;
}

/**
 * Next unused `YYMM` + 5-digit suffix. The suffix is one higher than the
 * largest issued suffix for that month, so a deleted row cannot rewind the
 * sequence onto a number that is still in use.
 */
export function nextIssuedInvoiceNumber(prefix: string, usedNumbers: Iterable<string>): string {
  const pattern = new RegExp(`^${prefix}\\d{${SUFFIX_WIDTH}}$`);
  let max = 0;
  const used = new Set<number>();
  for (const raw of usedNumbers) {
    const num = raw.trim();
    if (!pattern.test(num)) continue;
    const suffix = Number(num.slice(prefix.length));
    if (!Number.isFinite(suffix)) continue;
    used.add(suffix);
    if (suffix > max) max = suffix;
  }
  let next = max + 1;
  while (used.has(next)) next += 1;
  return `${prefix}${String(next).padStart(SUFFIX_WIDTH, "0")}`;
}
