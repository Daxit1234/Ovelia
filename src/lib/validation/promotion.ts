import { z } from "zod";
import { PROMOTION_SCOPES, PROMOTION_TYPES } from "@/lib/domain/pricing";
import { parseIstDateTime } from "@/lib/format";

const objectId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid selection");
const rupees = z.number({ error: "Enter an amount" }).min(0, "Cannot be negative").max(1_000_000);
const dateTime = z.union([z.literal(""), z.string().refine((v) => parseIstDateTime(v) !== null, "Enter a valid date and time")]);

export const PROMOTION_TYPE_LABELS: Record<(typeof PROMOTION_TYPES)[number], string> = {
  percentage: "Percentage off",
  fixed: "Fixed amount off",
  free_shipping: "Free shipping",
  buy_x_get_y: "Buy X, get Y",
  bundle: "Combo price (bundle)",
};

/**
 * Promotion form. Amounts are in rupees here and stored in paise. Dates are
 * datetime-local strings in IST.
 */
export const promotionInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(120),
    description: z.string().trim().max(500),
    campaign: z.string().trim().max(60),
    trigger: z.enum(["code", "automatic"]),
    code: z.string().trim().toUpperCase().max(32),
    type: z.enum(PROMOTION_TYPES),
    /** Percent for percentage offers, rupees for fixed offers. */
    value: z.number({ error: "Enter a value" }).min(0).max(1_000_000),
    maxDiscount: rupees.nullable(),
    appliesTo: z.enum(PROMOTION_SCOPES),
    productIds: z.array(objectId).max(200),
    categoryIds: z.array(objectId).max(50),
    buyQuantity: z.number().int().min(1).max(20),
    getQuantity: z.number().int().min(1).max(20),
    getDiscountPercent: z.number().int().min(1).max(100),
    bundleItems: z.array(z.object({ productId: objectId, variantId: z.union([z.literal(""), objectId]), quantity: z.number().int().min(1).max(20) })).max(10),
    bundlePrice: rupees.nullable(),
    minSubtotal: rupees,
    minQuantity: z.number().int().min(0).max(100),
    firstOrderOnly: z.boolean(),
    usageLimit: z.number().int().min(1).max(10_000_000).nullable(),
    usageLimitPerCustomer: z.number().int().min(1).max(1000).nullable(),
    stackable: z.boolean(),
    priority: z.number().int().min(-100).max(100),
    startsAt: dateTime,
    endsAt: dateTime,
    isActive: z.boolean(),
    showOnStorefront: z.boolean(),
    bannerText: z.string().trim().max(120),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.trigger === "code" && !/^[A-Z0-9_-]{3,32}$/.test(v.code)) issue("code", "Codes are 3–32 letters, numbers, - or _");
    if (v.type === "percentage" && !(v.value >= 1 && v.value <= 100)) issue("value", "Enter a percentage between 1 and 100");
    if (v.type === "fixed" && !(v.value >= 1)) issue("value", "Enter the amount off in rupees");
    if (v.type === "bundle") {
      const units = v.bundleItems.reduce((s, i) => s + i.quantity, 0);
      if (units < 2) issue("bundleItems", "A combo needs at least two units, e.g. two different products");
      if (!v.bundlePrice || v.bundlePrice <= 0) issue("bundlePrice", "Enter the combo price");
    } else {
      if (v.appliesTo === "products" && v.productIds.length === 0) issue("productIds", "Choose at least one product");
      if (v.appliesTo === "categories" && v.categoryIds.length === 0) issue("categoryIds", "Choose at least one category");
    }
    if (v.showOnStorefront && !v.bannerText) issue("bannerText", "Add a short line to show on the storefront");
    const start = v.startsAt ? parseIstDateTime(v.startsAt) : null;
    const end = v.endsAt ? parseIstDateTime(v.endsAt) : null;
    if (start && end && end <= start) issue("endsAt", "The end must be after the start");
  });

export type PromotionInput = z.input<typeof promotionInputSchema>;
export type PromotionData = z.output<typeof promotionInputSchema>;

export const EMPTY_PROMOTION: PromotionInput = {
  name: "",
  description: "",
  campaign: "",
  trigger: "code",
  code: "",
  type: "percentage",
  value: 10,
  maxDiscount: null,
  appliesTo: "all",
  productIds: [],
  categoryIds: [],
  buyQuantity: 2,
  getQuantity: 1,
  getDiscountPercent: 100,
  bundleItems: [],
  bundlePrice: null,
  minSubtotal: 0,
  minQuantity: 0,
  firstOrderOnly: false,
  usageLimit: null,
  usageLimitPerCustomer: null,
  stackable: false,
  priority: 0,
  startsAt: "",
  endsAt: "",
  isActive: true,
  showOnStorefront: false,
  bannerText: "",
};
