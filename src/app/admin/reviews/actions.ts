"use server";

import { z } from "zod";
import { actorFrom, authorize } from "@/lib/auth/session";
import { connectDB, Review } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import { moderateReview, replyToReview, type ReviewModeration } from "@/lib/services/reviews";

const MODERATIONS: ReviewModeration[] = ["approve", "reject", "feature", "unfeature", "delete"];
const DONE: Record<ReviewModeration, string> = { approve: "Review approved", reject: "Review rejected", feature: "Review featured", unfeature: "Review unfeatured", delete: "Review deleted" };

export async function moderateReviewAction(reviewId: string, action: ReviewModeration): Promise<ActionResult<null>> {
  if (!isObjectId(reviewId) || !MODERATIONS.includes(action)) return fail("Invalid request");
  try {
    const user = await authorize("reviews:moderate");
    await connectDB();
    const review = await Review.findById(toObjectId(reviewId), { authorName: 1, rating: 1, productId: 1 }).lean();
    await moderateReview(reviewId, action, user.id);
    await audit({
      actor: actorFrom(user),
      action: `review.${action}`,
      entityType: "review",
      entityId: reviewId,
      summary: `${DONE[action]}: ${review ? `${review.rating}★ by ${review.authorName}` : reviewId}`,
      changes: review ? { productId: review.productId.toHexString() } : null,
    });
    return ok(null, DONE[action]);
  } catch (error) {
    return toActionError(error);
  }
}

const replySchema = z.string().trim().max(1000, "Keep replies under 1000 characters");

export async function replyToReviewAction(reviewId: string, reply: string): Promise<ActionResult<null>> {
  const parsed = replySchema.safeParse(reply);
  if (!isObjectId(reviewId) || !parsed.success) return fail(parsed.error?.issues[0]?.message ?? "Invalid request");
  try {
    const user = await authorize("reviews:moderate");
    await replyToReview(reviewId, parsed.data, user.id);
    await audit({ actor: actorFrom(user), action: "review.reply", entityType: "review", entityId: reviewId, summary: parsed.data ? "Replied to a review" : "Removed a review reply" });
    return ok(null, parsed.data ? "Reply published" : "Reply removed");
  } catch (error) {
    return toActionError(error);
  }
}
