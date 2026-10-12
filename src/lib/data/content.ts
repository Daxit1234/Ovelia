import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Banner, connectDB, Faq, Product, Promotion, Review, Testimonial } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";
import { getProductsByIds } from "@/lib/data/catalog";
import { loadSettings, renderPolicyTokens } from "@/lib/services/settings";
import { integrations } from "@/lib/env";
import type { StoreSettings } from "@/lib/validation/settings";
import type { ProductCardData } from "@/lib/types";

export async function getSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.settings);
  return loadSettings();
}

/** Settings safe to expose in the browser. */
export interface PublicSettings {
  store: StoreSettings["store"];
  announcement: StoreSettings["announcement"];
  shipping: Pick<StoreSettings["shipping"], "standardLabel" | "standardEta" | "standardFee" | "expressEnabled" | "expressLabel" | "expressEta" | "expressFee" | "freeShippingThreshold" | "processingTime">;
  payments: StoreSettings["payments"] & { razorpayConfigured: boolean };
  orders: Pick<StoreSettings["orders"], "guestCheckoutEnabled" | "maxQuantityPerItem" | "returnsEnabled" | "returnWindowDays">;
  homepage: StoreSettings["homepage"];
  seo: StoreSettings["seo"];
}

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.settings);
  const s = await loadSettings();
  return {
    store: s.store,
    announcement: s.announcement,
    shipping: {
      standardLabel: s.shipping.standardLabel,
      standardEta: s.shipping.standardEta,
      standardFee: s.shipping.standardFee,
      expressEnabled: s.shipping.expressEnabled,
      expressLabel: s.shipping.expressLabel,
      expressEta: s.shipping.expressEta,
      expressFee: s.shipping.expressFee,
      freeShippingThreshold: s.shipping.freeShippingThreshold,
      processingTime: s.shipping.processingTime,
    },
    payments: { ...s.payments, razorpayConfigured: integrations.razorpay() },
    orders: {
      guestCheckoutEnabled: s.orders.guestCheckoutEnabled,
      maxQuantityPerItem: s.orders.maxQuantityPerItem,
      returnsEnabled: s.orders.returnsEnabled,
      returnWindowDays: s.orders.returnWindowDays,
    },
    homepage: s.homepage,
    seo: s.seo,
  };
}

export type PolicyKey = keyof StoreSettings["policies"];

export async function getPolicy(key: PolicyKey): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.settings);
  const settings = await loadSettings();
  return renderPolicyTokens(settings.policies[key], settings);
}

export interface BannerView {
  id: string;
  placement: "hero" | "promo";
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  imageAlt: string;
  theme: "green" | "teal" | "blue" | "light";
}

export async function getBanners(placement: "hero" | "promo"): Promise<BannerView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.content);
  await connectDB();
  const now = new Date();
  const docs = await Banner.find({
    placement,
    isActive: true,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }],
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(6)
    .lean();
  return docs.map((b) => ({
    id: b._id.toHexString(),
    placement: b.placement,
    eyebrow: b.eyebrow,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    imageUrl: b.imageUrl,
    imageAlt: b.imageAlt,
    theme: b.theme,
  }));
}

export interface FaqView {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export async function getFaqs(homeOnly = false): Promise<FaqView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.content);
  await connectDB();
  const docs = await Faq.find({ isPublished: true, ...(homeOnly ? { showOnHome: true } : {}) })
    .sort({ category: 1, sortOrder: 1 })
    .lean();
  return docs.map((f) => ({ id: f._id.toHexString(), question: f.question, answer: f.answer, category: f.category }));
}

export interface TestimonialView {
  id: string;
  name: string;
  location: string;
  quote: string;
  rating: number | null;
  source: "testimonial" | "review";
  productName?: string;
  verified?: boolean;
}

/**
 * Genuine customer voices only: published testimonials entered by staff and
 * approved product reviews that staff have featured.
 */
export async function getTestimonials(limit = 6): Promise<TestimonialView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.content);
  await connectDB();
  const [testimonials, reviews] = await Promise.all([
    Testimonial.find({ isPublished: true, consentConfirmed: true }).sort({ sortOrder: 1 }).limit(limit).lean(),
    Review.find({ status: "approved", isFeatured: true }).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  const productNames = new Map(
    (await Product.find({ _id: { $in: reviews.map((r) => r.productId) } }, { name: 1 }).lean()).map((p) => [p._id.toHexString(), p.name]),
  );
  return [
    ...testimonials.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      location: t.location,
      quote: t.quote,
      rating: t.rating,
      source: "testimonial" as const,
    })),
    ...reviews.map((r) => ({
      id: r._id.toHexString(),
      name: r.authorName,
      location: "",
      quote: r.body || r.title,
      rating: r.rating,
      source: "review" as const,
      productName: productNames.get(r.productId.toHexString()),
      verified: r.verifiedPurchase,
    })),
  ].slice(0, limit);
}

export interface OfferView {
  id: string;
  name: string;
  description: string;
  bannerText: string;
  code: string | null;
  isAutomatic: boolean;
  type: string;
  value: number;
  bundlePrice: number | null;
  minSubtotal: number;
  endsAt: string | null;
  startsAt: string | null;
  /** Starts in the future (computed when the cache entry is built). */
  upcoming: boolean;
  bundleProducts: { product: ProductCardData; variantId: string | null; quantity: number }[];
}

export async function getStorefrontOffers(): Promise<OfferView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.promotions, TAGS.catalog);
  await connectDB();
  const now = new Date();
  const docs = await Promotion.find({
    isActive: true,
    showOnStorefront: true,
    $and: [
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      { $or: [{ usageLimit: null }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] },
    ],
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();
  const productIds = [...new Set(docs.flatMap((d) => d.bundleItems.map((i) => i.productId.toHexString())))];
  const products = new Map((await getProductsByIds(productIds)).map((p) => [p.id, p]));
  return docs.map((d) => ({
    id: d._id.toHexString(),
    name: d.name,
    description: d.description,
    bannerText: d.bannerText,
    code: d.isAutomatic ? null : d.code,
    isAutomatic: d.isAutomatic,
    type: d.type,
    value: d.value,
    bundlePrice: d.bundlePrice,
    minSubtotal: d.minSubtotal,
    startsAt: d.startsAt ? d.startsAt.toISOString() : null,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    upcoming: !!d.startsAt && d.startsAt > now,
    bundleProducts: d.bundleItems
      .map((i) => ({ product: products.get(i.productId.toHexString())!, variantId: i.variantId?.toHexString() ?? null, quantity: i.quantity }))
      .filter((i) => i.product),
  }));
}

export interface ReviewView {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  adminReply: string;
  createdAt: string;
}

export async function getProductReviews(productId: string): Promise<{ reviews: ReviewView[]; distribution: number[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.reviews(productId));
  await connectDB();
  const docs = await Review.find({ productId, status: "approved" }).sort({ createdAt: -1 }).limit(50).lean();
  const distribution = [0, 0, 0, 0, 0];
  for (const r of docs) distribution[5 - r.rating] += 1;
  return {
    reviews: docs.map((r) => ({
      id: r._id.toHexString(),
      authorName: r.authorName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verifiedPurchase: r.verifiedPurchase,
      adminReply: r.adminReply,
      createdAt: r.createdAt.toISOString(),
    })),
    distribution,
  };
}
