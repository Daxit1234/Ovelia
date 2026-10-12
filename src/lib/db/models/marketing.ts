import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";
import { PROMOTION_SCOPES, PROMOTION_TYPES, type PromotionScope, type PromotionType } from "@/lib/domain/pricing";

/* ------------------------------------------------------------------ */
/* Promotion / coupon                                                  */
/* ------------------------------------------------------------------ */

export interface PromotionDoc {
  _id: Types.ObjectId;
  name: string;
  description: string;
  campaign: string;
  /** Uppercase coupon code; null for automatic promotions without a code. */
  code: string | null;
  isAutomatic: boolean;
  type: PromotionType;
  value: number;
  maxDiscount: number | null;
  appliesTo: PromotionScope;
  productIds: Types.ObjectId[];
  categoryIds: Types.ObjectId[];
  buyQuantity: number;
  getQuantity: number;
  getDiscountPercent: number;
  bundleItems: { productId: Types.ObjectId; variantId: Types.ObjectId | null; quantity: number }[];
  bundlePrice: number | null;
  minSubtotal: number;
  minQuantity: number;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  stackable: boolean;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  showOnStorefront: boolean;
  bannerText: string;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const promotionSchema = new Schema<PromotionDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 500 },
    campaign: { type: String, default: "", trim: true },
    code: { type: String, default: null, uppercase: true, trim: true },
    isAutomatic: { type: Boolean, default: false },
    type: { type: String, enum: PROMOTION_TYPES, required: true },
    value: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: null, min: 0 },
    appliesTo: { type: String, enum: PROMOTION_SCOPES, default: "all" },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    buyQuantity: { type: Number, default: 1, min: 1 },
    getQuantity: { type: Number, default: 1, min: 1 },
    getDiscountPercent: { type: Number, default: 100, min: 1, max: 100 },
    bundleItems: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        variantId: { type: Schema.Types.ObjectId, default: null },
        quantity: { type: Number, default: 1, min: 1 },
        _id: false,
      },
    ],
    bundlePrice: { type: Number, default: null, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    minQuantity: { type: Number, default: 0, min: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    usageLimit: { type: Number, default: null, min: 1 },
    usageLimitPerCustomer: { type: Number, default: null, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    stackable: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    showOnStorefront: { type: Boolean, default: false },
    bannerText: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

promotionSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } });
promotionSchema.index({ isActive: 1, isAutomatic: 1 });
promotionSchema.index({ isActive: 1, showOnStorefront: 1 });

export const Promotion = defineModel<PromotionDoc>("Promotion", promotionSchema);

/**
 * One row per promotion used on an order. "reserved" while an online payment
 * is pending, "confirmed" once the order is confirmed, "released" when the
 * order is cancelled or the payment never completes.
 */
export interface PromotionRedemptionDoc {
  _id: Types.ObjectId;
  promotionId: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId | null;
  email: string;
  phone: string;
  code: string | null;
  amount: number;
  status: "reserved" | "confirmed" | "released";
  createdAt: Date;
  updatedAt: Date;
}

const redemptionSchema = new Schema<PromotionRedemptionDoc>(
  {
    promotionId: { type: Schema.Types.ObjectId, ref: "Promotion", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    code: { type: String, default: null },
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ["reserved", "confirmed", "released"], default: "reserved" },
  },
  { timestamps: true },
);

redemptionSchema.index({ promotionId: 1, orderId: 1 }, { unique: true });
redemptionSchema.index({ promotionId: 1, email: 1, status: 1 });
redemptionSchema.index({ promotionId: 1, userId: 1, status: 1 });
redemptionSchema.index({ promotionId: 1, phone: 1, status: 1 });

export const PromotionRedemption = defineModel<PromotionRedemptionDoc>("PromotionRedemption", redemptionSchema);

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export interface ReviewDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId | null;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  verifiedPurchase: boolean;
  isFeatured: boolean;
  adminReply: string;
  moderatedBy: Types.ObjectId | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDoc>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    authorName: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "", trim: true, maxlength: 120 },
    body: { type: String, default: "", trim: true, maxlength: 2000 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    verifiedPurchase: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    adminReply: { type: String, default: "", maxlength: 1000 },
    moderatedBy: { type: Schema.Types.ObjectId, default: null },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });

export const Review = defineModel<ReviewDoc>("Review", reviewSchema);

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

export interface NewsletterSubscriberDoc {
  _id: Types.ObjectId;
  email: string;
  status: "subscribed" | "unsubscribed";
  source: string;
  unsubscribeTokenHash: string;
  consentAt: Date;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriberSchema = new Schema<NewsletterSubscriberDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed" },
    source: { type: String, default: "footer" },
    unsubscribeTokenHash: { type: String, required: true },
    consentAt: { type: Date, default: () => new Date() },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

subscriberSchema.index({ status: 1, createdAt: -1 });

export const NewsletterSubscriber = defineModel<NewsletterSubscriberDoc>("NewsletterSubscriber", subscriberSchema);

/* ------------------------------------------------------------------ */
/* Storefront content                                                  */
/* ------------------------------------------------------------------ */

export interface BannerDoc {
  _id: Types.ObjectId;
  placement: "hero" | "promo";
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  imageAlt: string;
  theme: "green" | "teal" | "blue" | "light";
  sortOrder: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<BannerDoc>(
  {
    placement: { type: String, enum: ["hero", "promo"], default: "promo" },
    eyebrow: { type: String, default: "", maxlength: 60 },
    title: { type: String, required: true, maxlength: 120 },
    subtitle: { type: String, default: "", maxlength: 300 },
    ctaLabel: { type: String, default: "Shop now", maxlength: 40 },
    ctaHref: { type: String, default: "/shop" },
    imageUrl: { type: String, default: "" },
    imageAlt: { type: String, default: "" },
    theme: { type: String, enum: ["green", "teal", "blue", "light"], default: "green" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bannerSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });

export const Banner = defineModel<BannerDoc>("Banner", bannerSchema);

export interface FaqDoc {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  showOnHome: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<FaqDoc>(
  {
    question: { type: String, required: true, maxlength: 300 },
    answer: { type: String, required: true, maxlength: 3000 },
    category: { type: String, default: "General", maxlength: 60 },
    sortOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: false },
  },
  { timestamps: true },
);

faqSchema.index({ isPublished: 1, category: 1, sortOrder: 1 });

export const Faq = defineModel<FaqDoc>("Faq", faqSchema);

/**
 * Testimonials are entered by staff from genuine customer feedback only
 * (with the customer's consent). The store ships with none.
 */
export interface TestimonialDoc {
  _id: Types.ObjectId;
  name: string;
  location: string;
  quote: string;
  rating: number | null;
  isPublished: boolean;
  sortOrder: number;
  consentConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<TestimonialDoc>(
  {
    name: { type: String, required: true, maxlength: 60 },
    location: { type: String, default: "", maxlength: 60 },
    quote: { type: String, required: true, maxlength: 600 },
    rating: { type: Number, default: null, min: 1, max: 5 },
    isPublished: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    consentConfirmed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Testimonial = defineModel<TestimonialDoc>("Testimonial", testimonialSchema);
