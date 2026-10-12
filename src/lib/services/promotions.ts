import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectDB, Order, Promotion, PromotionRedemption, type PromotionDoc } from "@/lib/db";
import type { AppliedPromotion, CouponInput, PricingPromotion } from "@/lib/domain/pricing";
import { AppError } from "@/lib/result";
import { toObjectId } from "@/lib/db/model";

export interface CustomerIdentity {
  userId: string | null;
  email: string | null;
  phone: string | null;
}

export function toPricingPromotion(doc: Pick<PromotionDoc, keyof PromotionDoc>): PricingPromotion {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    code: doc.code ?? null,
    isAutomatic: doc.isAutomatic,
    type: doc.type,
    value: doc.value,
    maxDiscount: doc.maxDiscount ?? null,
    appliesTo: doc.appliesTo,
    productIds: (doc.productIds ?? []).map((id) => id.toHexString()),
    categoryIds: (doc.categoryIds ?? []).map((id) => id.toHexString()),
    buyQuantity: doc.buyQuantity ?? 1,
    getQuantity: doc.getQuantity ?? 1,
    getDiscountPercent: doc.getDiscountPercent ?? 100,
    bundleItems: (doc.bundleItems ?? []).map((item) => ({
      productId: item.productId.toHexString(),
      variantId: item.variantId ? item.variantId.toHexString() : null,
      quantity: item.quantity,
    })),
    bundlePrice: doc.bundlePrice ?? null,
    minSubtotal: doc.minSubtotal ?? 0,
    minQuantity: doc.minQuantity ?? 0,
    firstOrderOnly: doc.firstOrderOnly,
    stackable: doc.stackable,
    priority: doc.priority ?? 0,
    startsAt: doc.startsAt ?? null,
    endsAt: doc.endsAt ?? null,
  };
}

function activeWindow(now: Date) {
  return {
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      { $or: [{ usageLimit: null }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] },
    ],
  };
}

/** Automatic promotions that are live now and still have redemptions left. */
export async function loadAutomaticPromotions(now: Date, identity?: CustomerIdentity): Promise<PricingPromotion[]> {
  await connectDB();
  const docs = await Promotion.find({ ...activeWindow(now), isAutomatic: true }).lean();
  const result: PricingPromotion[] = [];
  for (const doc of docs) {
    if (doc.usageLimitPerCustomer && identity && (await customerRedemptionCount(doc._id, identity)) >= doc.usageLimitPerCustomer) {
      continue;
    }
    result.push(toPricingPromotion(doc));
  }
  return result;
}

function identityFilter(identity: CustomerIdentity): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = [];
  if (identity.userId) or.push({ userId: identity.userId });
  if (identity.email) or.push({ email: identity.email.toLowerCase() });
  if (identity.phone) or.push({ phone: identity.phone });
  return or;
}

async function customerRedemptionCount(promotionId: Types.ObjectId, identity: CustomerIdentity, session?: ClientSession | null) {
  const or = identityFilter(identity);
  if (or.length === 0) return 0;
  return PromotionRedemption.countDocuments(
    { promotionId, status: { $in: ["reserved", "confirmed"] }, $or: or },
    { session: session ?? undefined },
  );
}

/** Looks up a coupon code and applies usage-limit checks. */
export async function resolveCoupon(rawCode: string, identity: CustomerIdentity, now: Date): Promise<CouponInput> {
  const code = rawCode.trim().toUpperCase();
  await connectDB();
  const doc = await Promotion.findOne({ code }).lean();
  if (!doc || !doc.isActive) return { code, promotion: null, blockedReason: "This coupon code is not valid." };
  const promotion = toPricingPromotion(doc);
  if (doc.usageLimit !== null && doc.usageCount >= doc.usageLimit) {
    return { code, promotion, blockedReason: "This coupon has reached its usage limit." };
  }
  if (doc.usageLimitPerCustomer) {
    const used = await customerRedemptionCount(doc._id, identity);
    if (used >= doc.usageLimitPerCustomer) {
      return {
        code,
        promotion,
        blockedReason:
          doc.usageLimitPerCustomer === 1
            ? "You have already used this coupon."
            : `This coupon can be used ${doc.usageLimitPerCustomer} times per customer.`,
      };
    }
  }
  if (now && doc.startsAt && doc.startsAt > now) return { code, promotion, blockedReason: "This offer has not started yet." };
  return { code, promotion, blockedReason: null };
}

