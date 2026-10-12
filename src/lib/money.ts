/**
 * All monetary values in Ovelia are stored and computed as integer paise
 * (1 rupee = 100 paise) to avoid floating point rounding errors.
 */
export type Paise = number;

export function toPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new Error("Invalid amount");
  return Math.round(rupees * 100);
}

export function toRupees(paise: Paise): number {
  return paise / 100;
}

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrFraction = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise as Indian Rupees, e.g. 129900 -> "₹1,299" and 129950 -> "₹1,299.50". */
export function formatINR(paise: Paise): string {
  const value = Math.round(paise);
  return value % 100 === 0 ? inrWhole.format(value / 100) : inrFraction.format(value / 100);
}

/** Always shows two decimals, used on invoices. */
export function formatINRPrecise(paise: Paise): string {
  return inrFraction.format(Math.round(paise) / 100);
}

/** Whole-number discount percentage, only when the MRP is genuinely higher. */
export function discountPercent(mrp: Paise, price: Paise): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.floor(((mrp - price) / mrp) * 100);
}

/**
 * Splits `total` across `weights` proportionally using the largest remainder
 * method so that the parts are integers that always sum to exactly `total`.
 */
export function allocateProportionally(total: Paise, weights: number[]): Paise[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (weightSum <= 0 || safeTotal === 0) return weights.map(() => 0);

  const raw = weights.map((w) => (Math.max(0, w) / weightSum) * safeTotal);
  const floored = raw.map(Math.floor);
  let remainder = safeTotal - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floored[index] += 1;
    remainder -= 1;
  }
  return floored;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? `${ONES[hundred]} Hundred` : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
}

/** Converts an integer rupee amount to words using the Indian numbering system. */
export function rupeesInWords(paise: Paise): string {
  const totalPaise = Math.round(Math.abs(paise));
  let rupees = Math.floor(totalPaise / 100);
  const remainingPaise = totalPaise % 100;
  if (rupees === 0 && remainingPaise === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  rupees %= 10_000_000;
  const lakh = Math.floor(rupees / 100_000);
  rupees %= 100_000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;

  if (crore) parts.push(`${crore >= 100 ? threeDigits(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));

  let words = parts.length ? `${parts.join(" ")} Rupees` : "";
  if (remainingPaise) words += `${words ? " and " : ""}${twoDigits(remainingPaise)} Paise`;
  return `${words} Only`;
}
