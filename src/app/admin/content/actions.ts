"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { actorFrom, authorize, type StaffUser } from "@/lib/auth/session";
import { TAGS } from "@/lib/cache-tags";
import { Banner, connectDB, Faq, Testimonial } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { parseIstDateTime } from "@/lib/format";
import { fail, ok, toActionError, zodFail, type ActionResult } from "@/lib/result";
import { audit, diff } from "@/lib/services/audit";
import { loadSettings, saveSettingsSection } from "@/lib/services/settings";
import { bannerInputSchema, faqInputSchema, testimonialInputSchema, type BannerInput, type FaqInput, type TestimonialInput } from "@/lib/validation/content";
import { announcementSectionSchema, homepageSectionSchema, type StoreSettings } from "@/lib/validation/settings";

type Kind = "banner" | "faq" | "testimonial";

async function logContent(user: StaffUser, kind: Kind, verb: "create" | "update" | "delete", id: string, label: string) {
  await audit({ actor: actorFrom(user), action: `${kind}.${verb}`, entityType: kind, entityId: id, summary: `${verb === "create" ? "Created" : verb === "update" ? "Updated" : "Deleted"} ${kind} “${label}”` });
}

export async function saveBannerAction(input: BannerInput, bannerId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = bannerInputSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (bannerId && !isObjectId(bannerId)) return fail("Banner not found");
  try {
    const user = await authorize("content:write");
    await connectDB();
    const doc = { ...parsed.data, startsAt: parseIstDateTime(parsed.data.startsAt), endsAt: parseIstDateTime(parsed.data.endsAt) };
    let id = bannerId;
    if (bannerId) {
      const res = await Banner.updateOne({ _id: toObjectId(bannerId) }, { $set: doc });
      if (res.matchedCount === 0) return fail("Banner not found");
    } else {
      id = (await Banner.create(doc))._id.toHexString();
    }
    updateTag(TAGS.content);
    await logContent(user, "banner", bannerId ? "update" : "create", id!, doc.title);
    return ok({ id: id! }, "Banner saved");
  } catch (error) {
    return toActionError(error, "Could not save the banner.");
  }
}

export async function saveFaqAction(input: FaqInput, faqId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = faqInputSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (faqId && !isObjectId(faqId)) return fail("Question not found");
  try {
    const user = await authorize("content:write");
    await connectDB();
    let id = faqId;
    if (faqId) {
      const res = await Faq.updateOne({ _id: toObjectId(faqId) }, { $set: parsed.data });
      if (res.matchedCount === 0) return fail("Question not found");
    } else {
      id = (await Faq.create(parsed.data))._id.toHexString();
    }
    updateTag(TAGS.content);
    await logContent(user, "faq", faqId ? "update" : "create", id!, parsed.data.question);
    return ok({ id: id! }, "Question saved");
  } catch (error) {
    return toActionError(error, "Could not save the question.");
  }
}

export async function saveTestimonialAction(input: TestimonialInput, testimonialId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = testimonialInputSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (testimonialId && !isObjectId(testimonialId)) return fail("Testimonial not found");
  try {
    const user = await authorize("content:write");
    await connectDB();
    let id = testimonialId;
    if (testimonialId) {
      const res = await Testimonial.updateOne({ _id: toObjectId(testimonialId) }, { $set: parsed.data });
      if (res.matchedCount === 0) return fail("Testimonial not found");
    } else {
      id = (await Testimonial.create(parsed.data))._id.toHexString();
    }
    updateTag(TAGS.content);
    await logContent(user, "testimonial", testimonialId ? "update" : "create", id!, parsed.data.name);
    return ok({ id: id! }, "Testimonial saved");
  } catch (error) {
    return toActionError(error, "Could not save the testimonial.");
  }
}

const MODELS = { banner: Banner, faq: Faq, testimonial: Testimonial } as const;

export async function deleteContentAction(kind: Kind, id: string): Promise<ActionResult<null>> {
  if (!(kind in MODELS) || !isObjectId(id)) return fail("Not found");
  try {
    const user = await authorize("content:write");
    await connectDB();
    const model = MODELS[kind] as typeof Banner;
    const deleted = await model.findByIdAndDelete(toObjectId(id)).lean();
    if (!deleted) return fail("Not found");
    updateTag(TAGS.content);
    const doc = deleted as unknown as { title?: string; question?: string; name?: string };
    await logContent(user, kind, "delete", id, doc.title ?? doc.question ?? doc.name ?? id);
    return ok(null, "Deleted");
  } catch (error) {
    return toActionError(error);
  }
}

/* ---------------- Homepage & announcement (stored in settings) ---------------- */

const SECTION_SCHEMAS = { homepage: homepageSectionSchema, announcement: announcementSectionSchema } as const;

export async function saveContentSettingsAction<S extends keyof typeof SECTION_SCHEMAS>(section: S, input: z.input<(typeof SECTION_SCHEMAS)[S]>): Promise<ActionResult<null>> {
  if (!(section in SECTION_SCHEMAS)) return fail("Unknown section");
  const parsed = SECTION_SCHEMAS[section].safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const user = await authorize("content:write");
    const before = (await loadSettings())[section];
    await saveSettingsSection(section, parsed.data as StoreSettings[S], user.id);
    updateTag(TAGS.settings);
    await audit({
      actor: actorFrom(user),
      action: `settings.${section}`,
      entityType: "settings",
      entityId: section,
      summary: `Updated ${section === "homepage" ? "homepage content" : "announcement bar"}`,
      changes: diff(before as unknown as Record<string, unknown>, parsed.data as Record<string, unknown>),
    });
    return ok(null, "Saved");
  } catch (error) {
    return toActionError(error, "Could not save.");
  }
}
