"use server";

import { updateTag } from "next/cache";
import { actorFrom, authorize } from "@/lib/auth/session";
import { TAGS } from "@/lib/cache-tags";
import { isObjectId } from "@/lib/db/model";
import { deletePromotion, describeOffer, savePromotion, setPromotionActive } from "@/lib/admin/promotions";
import { fail, ok, toActionError, zodFail, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import { promotionInputSchema, type PromotionInput } from "@/lib/validation/promotion";

export async function savePromotionAction(input: PromotionInput, promotionId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = promotionInputSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error, "Please fix the highlighted fields.");
  if (promotionId && !isObjectId(promotionId)) return fail("Promotion not found");
  try {
    const user = await authorize("promotions:write");
    const result = await savePromotion(parsed.data, user.id, promotionId);
    updateTag(TAGS.promotions);
    const d = parsed.data;
    await audit({
      actor: actorFrom(user),
      action: promotionId ? "promotion.update" : "promotion.create",
      entityType: "promotion",
      entityId: result.id,
      summary: `${promotionId ? "Updated" : "Created"} promotion ${d.name}${d.trigger === "code" ? ` (${d.code})` : " (automatic)"}`,
      changes: { type: d.type, value: d.value, maxDiscount: d.maxDiscount, appliesTo: d.appliesTo, minSubtotal: d.minSubtotal, startsAt: d.startsAt, endsAt: d.endsAt, isActive: d.isActive, usageLimit: d.usageLimit },
    });
    return ok(result, promotionId ? "Promotion saved" : "Promotion created");
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail("That coupon code is already in use.");
    return toActionError(error, "Could not save the promotion.");
  }
}

export async function setPromotionActiveAction(promotionId: string, isActive: boolean): Promise<ActionResult<null>> {
  if (!isObjectId(promotionId)) return fail("Promotion not found");
  try {
    const user = await authorize("promotions:write");
    const promo = await setPromotionActive(promotionId, isActive);
    updateTag(TAGS.promotions);
    await audit({ actor: actorFrom(user), action: isActive ? "promotion.activate" : "promotion.pause", entityType: "promotion", entityId: promotionId, summary: `${isActive ? "Activated" : "Paused"} ${promo.name} (${describeOffer(promo)})` });
    return ok(null, isActive ? "Promotion activated" : "Promotion paused");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePromotionAction(promotionId: string): Promise<ActionResult<null>> {
  if (!isObjectId(promotionId)) return fail("Promotion not found");
  try {
    const user = await authorize("promotions:write");
    const promo = await deletePromotion(promotionId);
    updateTag(TAGS.promotions);
    await audit({ actor: actorFrom(user), action: "promotion.delete", entityType: "promotion", entityId: promotionId, summary: `Deleted promotion ${promo.name}${promo.code ? ` (${promo.code})` : ""}` });
    return ok(null, "Promotion deleted");
  } catch (error) {
    return toActionError(error, "Could not delete the promotion.");
  }
}
