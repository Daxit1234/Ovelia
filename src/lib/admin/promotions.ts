import "server-only";
import type { QueryFilter } from "mongoose";
import { Category, connectDB, Product, Promotion, PromotionRedemption, type PromotionDoc, type VariantDoc } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { PROMOTION_TYPES, type PromotionType } from "@/lib/domain/pricing";
import { escapeRegex, formatDate, parseIstDateTime, toIstDateTimeInput } from "@/lib/format";
import { formatINR, toPaise } from "@/lib/money";
import { AppError, NotFoundError } from "@/lib/result";
import { oneOf, pageParam, param, type SearchParams } from "@/lib/admin/list";
import type { PromotionData, PromotionInput } from "@/lib/validation/promotion";

export const PROMOTION_STATES = ["active", "scheduled", "expired", "paused", "used_up"] as const;
export type PromotionState = (typeof PROMOTION_STATES)[number];
export const PROMOTION_STATE_LABELS: Record<PromotionState, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  paused: "Paused",
  used_up: "Limit reached",
};

type PromotionLike = Pick<PromotionDoc, "isActive" | "startsAt" | "endsAt" | "usageLimit" | "usageCount">;

export function promotionState(p: PromotionLike, now: Date): PromotionState {
  if (!p.isActive) return "paused";
  if (p.endsAt && p.endsAt < now) return "expired";
  if (p.usageLimit !== null && p.usageCount >= p.usageLimit) return "used_up";
  if (p.startsAt && p.startsAt > now) return "scheduled";
  return "active";
}

/** One-line description of the offer, e.g. "10% off, up to ₹100". */
export function describeOffer(p: Pick<PromotionDoc, "type" | "value" | "maxDiscount" | "buyQuantity" | "getQuantity" | "getDiscountPercent" | "bundlePrice">): string {
  const cap = p.maxDiscount ? `, up to ${formatINR(p.maxDiscount)}` : "";
  switch (p.type) {
    case "percentage":
      return `${p.value}% off${cap}`;
    case "fixed":
      return `${formatINR(p.value)} off`;
    case "free_shipping":
      return "Free standard shipping";
    case "buy_x_get_y":
      return `Buy ${p.buyQuantity}, get ${p.getQuantity} ${p.getDiscountPercent >= 100 ? "free" : `at ${p.getDiscountPercent}% off`}${cap}`;
    case "bundle":
      return `Combo for ${p.bundlePrice ? formatINR(p.bundlePrice) : "—"}`;
  }
}

export function describeConditions(p: Pick<PromotionDoc, "minSubtotal" | "minQuantity" | "firstOrderOnly" | "usageLimitPerCustomer">): string {
  const parts: string[] = [];
  if (p.minSubtotal > 0) parts.push(`Min. ${formatINR(p.minSubtotal)}`);
  if (p.minQuantity > 0) parts.push(`Min. ${p.minQuantity} items`);
  if (p.firstOrderOnly) parts.push("First order");
  if (p.usageLimitPerCustomer) parts.push(`${p.usageLimitPerCustomer}× per customer`);
  return parts.join(" · ") || "None";
}

export function describeSchedule(p: Pick<PromotionDoc, "startsAt" | "endsAt">): string {
  if (!p.startsAt && !p.endsAt) return "Always on";
  if (p.startsAt && p.endsAt) return `${formatDate(p.startsAt)} – ${formatDate(p.endsAt)}`;
  return p.startsAt ? `From ${formatDate(p.startsAt)}` : `Until ${formatDate(p.endsAt)}`;
}

export interface PromotionFilters {
  q: string;
  state: "" | PromotionState;
  type: "" | PromotionType;
  page: number;
}

export function parsePromotionFilters(params: SearchParams): PromotionFilters {
  return {
    q: param(params, "q").slice(0, 60),
    state: oneOf(param(params, "state"), ["", ...PROMOTION_STATES] as const, ""),
    type: oneOf(param(params, "type"), ["", ...PROMOTION_TYPES] as const, ""),
    page: pageParam(params),
  };
}

export const PROMOTIONS_PAGE_SIZE = 25;

