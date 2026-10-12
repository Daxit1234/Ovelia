"use server";

import { updateTag } from "next/cache";
import { actorFrom, authorize } from "@/lib/auth/session";
import { TAGS } from "@/lib/cache-tags";
import { fail, ok, toActionError, zodFail, type ActionResult } from "@/lib/result";
import { audit, diff } from "@/lib/services/audit";
import { loadSettings, saveSettingsSection } from "@/lib/services/settings";
import { SETTINGS_SECTION_SCHEMAS, type SettingsSection, type StoreSettings } from "@/lib/validation/settings";

/** Sections edited on the Settings page (homepage and announcement live under Storefront content). */
const EDITABLE: SettingsSection[] = ["store", "shipping", "payments", "tax", "orders", "reviews", "seo", "policies"];

export async function saveSettingsAction(section: SettingsSection, input: unknown): Promise<ActionResult<null>> {
  if (!EDITABLE.includes(section)) return fail("Unknown settings section");
  const parsed = SETTINGS_SECTION_SCHEMAS[section].safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const user = await authorize("settings:write");
    const before = (await loadSettings())[section] as unknown as Record<string, unknown>;
    await saveSettingsSection(section, parsed.data as StoreSettings[typeof section], user.id);
    updateTag(TAGS.settings);
    const changes = diff(before, parsed.data as Record<string, unknown>);
    await audit({
      actor: actorFrom(user),
      action: `settings.${section}`,
      entityType: "settings",
      entityId: section,
      summary: `Updated ${section} settings${Object.keys(changes).length ? `: ${Object.keys(changes).join(", ")}` : " (no changes)"}`,
      // Policy texts are long; record which ones changed rather than their full text.
      changes: section === "policies" ? { changed: Object.keys(changes) } : changes,
    });
    return ok(null, "Settings saved");
  } catch (error) {
    return toActionError(error, "Could not save settings.");
  }
}
