import "server-only";
import { connectDB, StoreSettingsModel } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/content/default-settings";
import {
  SETTINGS_SECTION_SCHEMAS,
  settingsSchema,
  type SettingsSection,
  type StoreSettings,
} from "@/lib/validation/settings";
import { formatINR } from "@/lib/money";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T)) ?? base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = (base as Record<string, unknown>)[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result as T;
}

/**
 * Reads settings from the database merged over defaults. Invalid stored
 * sections fall back to defaults so a bad edit can never break checkout.
 */
export async function loadSettings(): Promise<StoreSettings> {
  await connectDB();
  const doc = await StoreSettingsModel.findOne({ key: "default" }).lean();
  if (!doc) return structuredClone(DEFAULT_SETTINGS);

  const merged = {} as Record<SettingsSection, unknown>;
  for (const section of Object.keys(SETTINGS_SECTION_SCHEMAS) as SettingsSection[]) {
    const candidate = deepMerge(DEFAULT_SETTINGS[section], (doc as unknown as Record<string, unknown>)[section]);
    const parsed = SETTINGS_SECTION_SCHEMAS[section].safeParse(candidate);
    merged[section] = parsed.success ? parsed.data : DEFAULT_SETTINGS[section];
  }
  return settingsSchema.parse(merged);
}

export async function saveSettingsSection<S extends SettingsSection>(
  section: S,
  value: StoreSettings[S],
  updatedBy: string | null,
): Promise<StoreSettings[S]> {
  const parsed = SETTINGS_SECTION_SCHEMAS[section].parse(value) as StoreSettings[S];
  await connectDB();
  await StoreSettingsModel.updateOne(
    { key: "default" },
    { $set: { [section]: parsed, updatedBy }, $setOnInsert: { key: "default" } },
    { upsert: true },
  );
  return parsed;
}

/** Fills {{tokens}} in policy templates with live settings values. */
export function renderPolicyTokens(template: string, settings: StoreSettings): string {
  const s = settings.store;
  const address = [s.address.line1, s.address.line2, s.address.city, s.address.state, s.address.pincode]
    .filter(Boolean)
    .join(", ");
  const tokens: Record<string, string> = {
    storeName: s.name || "Ovelia",
    legalName: s.legalName || "[Registered business name]",
    supportEmail: s.supportEmail || "[support email]",
    supportPhone: s.supportPhone || "[support phone]",
    address: address || "[registered business address]",
    returnWindowDays: String(settings.orders.returnWindowDays),
    standardFee: settings.shipping.standardFee === 0 ? "Free" : formatINR(settings.shipping.standardFee),
    expressFee: formatINR(settings.shipping.expressFee),
    codFee: settings.payments.codFee === 0 ? "no extra charge" : formatINR(settings.payments.codFee),
    freeShippingThreshold:
      settings.shipping.freeShippingThreshold === null ? "[not offered]" : formatINR(settings.shipping.freeShippingThreshold),
    processingTime: settings.shipping.processingTime,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => tokens[key] ?? match);
}

/** Business details still missing before launch (shown on the dashboard). */
export function launchChecklist(settings: StoreSettings): string[] {
  const missing: string[] = [];
  const s = settings.store;
  if (!s.legalName) missing.push("Registered business (legal) name");
  if (!s.supportEmail) missing.push("Customer support email");
  if (!s.supportPhone) missing.push("Customer support phone number");
  if (!s.address.line1 || !s.address.city || !s.address.pincode) missing.push("Registered business address");
  if (!s.gstin) missing.push("GSTIN for tax invoices");
  if (!settings.tax.storeState) missing.push("Store state (needed for CGST/SGST vs IGST)");
  const placeholderPolicies = (Object.entries(settings.policies) as [string, string][])
    .filter(([, text]) => /\[[^\]]+\]/.test(text))
    .map(([name]) => name);
  if (placeholderPolicies.length) missing.push(`Replace [placeholders] in: ${placeholderPolicies.join(", ")}`);
  return missing;
}