/** Promotions are few, so state (which depends on the clock) is filtered in memory. */
export async function listPromotions(filters: PromotionFilters, now = new Date()) {
  await connectDB();
  const query: QueryFilter<PromotionDoc> = {};
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ name: rx }, { code: rx }, { campaign: rx }];
  }
  if (filters.type) query.type = filters.type;
  const docs = await Promotion.find(query).sort({ isActive: -1, priority: -1, createdAt: -1 }).limit(2000).lean();
  const withState = docs.map((p) => ({ ...p, state: promotionState(p, now) }));
  const rows = filters.state ? withState.filter((p) => p.state === filters.state) : withState;
  const start = (filters.page - 1) * PROMOTIONS_PAGE_SIZE;
  return { rows: rows.slice(start, start + PROMOTIONS_PAGE_SIZE), total: rows.length, pageCount: Math.ceil(rows.length / PROMOTIONS_PAGE_SIZE) };
}

export async function getPromotionForm(id: string) {
  if (!isObjectId(id)) return null;
  await connectDB();
  const p = await Promotion.findById(toObjectId(id)).lean();
  if (!p) return null;
  const values: PromotionInput = {
    name: p.name,
    description: p.description,
    campaign: p.campaign,
    trigger: p.isAutomatic ? "automatic" : "code",
    code: p.code ?? "",
    type: p.type,
    value: p.type === "fixed" ? p.value / 100 : p.value,
    maxDiscount: p.maxDiscount === null ? null : p.maxDiscount / 100,
    appliesTo: p.appliesTo,
    productIds: (p.productIds ?? []).map((x) => x.toHexString()),
    categoryIds: (p.categoryIds ?? []).map((x) => x.toHexString()),
    buyQuantity: p.buyQuantity,
    getQuantity: p.getQuantity,
    getDiscountPercent: p.getDiscountPercent,
    bundleItems: (p.bundleItems ?? []).map((i) => ({ productId: i.productId.toHexString(), variantId: i.variantId?.toHexString() ?? "", quantity: i.quantity })),
    bundlePrice: p.bundlePrice === null ? null : p.bundlePrice / 100,
    minSubtotal: p.minSubtotal / 100,
    minQuantity: p.minQuantity,
    firstOrderOnly: p.firstOrderOnly,
    usageLimit: p.usageLimit,
    usageLimitPerCustomer: p.usageLimitPerCustomer,
    stackable: p.stackable,
    priority: p.priority,
    startsAt: toIstDateTimeInput(p.startsAt),
    endsAt: toIstDateTimeInput(p.endsAt),
    isActive: p.isActive,
    showOnStorefront: p.showOnStorefront,
    bannerText: p.bannerText,
  };
  const stats = await PromotionRedemption.aggregate<{ _id: string; count: number; amount: number }>([
    { $match: { promotionId: p._id } },
    { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
  ]);
  const confirmed = stats.find((s) => s._id === "confirmed");
  return {
    id: p._id.toHexString(),
    name: p.name,
    state: promotionState(p, new Date()),
    values,
    usage: {
      usageCount: p.usageCount,
      usageLimit: p.usageLimit,
      confirmed: confirmed?.count ?? 0,
      discountGiven: confirmed?.amount ?? 0,
      pending: stats.find((s) => s._id === "reserved")?.count ?? 0,
    },
  };
}

export async function recentRedemptions(id: string, limit = 25) {
  if (!isObjectId(id)) return [];
  await connectDB();
  return PromotionRedemption.find({ promotionId: toObjectId(id) }).sort({ createdAt: -1 }).limit(limit).lean();
}

/** Products with their variants, for scope and combo pickers. */
export async function productVariantOptions(): Promise<{ id: string; name: string; variants: { id: string; label: string; sku: string }[] }[]> {
  await connectDB();
  const docs = await Product.find({}, { name: 1, variants: 1 }).sort({ name: 1 }).lean();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    name: d.name,
    variants: (d.variants as VariantDoc[]).map((v) => ({ id: v._id.toHexString(), label: v.label, sku: v.sku })),
  }));
}

