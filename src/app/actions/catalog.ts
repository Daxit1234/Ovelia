"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB, Product, Wishlist } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { lookupPincode, type PincodeInfo } from "@/lib/data/pincode";
import { formatINR } from "@/lib/money";
import { PINCODE_REGEX } from "@/lib/india";
import { rateLimitByIp } from "@/lib/services/rate-limit";
import { reviewEligibility, submitReview } from "@/lib/services/reviews";
import { loadSettings } from "@/lib/services/settings";
import { checkServiceability } from "@/lib/services/shipping";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";

/* ---------------- Wishlist ---------------- */

export async function getWishlistIdsAction(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return [];
  await connectDB();
  const list = await Wishlist.findOne({ userId: toObjectId(user.id) }).lean();
  return list?.items.map((i) => i.productId.toHexString()) ?? [];
}

export async function toggleWishlistAction(productId: string): Promise<ActionResult<{ inWishlist: boolean }>> {
  if (!isObjectId(productId)) return fail("Invalid product");
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to save products to your wishlist.");
  try {
    await connectDB();
    const userId = toObjectId(user.id);
    const pid = toObjectId(productId);
    const removed = await Wishlist.updateOne({ userId, "items.productId": pid }, { $pull: { items: { productId: pid } } });
    if (removed.modifiedCount) return ok({ inWishlist: false }, "Removed from your wishlist");
    if (!(await Product.exists({ _id: pid, status: "published" }))) return fail("This product is no longer available.");
    await Wishlist.updateOne(
      { userId },
      { $push: { items: { $each: [{ productId: pid, addedAt: new Date() }], $slice: -200 } }, $setOnInsert: { userId } },
      { upsert: true },
    );
    return ok({ inWishlist: true }, "Saved to your wishlist");
  } catch (error) {
    return toActionError(error);
  }
}

/* ---------------- Delivery check ---------------- */

export interface DeliveryCheck {
  serviceable: boolean;
  message: string;
  codAvailable: boolean;
  place: PincodeInfo | null;
}

export async function checkDeliveryAction(pincode: string): Promise<ActionResult<DeliveryCheck>> {
  const pin = pincode.trim();
  if (!PINCODE_REGEX.test(pin)) return fail("Enter a valid 6-digit PIN code.");
  const limit = await rateLimitByIp("pincode", 30, 300);
  if (!limit.allowed) return fail("Too many checks. Please try again shortly.");
  try {
    const settings = await loadSettings();
    const [result, place] = await Promise.all([checkServiceability(pin, { cod: true, settings }), lookupPincode(pin)]);
    if (!result.serviceable) return ok({ serviceable: false, message: result.message ?? "We don't deliver to this PIN code yet.", codAvailable: false, place });
    const eta = result.estimatedDays ? `Estimated delivery in about ${result.estimatedDays} days after dispatch` : settings.shipping.standardEta;
    const threshold = settings.shipping.freeShippingThreshold;
    const parts = [
      `Delivery available${place?.city ? ` to ${place.city}` : ""}`,
      eta,
      threshold !== null ? `Free standard delivery above ${formatINR(threshold)}` : null,
    ].filter(Boolean);
    return ok({ serviceable: true, message: `${parts.join(". ")}.`, codAvailable: result.codAvailable, place });
  } catch (error) {
    return toActionError(error, "Could not check delivery right now.");
  }
}

export async function lookupPincodeAction(pincode: string): Promise<PincodeInfo | null> {
  if (!PINCODE_REGEX.test(pincode.trim())) return null;
  const limit = await rateLimitByIp("pincode-lookup", 40, 300);
  if (!limit.allowed) return null;
  return lookupPincode(pincode.trim());
}

/* ---------------- Reviews ---------------- */

export async function reviewEligibilityAction(productId: string): Promise<{ allowed: boolean; reason: string | null; signedIn: boolean }> {
  if (!isObjectId(productId)) return { allowed: false, reason: "Invalid product", signedIn: false };
  const user = await getSessionUser();
  const result = await reviewEligibility(productId, user?.id ?? null);
  return { allowed: result.allowed, reason: result.reason, signedIn: Boolean(user) };
}

const reviewSchema = z.object({
  productId: z.string().refine(isObjectId),
  rating: z.number().int().min(1, "Choose a star rating").max(5),
  title: z.string().trim().max(120),
  body: z.string().trim().min(10, "Please write at least 10 characters").max(2000),
});

export async function submitReviewAction(input: z.input<typeof reviewSchema>): Promise<ActionResult<{ status: "approved" | "pending" }>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your review.");
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to write a review.");
  const limit = await rateLimitByIp("review", 5, 3600);
  if (!limit.allowed) return fail("Too many reviews submitted. Please try again later.");
  try {
    const status = await submitReview({ ...parsed.data, user: { id: user.id, name: user.name } });
    return ok(
      { status },
      status === "approved" ? "Thank you! Your review is now live." : "Thank you! Your review will appear after a quick check by our team.",
    );
  } catch (error) {
    return toActionError(error, "Could not submit your review.");
  }
}
