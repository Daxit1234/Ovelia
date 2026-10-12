import { z } from "zod";
import { GSTIN_REGEX, INDIAN_STATE_NAMES, PINCODE_REGEX } from "@/lib/india";
import { linkSchema } from "@/lib/validation/link";

const paise = z.number().int().min(0).max(100_000_000);
const optionalUrl = z.union([z.literal(""), z.url()]);

export const storeSectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  legalName: z.string().trim().max(120),
  tagline: z.string().trim().max(160),
  supportEmail: z.union([z.literal(""), z.email()]),
  supportPhone: z.string().trim().max(20),
  whatsappNumber: z.string().trim().max(20),
  businessHours: z.string().trim().max(120),
  gstin: z.union([z.literal(""), z.string().trim().toUpperCase().regex(GSTIN_REGEX, "Enter a valid 15-character GSTIN")]),
  address: z.object({
    line1: z.string().trim().max(120),
    line2: z.string().trim().max(120),
    city: z.string().trim().max(60),
    state: z.union([z.literal(""), z.enum(INDIAN_STATE_NAMES)]),
    pincode: z.union([z.literal(""), z.string().regex(PINCODE_REGEX, "Enter a valid 6-digit PIN code")]),
  }),
  social: z.object({
    instagram: optionalUrl,
    facebook: optionalUrl,
    youtube: optionalUrl,
    x: optionalUrl,
    linkedin: optionalUrl,
  }),
});

export const announcementSectionSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().max(160),
  href: linkSchema,
});

export const shippingSectionSchema = z.object({
  provider: z.enum(["manual", "shiprocket"]),
  standardLabel: z.string().trim().min(1).max(60),
  standardEta: z.string().trim().max(60),
  standardFee: paise,
  expressEnabled: z.boolean(),
  expressLabel: z.string().trim().min(1).max(60),
  expressEta: z.string().trim().max(60),
  expressFee: paise,
  freeShippingThreshold: paise.nullable(),
  processingTime: z.string().trim().max(160),
  originPincode: z.union([z.literal(""), z.string().regex(PINCODE_REGEX, "Enter a valid 6-digit PIN code")]),
  blockedPincodes: z.array(z.string().regex(PINCODE_REGEX)).max(5000),
  defaultPackageWeightGrams: z.number().int().min(1).max(50_000),
});

export const paymentsSectionSchema = z
  .object({
    razorpayEnabled: z.boolean(),
    codEnabled: z.boolean(),
    codFee: paise,
    codMinOrderValue: paise.nullable(),
    codMaxOrderValue: paise.nullable(),
  })
  .refine((v) => v.codMinOrderValue === null || v.codMaxOrderValue === null || v.codMinOrderValue <= v.codMaxOrderValue, {
    message: "Minimum COD order value must not exceed the maximum",
    path: ["codMaxOrderValue"],
  });

export const taxSectionSchema = z.object({
  pricesIncludeTax: z.boolean(),
  defaultGstRate: z.number().min(0).max(28),
  shippingGstRate: z.number().min(0).max(28),
  storeState: z.union([z.literal(""), z.enum(INDIAN_STATE_NAMES)]),
});

export const ordersSectionSchema = z.object({
  guestCheckoutEnabled: z.boolean(),
  reservationMinutes: z.number().int().min(10).max(240),
  maxQuantityPerItem: z.number().int().min(1).max(99),
  customerCancelUntil: z.enum(["confirmed", "processing", "packed"]),
  autoRefundOnCustomerCancel: z.boolean(),
  returnsEnabled: z.boolean(),
  returnWindowDays: z.number().int().min(0).max(60),
  notificationEmails: z.array(z.email()).max(10),
});

export const reviewsSectionSchema = z.object({
  enabled: z.boolean(),
  requirePurchase: z.boolean(),
  autoApprove: z.boolean(),
});

export const homepageSectionSchema = z.object({
  heroEyebrow: z.string().trim().max(60),
  heroTitle: z.string().trim().min(1).max(120),
  heroSubtitle: z.string().trim().max(300),
  heroCtaLabel: z.string().trim().min(1).max(40),
  heroCtaHref: linkSchema.refine((v) => v.length > 0, "Enter a link"),
  showBestSellers: z.boolean(),
  showNewArrivals: z.boolean(),
  showBundles: z.boolean(),
  showTestimonials: z.boolean(),
  showFaq: z.boolean(),
  showNewsletter: z.boolean(),
  whyChoose: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(60),
        description: z.string().trim().max(240),
        icon: z.enum(["sparkles", "leaf", "shield", "truck", "badge", "heart", "droplet", "home"]),
      }),
    )
    .max(8),
});

export const policiesSectionSchema = z.object({
  shipping: z.string().max(20_000),
  returns: z.string().max(20_000),
  privacy: z.string().max(30_000),
  terms: z.string().max(30_000),
  about: z.string().max(20_000),
});

export const seoSectionSchema = z.object({
  defaultTitle: z.string().trim().min(1).max(70),
  defaultDescription: z.string().trim().max(170),
});

export const settingsSchema = z.object({
  store: storeSectionSchema,
  announcement: announcementSectionSchema,
  shipping: shippingSectionSchema,
  payments: paymentsSectionSchema,
  tax: taxSectionSchema,
  orders: ordersSectionSchema,
  reviews: reviewsSectionSchema,
  homepage: homepageSectionSchema,
  policies: policiesSectionSchema,
  seo: seoSectionSchema,
});

export type StoreSettings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof StoreSettings;

export const SETTINGS_SECTION_SCHEMAS = {
  store: storeSectionSchema,
  announcement: announcementSectionSchema,
  shipping: shippingSectionSchema,
  payments: paymentsSectionSchema,
  tax: taxSectionSchema,
  orders: ordersSectionSchema,
  reviews: reviewsSectionSchema,
  homepage: homepageSectionSchema,
  policies: policiesSectionSchema,
  seo: seoSectionSchema,
} satisfies Record<SettingsSection, z.ZodType>;
