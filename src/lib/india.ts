/**
 * Indian states and union territories with their GST state codes. The GST code
 * is printed as the "place of supply" on tax invoices.
 */
export const INDIAN_STATES = [
  { name: "Andaman and Nicobar Islands", code: "35", type: "ut" },
  { name: "Andhra Pradesh", code: "37", type: "state" },
  { name: "Arunachal Pradesh", code: "12", type: "state" },
  { name: "Assam", code: "18", type: "state" },
  { name: "Bihar", code: "10", type: "state" },
  { name: "Chandigarh", code: "04", type: "ut" },
  { name: "Chhattisgarh", code: "22", type: "state" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26", type: "ut" },
  { name: "Delhi", code: "07", type: "ut" },
  { name: "Goa", code: "30", type: "state" },
  { name: "Gujarat", code: "24", type: "state" },
  { name: "Haryana", code: "06", type: "state" },
  { name: "Himachal Pradesh", code: "02", type: "state" },
  { name: "Jammu and Kashmir", code: "01", type: "ut" },
  { name: "Jharkhand", code: "20", type: "state" },
  { name: "Karnataka", code: "29", type: "state" },
  { name: "Kerala", code: "32", type: "state" },
  { name: "Ladakh", code: "38", type: "ut" },
  { name: "Lakshadweep", code: "31", type: "ut" },
  { name: "Madhya Pradesh", code: "23", type: "state" },
  { name: "Maharashtra", code: "27", type: "state" },
  { name: "Manipur", code: "14", type: "state" },
  { name: "Meghalaya", code: "17", type: "state" },
  { name: "Mizoram", code: "15", type: "state" },
  { name: "Nagaland", code: "13", type: "state" },
  { name: "Odisha", code: "21", type: "state" },
  { name: "Puducherry", code: "34", type: "ut" },
  { name: "Punjab", code: "03", type: "state" },
  { name: "Rajasthan", code: "08", type: "state" },
  { name: "Sikkim", code: "11", type: "state" },
  { name: "Tamil Nadu", code: "33", type: "state" },
  { name: "Telangana", code: "36", type: "state" },
  { name: "Tripura", code: "16", type: "state" },
  { name: "Uttar Pradesh", code: "09", type: "state" },
  { name: "Uttarakhand", code: "05", type: "state" },
  { name: "West Bengal", code: "19", type: "state" },
] as const;

export type IndianStateName = (typeof INDIAN_STATES)[number]["name"];

export const INDIAN_STATE_NAMES = INDIAN_STATES.map((s) => s.name) as unknown as [
  IndianStateName,
  ...IndianStateName[],
];

export function isIndianState(value: string): value is IndianStateName {
  return INDIAN_STATES.some((s) => s.name === value);
}

export function gstStateCode(state: string): string | null {
  return INDIAN_STATES.find((s) => s.name === state)?.code ?? null;
}

/** Six digits, first digit 1-9 (India Post PIN format). */
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/** Ten-digit Indian mobile number starting with 6-9. */
export const MOBILE_REGEX = /^[6-9][0-9]{9}$/;

/** GSTIN: 2-digit state code, PAN (10), entity number, Z, checksum. */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Normalises user input like "+91 98765 43210", "098765-43210" or
 * "9876543210" to a bare 10 digit mobile number. Returns null when invalid.
 */
export function normalizeIndianMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE_REGEX.test(digits) ? digits : null;
}

export function formatIndianMobile(mobile: string): string {
  const digits = normalizeIndianMobile(mobile);
  if (!digits) return mobile;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return "";
  const digits = mobile.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return "••••";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

/** Current Indian financial year label (April to March), e.g. "2026-27". */
export function financialYear(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const calendarYear = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const year = month >= 4 ? calendarYear : calendarYear - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}
