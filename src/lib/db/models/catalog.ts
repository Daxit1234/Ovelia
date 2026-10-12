import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";

export interface ImageDoc {
  url: string;
  alt: string;
  publicId?: string | null;
  width?: number | null;
  height?: number | null;
}

const imageSchema = new Schema<ImageDoc>(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    publicId: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false },
);

/* ------------------------------------------------------------------ */
/* Category                                                            */
/* ------------------------------------------------------------------ */

export interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  image?: ImageDoc | null;
  parent: Types.ObjectId | null;
  sortOrder: number;
  isActive: boolean;
  showOnHome: boolean;
  seo: { title?: string; description?: string };
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    description: { type: String, default: "", maxlength: 1000 },
    image: { type: imageSchema, default: null },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: true },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

categorySchema.index({ parent: 1, sortOrder: 1 });

export const Category = defineModel<CategoryDoc>("Category", categorySchema);

/* ------------------------------------------------------------------ */
/* Product + variants                                                  */
/* ------------------------------------------------------------------ */

export const SIZE_UNITS = ["ml", "l", "g", "kg", "pcs"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

/**
 * A purchasable variant (e.g. 500 ml, 1 L, 5 L). Each variant has its own
 * price, SKU and inventory. `stock` is the quantity available to sell;
 * `reserved` is held for online payments in progress.
 */
export interface VariantDoc {
  _id: Types.ObjectId;
  label: string;
  sku: string;
  sizeValue: number;
  sizeUnit: SizeUnit;
  mrp: number;
  price: number;
  costPrice: number;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  weightGrams: number;
  barcode?: string | null;
  isActive: boolean;
  sortOrder: number;
}

const variantSchema = new Schema<VariantDoc>({
  label: { type: String, required: true, trim: true, maxlength: 40 },
  sku: { type: String, required: true, uppercase: true, trim: true, maxlength: 64 },
  sizeValue: { type: Number, required: true, min: 0 },
  sizeUnit: { type: String, enum: SIZE_UNITS, required: true },
  mrp: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 10, min: 0 },
  weightGrams: { type: Number, default: 500, min: 0 },
  barcode: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
});

export const PRODUCT_STATUSES = ["draft", "published"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface ProductDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  category: Types.ObjectId;
  /** The category and all its ancestors, for parent-category filtering. */
  categoryPath: Types.ObjectId[];
  images: ImageDoc[];
  variants: Types.DocumentArray<VariantDoc> | VariantDoc[];
  highlights: string[];
  specifications: { label: string; value: string }[];
  usageInstructions: string;
  ingredients: string;
  safetyInformation: string;
  shippingInfo: string;
  returnInfo: string;
  fragrance: string;
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  reviewsEnabled: boolean;
  relatedProducts: Types.ObjectId[];
  frequentlyBoughtTogether: Types.ObjectId[];
  hsnCode: string;
  gstRate: number;
  ratingAverage: number;
  ratingCount: number;
  salesCount: number;
  priceMin: number;
  priceMax: number;
  mrpMax: number;
  seo: { title?: string; description?: string };
  publishedAt: Date | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    shortDescription: { type: String, default: "", maxlength: 300 },
    description: { type: String, default: "", maxlength: 8000 },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categoryPath: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    images: { type: [imageSchema], default: [] },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v: VariantDoc[]) => Array.isArray(v) && v.length > 0,
        message: "A product needs at least one variant",
      },
    },
    highlights: { type: [String], default: [] },
    specifications: {
      type: [{ label: { type: String, required: true }, value: { type: String, required: true }, _id: false }],
      default: [],
    },
    usageInstructions: { type: String, default: "" },
    ingredients: { type: String, default: "" },
    safetyInformation: { type: String, default: "" },
    shippingInfo: { type: String, default: "" },
    returnInfo: { type: String, default: "" },
    fragrance: { type: String, default: "", trim: true },
    tags: { type: [String], default: [] },
    status: { type: String, enum: PRODUCT_STATUSES, default: "draft" },
    isFeatured: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    reviewsEnabled: { type: Boolean, default: true },
    relatedProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    frequentlyBoughtTogether: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    hsnCode: { type: String, default: "3402" },
    gstRate: { type: Number, default: 18, min: 0, max: 28 },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    priceMin: { type: Number, default: 0 },
    priceMax: { type: Number, default: 0 },
    mrpMax: { type: Number, default: 0 },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

productSchema.index({ "variants.sku": 1 }, { unique: true });
productSchema.index({ status: 1, categoryPath: 1, priceMin: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, salesCount: -1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ status: 1, isBestSeller: 1 });

productSchema.pre("validate", function () {
  const variants = (this.variants ?? []) as VariantDoc[];
  const skus = variants.map((v) => v.sku?.toUpperCase());
  if (new Set(skus).size !== skus.length) {
    this.invalidate("variants", "Each variant must have a unique SKU");
  }
  variants.forEach((variant, index) => {
    if (variant.price > variant.mrp) {
      this.invalidate(`variants.${index}.price`, "Selling price cannot exceed MRP");
    }
  });
});

productSchema.pre("save", function () {
  const active = ((this.variants ?? []) as VariantDoc[]).filter((v) => v.isActive);
  const pool = active.length > 0 ? active : ((this.variants ?? []) as VariantDoc[]);
  this.priceMin = pool.length ? Math.min(...pool.map((v) => v.price)) : 0;
  this.priceMax = pool.length ? Math.max(...pool.map((v) => v.price)) : 0;
  this.mrpMax = pool.length ? Math.max(...pool.map((v) => v.mrp)) : 0;
  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
});

export const Product = defineModel<ProductDoc>("Product", productSchema);