export async function savePromotion(data: PromotionData, actorId: string, promotionId?: string): Promise<{ id: string }> {
  await connectDB();
  const existing = promotionId ? await Promotion.findById(toObjectId(promotionId), { _id: 1 }).lean() : null;
  if (promotionId && !existing) throw new NotFoundError("Promotion not found");

  const code = data.trigger === "code" ? data.code : null;
  if (code && (await Promotion.exists({ code, ...(existing ? { _id: { $ne: existing._id } } : {}) }))) {
    throw new AppError(`Another promotion already uses the code ${code}.`);
  }

  const isBundle = data.type === "bundle";
  const scope = isBundle || data.type === "free_shipping" ? "all" : data.appliesTo;
  const productIds = scope === "products" ? [...new Set(data.productIds)] : [];
  const categoryIds = scope === "categories" ? [...new Set(data.categoryIds)] : [];
  if (productIds.length && (await Product.countDocuments({ _id: { $in: productIds.map(toObjectId) } })) !== productIds.length) {
    throw new AppError("One of the chosen products no longer exists.");
  }
  if (categoryIds.length && (await Category.countDocuments({ _id: { $in: categoryIds.map(toObjectId) } })) !== categoryIds.length) {
    throw new AppError("One of the chosen categories no longer exists.");
  }
  if (isBundle) {
    const products = await Product.find({ _id: { $in: data.bundleItems.map((i) => toObjectId(i.productId)) } }, { variants: 1 }).lean();
    for (const item of data.bundleItems) {
      const product = products.find((p) => p._id.toHexString() === item.productId);
      if (!product) throw new AppError("One of the combo products no longer exists.");
      if (item.variantId && !(product.variants as VariantDoc[]).some((v) => v._id.toHexString() === item.variantId)) {
        throw new AppError("One of the combo sizes no longer exists. Choose it again.");
      }
    }
  }

  const doc = {
    name: data.name,
    description: data.description,
    campaign: data.campaign,
    code,
    isAutomatic: data.trigger === "automatic",
    type: data.type,
    value: data.type === "percentage" ? data.value : data.type === "fixed" ? toPaise(data.value) : 0,
    maxDiscount: (data.type === "percentage" || data.type === "buy_x_get_y") && data.maxDiscount ? toPaise(data.maxDiscount) : null,
    appliesTo: scope,
    productIds: productIds.map(toObjectId),
    categoryIds: categoryIds.map(toObjectId),
    buyQuantity: data.buyQuantity,
    getQuantity: data.getQuantity,
    getDiscountPercent: data.getDiscountPercent,
    bundleItems: isBundle ? data.bundleItems.map((i) => ({ productId: toObjectId(i.productId), variantId: i.variantId ? toObjectId(i.variantId) : null, quantity: i.quantity })) : [],
    bundlePrice: isBundle && data.bundlePrice ? toPaise(data.bundlePrice) : null,
    minSubtotal: toPaise(data.minSubtotal),
    minQuantity: data.minQuantity,
    firstOrderOnly: data.firstOrderOnly,
    usageLimit: data.usageLimit,
    usageLimitPerCustomer: data.usageLimitPerCustomer,
    stackable: data.stackable,
    priority: data.priority,
    startsAt: data.startsAt ? parseIstDateTime(data.startsAt) : null,
    endsAt: data.endsAt ? parseIstDateTime(data.endsAt) : null,
    isActive: data.isActive,
    showOnStorefront: data.showOnStorefront,
    bannerText: data.bannerText,
  };

  if (existing) {
    await Promotion.updateOne({ _id: existing._id }, { $set: doc }, { runValidators: true });
    return { id: existing._id.toHexString() };
  }
  const created = await Promotion.create({ ...doc, createdBy: toObjectId(actorId) });
  return { id: created._id.toHexString() };
}

export async function setPromotionActive(id: string, isActive: boolean): Promise<PromotionDoc> {
  await connectDB();
  const promo = await Promotion.findByIdAndUpdate(toObjectId(id), { $set: { isActive } }, { returnDocument: "after" }).lean();
  if (!promo) throw new NotFoundError("Promotion not found");
  return promo;
}

/** Deletes an unused promotion. Used ones are kept so order history stays explainable. */
export async function deletePromotion(id: string): Promise<PromotionDoc> {
  await connectDB();
  const used = await PromotionRedemption.countDocuments({ promotionId: toObjectId(id) });
  if (used > 0) throw new AppError(`This promotion was used on ${used} order${used === 1 ? "" : "s"}. Pause it instead so order history stays intact.`);
  const promo = await Promotion.findByIdAndDelete(toObjectId(id)).lean();
  if (!promo) throw new NotFoundError("Promotion not found");
  return promo;
}