/**
 * Whether the customer has never had a successful order. Returns null when
 * the customer cannot be identified yet (guest cart before checkout).
 */
export async function isFirstOrder(identity: CustomerIdentity): Promise<boolean | null> {
  const or: Record<string, unknown>[] = [];
  if (identity.userId) or.push({ userId: identity.userId });
  if (identity.email) or.push({ "customer.email": identity.email.toLowerCase() });
  if (identity.phone) or.push({ "customer.phone": identity.phone });
  if (or.length === 0) return null;
  await connectDB();
  const previous = await Order.exists({ $or: or, status: { $nin: ["pending_payment", "cancelled"] } });
  return !previous;
}

/**
 * Records promotion usage for an order and increments usage counters with an
 * atomic limit guard, so concurrent checkouts cannot exceed a usage limit.
 */
export async function recordRedemptions(
  order: { _id: Types.ObjectId; orderNumber: string; userId: Types.ObjectId | null; customer: { email: string; phone: string } },
  applied: AppliedPromotion[],
  status: "reserved" | "confirmed",
  session: ClientSession | null,
): Promise<void> {
  const incremented: Types.ObjectId[] = [];
  try {
    for (const promo of applied) {
      const promotionId = toObjectId(promo.id);
      const doc = await Promotion.findOne({ _id: promotionId }, { usageLimitPerCustomer: 1, name: 1 }, { session: session ?? undefined }).lean();
      if (doc?.usageLimitPerCustomer) {
        const used = await customerRedemptionCount(
          promotionId,
          { userId: order.userId?.toHexString() ?? null, email: order.customer.email, phone: order.customer.phone },
          session,
        );
        if (used >= doc.usageLimitPerCustomer) {
          throw new AppError(`The offer "${promo.name}" has already been used on your account.`, "PROMOTION_LIMIT");
        }
      }
      const res = await Promotion.updateOne(
        { _id: promotionId, $or: [{ usageLimit: null }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] },
        { $inc: { usageCount: 1 } },
        { session: session ?? undefined },
      );
      if (res.modifiedCount === 0) {
        throw new AppError(`The offer "${promo.name}" is no longer available. Please review your cart.`, "PROMOTION_LIMIT");
      }
      incremented.push(promotionId);
      await PromotionRedemption.create(
        [
          {
            promotionId,
            orderId: order._id,
            orderNumber: order.orderNumber,
            userId: order.userId,
            email: order.customer.email,
            phone: order.customer.phone,
            code: promo.code,
            amount: promo.amount,
            status,
          },
        ],
        { session: session ?? undefined },
      );
    }
  } catch (error) {
    if (!session) {
      for (const id of incremented) {
        await Promotion.updateOne({ _id: id, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } }).catch(() => undefined);
      }
      await PromotionRedemption.deleteMany({ orderId: order._id }).catch(() => undefined);
    }
    throw error;
  }
}

export async function confirmRedemptions(orderId: Types.ObjectId, session: ClientSession | null): Promise<void> {
  await PromotionRedemption.updateMany({ orderId, status: "reserved" }, { $set: { status: "confirmed" } }, { session: session ?? undefined });
}

/** Frees promotion usage when an order is cancelled or never paid. Idempotent. */
export async function releaseRedemptions(orderId: Types.ObjectId, session: ClientSession | null): Promise<void> {
  const redemptions = await PromotionRedemption.find(
    { orderId, status: { $in: ["reserved", "confirmed"] } },
    { promotionId: 1 },
    { session: session ?? undefined },
  ).lean();
  for (const redemption of redemptions) {
    const res = await PromotionRedemption.updateOne(
      { _id: redemption._id, status: { $ne: "released" } },
      { $set: { status: "released" } },
      { session: session ?? undefined },
    );
    if (res.modifiedCount === 1) {
      await Promotion.updateOne(
        { _id: redemption.promotionId, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } },
        { session: session ?? undefined },
      );
    }
  }
}

/** Promotions flagged for display on the storefront (offers page, banners). */
export async function listStorefrontPromotions(now: Date) {
  await connectDB();
  return Promotion.find({ ...activeWindow(now), showOnStorefront: true }).sort({ priority: -1, createdAt: -1 }).lean();
}
