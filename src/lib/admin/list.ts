import "server-only";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, key: string): string {
  const value = params[key];
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

export function pageParam(params: SearchParams): number {
  const n = Number(param(params, "page"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 1000) : 1;
}

export function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Parses a yyyy-mm-dd date in IST; returns null when invalid. */
export function parseDay(value: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Keeps only non-empty params, for building pagination links. */
export function compact(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined));
}
