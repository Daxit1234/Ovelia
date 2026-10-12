import "server-only";
import type { Types } from "mongoose";
import { connectDB, Order, Product, Review } from "@/lib/db";
import { ObjectId } from "@/lib/db/model";
import { invalidate, TAGS } from "@/lib/cache-tags";
import { AppError, NotFoundError } from "@/lib/result";
import { loadSettings } from "@/lib/services/settings";

export async function recomputeProductRating(productId: Types.ObjectId): Promise<void> {
  const [stats] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { productId, status: "approved" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    { $set: { ratingAverage: stats ? Math.round(stats.avg * 10) / 10 : 0, ratingCount: stats?.count ?? 0 } },
  );
  invalidate(TAGS.product(productId.toHexString()), TAGS.reviews(productId.toHexString()), TAGS.catalog);
}

export async function reviewEligibility(productId: string, userId: string | null): Promise<{ allowed: boolean; reason: string | null; orderId: Types.ObjectId | null }> {
  await connectDB();
  const settings = await loadSettings();
  if (!settings.reviews.enabled) return { allowed: false, reason: "Reviews are currently turned off.", orderId: null };
  const product = await Product.findOne({ _id: productId, status: "published" }, { reviewsEnabled: 1 }).lean();
  if (!product) return { allowed: false, reason: "Product not found.", orderId: null };
  if (!product.reviewsEnabled) return { allowed: false, reason: "Reviews are not enabled for this product.", orderId: null };
  if (!userId) return { allowed: false, reason: "Sign in to write a review.", orderId: null };
  if (await Review.exists({ productId, userId })) return { allowed: false, reason: "You have already reviewed this product.", orderId: null };
  const order = await Order.findOne(
    { userId, status: { $in: ["delivered", "returned"] }, "items.productId": new ObjectId(productId) },
    { _id: 1 },
  ).lean();
  if (settings.reviews.requirePurchase && !order) {
    return { allowed: false, reason: "Reviews can be written by customers who have received this product.", orderId: null };
  }
  return { allowed: true, reason: null, orderId: order?._id ?? null };
}

export async function submitReview(input: {
  productId: string;
  user: { id: string; name: string };
  rating: number;
  title: string;
  body: string;
}): Promise<"approved" | "pending"> {
  const eligibility = await reviewEligibility(input.productId, input.user.id);
  if (!eligibility.allowed) throw new AppError(eligibility.reason ?? "You cannot review this product.");
  const settings = await loadSettings();
  const status = settings.reviews.autoApprove ? "approved" : "pending";
  const firstName = input.user.name.trim().split(/\s+/)[0] ?? "Customer";
  const lastInitial = input.user.name.trim().split(/\s+/)[1]?.[0];
  try {
    await Review.create({
      productId: new ObjectId(input.productId),
      userId: new ObjectId(input.user.id),
      orderId: eligibility.orderId,
      authorName: lastInitial ? `${firstName} ${lastInitial}.` : firstName,
      rating: input.rating,
      title: input.title,
      body: input.body,
      status,
      verifiedPurchase: Boolean(eligibility.orderId),
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AppError("You have already reviewed this product.");
    throw error;
  }
  if (status === "approved") await recomputeProductRating(new ObjectId(input.productId));
  return status;
}

export type ReviewModeration = "approve" | "reject" | "feature" | "unfeature" | "delete";

export async function moderateReview(reviewId: string, action: ReviewModeration, moderatorId: string): Promise<void> {
  await connectDB();
  const review = await Review.findById(reviewId).lean();
  if (!review) throw new NotFoundError("Review not found");
  if (action === "delete") {
    await Review.deleteOne({ _id: review._id });
  } else {
    const set: Record<string, unknown> = { moderatedBy: new ObjectId(moderatorId), moderatedAt: new Date() };
    if (action === "approve") set.status = "approved";
    if (action === "reject") Object.assign(set, { status: "rejected", isFeatured: false });
    if (action === "feature") Object.assign(set, { isFeatured: true, status: "approved" });
    if (action === "unfeature") set.isFeatured = false;
    await Review.updateOne({ _id: review._id }, { $set: set });
  }
  await recomputeProductRating(review.productId);
  invalidate(TAGS.content);
}

export async function replyToReview(reviewId: string, reply: string, moderatorId: string): Promise<void> {
  await connectDB();
  const review = await Review.findByIdAndUpdate(reviewId, {
    $set: { adminReply: reply, moderatedBy: new ObjectId(moderatorId), moderatedAt: new Date() },
  }).lean();
  if (!review) throw new NotFoundError("Review not found");
  invalidate(TAGS.reviews(review.productId.toHexString()));
}
