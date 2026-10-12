import { z } from "zod";

export const SIZE_UNIT_OPTIONS = ["ml", "l", "g", "kg", "pcs"] as const;
export const GST_RATES = [0, 5, 12, 18, 28] as const;

const money = z.number({ error: "Enter an amount" }).min(0, "Cannot be negative").max(1_000_000);

export const variantInputSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().trim().min(1, "Enter a label, e.g. 500 ml").max(40),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/, "SKU: 3-64 letters, numbers, - or _"),
    sizeValue: z.number({ error: "Enter the size" }).positive("Size must be positive").max(100_000),
    sizeUnit: z.enum(SIZE_UNIT_OPTIONS),
    mrp: money,
    price: money,
    costPrice: money,
    stock: z.number({ error: "Enter stock" }).int().min(0).max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(100_000),
    weightGrams: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
  })
  .refine((v) => v.price <= v.mrp, { path: ["price"], message: "Selling price cannot exceed MRP" });

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the product name").max(140),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(100)
      .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Use lowercase letters, numbers and hyphens"),
    shortDescription: z.string().trim().max(300),
    description: z.string().trim().max(8000),
    categoryId: z.string().regex(/^[a-f0-9]{24}$/, "Choose a category"),
    images: z.array(z.object({ url: z.string().min(1), alt: z.string().max(200), publicId: z.string().nullable().optional() })).max(12),
    variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(20),
    highlights: z.array(z.string().trim().min(1).max(160)).max(8),
    specifications: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) })).max(20),
    usageInstructions: z.string().trim().max(4000),
    ingredients: z.string().trim().max(4000),
    safetyInformation: z.string().trim().max(4000),
    shippingInfo: z.string().trim().max(4000),
    returnInfo: z.string().trim().max(4000),
    fragrance: z.string().trim().max(40),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    status: z.enum(["draft", "published"]),
    isFeatured: z.boolean(),
    isBestSeller: z.boolean(),
    isNewArrival: z.boolean(),
    reviewsEnabled: z.boolean(),
    relatedProductIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(12),
    fbtProductIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(6),
    hsnCode: z.union([z.literal(""), z.string().trim().regex(/^\d{4,8}$/, "HSN codes are 4–8 digits")]),
    gstRate: z.number().refine((v) => (GST_RATES as readonly number[]).includes(v), "Choose a GST rate"),
    seoTitle: z.string().trim().max(70),
    seoDescription: z.string().trim().max(170),
  })
  .superRefine((value, ctx) => {
    const seen = new Map<string, number>();
    value.variants.forEach((variant, index) => {
      const sku = variant.sku.trim().toUpperCase();
      if (seen.has(sku)) ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: "Duplicate SKU in this product" });
      seen.set(sku, index);
    });
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(1000),
  parentId: z.union([z.literal(""), z.string().regex(/^[a-f0-9]{24}$/)]),
  imageUrl: z.string().max(500),
  imageAlt: z.string().max(200),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
  showOnHome: z.boolean(),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
});

export type CategoryInput = z.input<typeof categoryInputSchema>;

export const stockAdjustmentSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/),
  variantId: z.string().regex(/^[a-f0-9]{24}$/),
  mode: z.enum(["add", "remove", "set"]),
  quantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3, "Enter a reason").max(200),
});
