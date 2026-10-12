import type { CouponStatus, PromotionType, ShippingMethod } from "@/lib/domain/pricing";

/** Serializable shapes passed from the server to client components. */

export interface ImageView {
  url: string;
  alt: string;
}

export interface VariantView {
  id: string;
  label: string;
  sku: string;
  sizeValue: number;
  sizeUnit: string;
  mrp: number;
  price: number;
  stock: number;
  lowStockThreshold: number;
  inStock: boolean;
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  categoryName: string;
  categorySlug: string;
  image: ImageView | null;
  hoverImage: ImageView | null;
  priceMin: number;
  mrpMax: number;
  ratingAverage: number;
  ratingCount: number;
  isBestSeller: boolean;
  isNewArrival: boolean;
  fragrance: string;
  variants: VariantView[];
  /** Variant pre-selected on cards (first in-stock, smallest). */
  defaultVariantId: string;
  inStock: boolean;
}

export interface ProductDetailData extends ProductCardData {
  description: string;
  images: ImageView[];
  highlights: string[];
  specifications: { label: string; value: string }[];
  usageInstructions: string;
  ingredients: string;
  safetyInformation: string;
  shippingInfo: string;
  returnInfo: string;
  tags: string[];
  reviewsEnabled: boolean;
  hsnCode: string;
  categoryId: string;
  categoryPath: { id: string; name: string; slug: string }[];
  relatedIds: string[];
  frequentlyBoughtTogetherIds: string[];
  seo: { title: string; description: string };
  updatedAt: string;
}

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: ImageView | null;
  parentId: string | null;
  productCount: number;
}

export interface CartLineView {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  sku: string;
  image: ImageView | null;
  quantity: number;
  unitPrice: number;
  unitMrp: number;
  lineSubtotal: number;
  discount: number;
  lineTotal: number;
  stock: number;
  maxQuantity: number;
  available: boolean;
  issue: string | null;
}

export interface CartTotals {
  mrpTotal: number;
  subtotal: number;
  productSavings: number;
  discountTotal: number;
  merchandiseTotal: number;
  shippingFeeBeforeDiscount: number;
  shippingFee: number;
  codFee: number;
  taxTotal: number;
  grandTotal: number;
  totalSavings: number;
}

export interface CartView {
  lines: CartLineView[];
  itemCount: number;
  couponCode: string | null;
  coupon: { code: string; status: CouponStatus; message: string } | null;
  appliedPromotions: { id: string; name: string; code: string | null; type: PromotionType; amount: number; freeShipping: boolean }[];
  totals: CartTotals;
  shippingMethod: ShippingMethod;
  expressAvailable: boolean;
  codAvailable: boolean;
  codUnavailableReason: string | null;
  freeShipping: { threshold: number | null; remaining: number; qualified: boolean };
  issues: string[];
  canCheckout: boolean;
  maxQuantityPerItem: number;
}

export const EMPTY_CART: CartView = {
  lines: [],
  itemCount: 0,
  couponCode: null,
  coupon: null,
  appliedPromotions: [],
  totals: {
    mrpTotal: 0,
    subtotal: 0,
    productSavings: 0,
    discountTotal: 0,
    merchandiseTotal: 0,
    shippingFeeBeforeDiscount: 0,
    shippingFee: 0,
    codFee: 0,
    taxTotal: 0,
    grandTotal: 0,
    totalSavings: 0,
  },
  shippingMethod: "standard",
  expressAvailable: false,
  codAvailable: false,
  codUnavailableReason: null,
  freeShipping: { threshold: null, remaining: 0, qualified: false },
  issues: [],
  canCheckout: false,
  maxQuantityPerItem: 10,
};
