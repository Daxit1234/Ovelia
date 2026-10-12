import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { Cart, connectDB, Product, type CartDoc, type ProductDoc, type VariantDoc } from "@/lib/db";
import { toObjectId, isObjectId } from "@/lib/db/model";
import { mergeCartLines, subtractPurchased, type CartLineRef } from "@/lib/domain/cart";
import {
  calculatePricing,
  type CheckoutPaymentMethod,
  type PricingLine,
  type PricingResult,
  type ShippingMethod,
  type ShippingRules,
  type TaxRules,
} from "@/lib/domain/pricing";
import { isFirstOrder, loadAutomaticPromotions, resolveCoupon, type CustomerIdentity } from "@/lib/services/promotions";
import { loadSettings } from "@/lib/services/settings";
import { AppError } from "@/lib/result";
import { EMPTY_CART, type CartLineView, type CartView } from "@/lib/types";
import type { StoreSettings } from "@/lib/validation/settings";

const GUEST_CART_DAYS = 30;
const USER_CART_DAYS = 180;

export interface CartIdentity {
  userId: string | null;
  guestToken: string | null;
}

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiryFor(identity: { userId: string | null }): Date {
  const days = identity.userId ? USER_CART_DAYS : GUEST_CART_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function shippingRules(settings: StoreSettings): ShippingRules {
  return {
    standardFee: settings.shipping.standardFee,
    expressEnabled: settings.shipping.expressEnabled,
    expressFee: settings.shipping.expressFee,
    freeShippingThreshold: settings.shipping.freeShippingThreshold,
    codEnabled: settings.payments.codEnabled,
    codFee: settings.payments.codFee,
    codMinOrderValue: settings.payments.codMinOrderValue,
    codMaxOrderValue: settings.payments.codMaxOrderValue,
  };
}

export function taxRules(settings: StoreSettings): TaxRules {
  return {
    pricesIncludeTax: settings.tax.pricesIncludeTax,
    shippingTaxRate: settings.tax.shippingGstRate,
    storeState: settings.tax.storeState || null,
  };
}

export async function findCart(identity: CartIdentity): Promise<CartDoc | null> {
  await connectDB();
  if (identity.userId) return Cart.findOne({ userId: toObjectId(identity.userId) }).lean();
  if (identity.guestToken) return Cart.findOne({ guestTokenHash: hashToken(identity.guestToken) }).lean();
  return null;
}

async function upsertCart(identity: CartIdentity): Promise<CartDoc> {
  await connectDB();
  const filter = identity.userId
    ? { userId: toObjectId(identity.userId) }
    : { guestTokenHash: hashToken(identity.guestToken!) };
  const cart = await Cart.findOneAndUpdate(
    filter,
    { $setOnInsert: { ...filter, items: [], couponCode: null }, $set: { expiresAt: expiryFor(identity) } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return cart!;
}

async function saveItems(cartId: Types.ObjectId, lines: CartLineRef[], couponCode?: string | null) {
  const set: Record<string, unknown> = {
    items: lines.map((line) => ({
      productId: toObjectId(line.productId),
      variantId: toObjectId(line.variantId),
      quantity: line.quantity,
      addedAt: new Date(),
    })),
  };
  if (couponCode !== undefined) set.couponCode = couponCode;
  await Cart.updateOne({ _id: cartId }, { $set: set });
}

function cartLines(cart: CartDoc): CartLineRef[] {
  return cart.items.map((item) => ({
    productId: item.productId.toHexString(),
    variantId: item.variantId.toHexString(),
    quantity: item.quantity,
  }));
}

async function loadSellableVariant(productId: string, variantId: string) {
  if (!isObjectId(productId) || !isObjectId(variantId)) throw new AppError("Invalid product selection");
  const product = await Product.findOne({ _id: toObjectId(productId), status: "published" }, { name: 1, variants: 1 }).lean();
  const variant = (product?.variants as VariantDoc[] | undefined)?.find((v) => v._id.toHexString() === variantId && v.isActive);
  if (!product || !variant) throw new AppError("This product is no longer available.", "UNAVAILABLE", 404);
  return { product, variant };
}

/** Adds (or increases) a cart line after validating availability and limits. */
export async function addToCart(identity: CartIdentity, input: CartLineRef): Promise<void> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) {
    throw new AppError("Please choose a valid quantity.");
  }
  const settings = await loadSettings();
  const max = settings.orders.maxQuantityPerItem;
  const { product, variant } = await loadSellableVariant(input.productId, input.variantId);
  const cart = await upsertCart(identity);
  const lines = cartLines(cart);
  const existing = lines.find((l) => l.variantId === input.variantId);
  const desired = (existing?.quantity ?? 0) + input.quantity;

  if (variant.stock <= 0) throw new AppError(`${product.name} (${variant.label}) is out of stock.`, "OUT_OF_STOCK");
  if (desired > max) throw new AppError(`You can buy up to ${max} units of each item per order.`, "LIMIT");
  if (desired > variant.stock) {
    throw new AppError(`Only ${variant.stock} unit${variant.stock === 1 ? "" : "s"} of ${product.name} (${variant.label}) available.`, "LIMIT");
  }
  if (lines.length >= 50 && !existing) throw new AppError("Your cart is full.");

  if (existing) existing.quantity = desired;
  else lines.push({ productId: input.productId, variantId: input.variantId, quantity: input.quantity });
  await saveItems(cart._id, lines);
}

export async function updateCartQuantity(identity: CartIdentity, variantId: string, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new AppError("Please choose a valid quantity.");
  const cart = await findCart(identity);
  if (!cart) return;
  const lines = cartLines(cart);
  const line = lines.find((l) => l.variantId === variantId);
  if (!line) return;
  if (quantity === 0) {
    await saveItems(cart._id, lines.filter((l) => l.variantId !== variantId));
    return;
  }
  const settings = await loadSettings();
  if (quantity > settings.orders.maxQuantityPerItem) {
    throw new AppError(`You can buy up to ${settings.orders.maxQuantityPerItem} units of each item per order.`, "LIMIT");
  }
  if (quantity > line.quantity) {
    const { product, variant } = await loadSellableVariant(line.productId, variantId);
    if (quantity > variant.stock) {
      throw new AppError(`Only ${variant.stock} unit${variant.stock === 1 ? "" : "s"} of ${product.name} (${variant.label}) available.`, "LIMIT");
    }
  }
  line.quantity = quantity;
  await saveItems(cart._id, lines);
}

export async function removeFromCart(identity: CartIdentity, variantId: string): Promise<void> {
  await updateCartQuantity(identity, variantId, 0);
}

export async function setCartCoupon(identity: CartIdentity, code: string | null): Promise<void> {
  const cart = code ? await upsertCart(identity) : await findCart(identity);
  if (!cart) return;
  await Cart.updateOne({ _id: cart._id }, { $set: { couponCode: code ? code.trim().toUpperCase() : null } });
}

/** Moves a guest cart into the customer's cart after sign-in. Idempotent. */
export async function mergeGuestCart(guestToken: string, userId: string): Promise<void> {
  await connectDB();
  const guest = await Cart.findOne({ guestTokenHash: hashToken(guestToken) }).lean();
  if (!guest) return;
  const settings = await loadSettings();
  const userCart = await upsertCart({ userId, guestToken: null });
  const merged = mergeCartLines(cartLines(userCart), cartLines(guest), settings.orders.maxQuantityPerItem);
  await saveItems(userCart._id, merged, userCart.couponCode ?? guest.couponCode ?? null);
  await Cart.deleteOne({ _id: guest._id });
}

/** Removes purchased quantities from the cart that produced an order. */
export async function removePurchasedFromCart(cartId: Types.ObjectId | null, purchased: CartLineRef[]): Promise<void> {
  if (!cartId) return;
  const cart = await Cart.findById(cartId).lean();
  if (!cart) return;
  await saveItems(cart._id, subtractPurchased(cartLines(cart), purchased), null);
}

/* ------------------------------------------------------------------ */
/* Pricing a cart                                                      */
/* ------------------------------------------------------------------ */

export interface PriceCartOptions {
  identity: CustomerIdentity;
  shippingMethod?: ShippingMethod;
  paymentMethod?: CheckoutPaymentMethod | null;
  destinationState?: string | null;
  couponCode?: string | null;
  settings?: StoreSettings;
  now?: Date;
}

export interface PricedCart {
  view: CartView;
  pricing: PricingResult;
  products: Map<string, Pick<ProductDoc, "_id" | "name" | "slug" | "images" | "variants" | "hsnCode" | "gstRate" | "categoryPath" | "status">>;
  sellableLines: CartLineRef[];
}

/**
 * Prices cart lines against current catalog data, promotions and settings.
 * This is the single source of truth for totals shown in the cart, at
 * checkout and stored on orders.
 */
export async function priceLines(lines: CartLineRef[], options: PriceCartOptions): Promise<PricedCart> {
  await connectDB();
  const settings = options.settings ?? (await loadSettings());
  const now = options.now ?? new Date();
  const productIds = [...new Set(lines.map((l) => l.productId))].filter(isObjectId);
  const productDocs = productIds.length
    ? await Product.find(
        { _id: { $in: productIds.map(toObjectId) } },
        { name: 1, slug: 1, images: 1, variants: 1, hsnCode: 1, gstRate: 1, categoryPath: 1, status: 1 },
      ).lean()
    : [];
  const products = new Map(productDocs.map((p) => [p._id.toHexString(), p]));
  const max = settings.orders.maxQuantityPerItem;

  const lineViews: CartLineView[] = [];
  const pricingLines: PricingLine[] = [];
  const sellableLines: CartLineRef[] = [];
  const issues: string[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    const variant = (product?.variants as VariantDoc[] | undefined)?.find((v) => v._id.toHexString() === line.variantId);
    const available = !!product && product.status === "published" && !!variant && variant.isActive && variant.stock > 0;
    let issue: string | null = null;
    if (!available) issue = !product || !variant || !variant.isActive || product.status !== "published" ? "No longer available" : "Out of stock";
    else if (line.quantity > variant!.stock) issue = `Only ${variant!.stock} left in stock`;
    else if (line.quantity > max) issue = `Maximum ${max} per order`;
    if (issue) issues.push(`${product?.name ?? "An item"}${variant ? ` (${variant.label})` : ""}: ${issue}`);

    const image = product?.images?.[0] ? { url: product.images[0].url, alt: product.images[0].alt || product.name } : null;
    lineViews.push({
      variantId: line.variantId,
      productId: line.productId,
      slug: product?.slug ?? "",
      name: product?.name ?? "Unavailable product",
      variantLabel: variant?.label ?? "",
      sku: variant?.sku ?? "",
      image,
      quantity: line.quantity,
      unitPrice: variant?.price ?? 0,
      unitMrp: variant?.mrp ?? 0,
      lineSubtotal: 0,
      discount: 0,
      lineTotal: 0,
      stock: variant?.stock ?? 0,
      maxQuantity: Math.max(0, Math.min(max, variant?.stock ?? 0)),
      available,
      issue,
    });

    if (available) {
      pricingLines.push({
        key: line.variantId,
        productId: line.productId,
        variantId: line.variantId,
        categoryIds: (product!.categoryPath ?? []).map((c) => c.toHexString()),
        quantity: line.quantity,
        unitPrice: variant!.price,
        unitMrp: variant!.mrp,
        taxRate: product!.gstRate ?? settings.tax.defaultGstRate,
      });
      sellableLines.push(line);
    }
  }

  const couponCode = options.couponCode ?? null;
  const [automatic, coupon, firstOrder] = await Promise.all([
    loadAutomaticPromotions(now, options.identity),
    couponCode ? resolveCoupon(couponCode, options.identity, now) : Promise.resolve(null),
    isFirstOrder(options.identity),
  ]);

  const pricing = calculatePricing({
    lines: pricingLines,
    promotions: automatic,
    coupon,
    shippingMethod: options.shippingMethod ?? "standard",
    paymentMethod: options.paymentMethod ?? null,
    destinationState: options.destinationState ?? null,
    isFirstOrder: firstOrder,
    shipping: shippingRules(settings),
    tax: taxRules(settings),
    now,
  });

  for (const view of lineViews) {
    const priced = pricing.lines.find((l) => l.key === view.variantId);
    if (priced) {
      view.lineSubtotal = priced.lineSubtotal;
      view.discount = priced.discount;
      view.lineTotal = priced.lineTotal;
    }
  }

  const view: CartView = {
    lines: lineViews,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    couponCode,
    coupon: pricing.coupon,
    appliedPromotions: pricing.appliedPromotions,
    totals: {
      mrpTotal: pricing.mrpTotal,
      subtotal: pricing.subtotal,
      productSavings: pricing.productSavings,
      discountTotal: pricing.discountTotal,
      merchandiseTotal: pricing.merchandiseTotal,
      shippingFeeBeforeDiscount: pricing.shippingFeeBeforeDiscount,
      shippingFee: pricing.shippingFee,
      codFee: pricing.codFee,
      taxTotal: pricing.taxTotal,
      grandTotal: pricing.grandTotal,
      totalSavings: pricing.totalSavings,
    },
    shippingMethod: pricing.shippingMethod,
    expressAvailable: pricing.expressAvailable,
    codAvailable: pricing.codAvailable,
    codUnavailableReason: pricing.codUnavailableReason,
    freeShipping: pricing.freeShipping,
    issues,
    canCheckout: lines.length > 0 && issues.length === 0 && pricingLines.length > 0,
    maxQuantityPerItem: max,
  };

  return { view, pricing, products, sellableLines };
}

export async function getCartView(identity: CartIdentity, customer: CustomerIdentity, options: Omit<PriceCartOptions, "identity" | "couponCode"> = {}) {
  const cart = await findCart(identity);
  if (!cart || cart.items.length === 0) {
    const settings = options.settings ?? (await loadSettings());
    return {
      cart,
      priced: null,
      view: {
        ...EMPTY_CART,
        couponCode: cart?.couponCode ?? null,
        maxQuantityPerItem: settings.orders.maxQuantityPerItem,
      } satisfies CartView,
    };
  }
  const priced = await priceLines(cartLines(cart), { ...options, identity: customer, couponCode: cart.couponCode });
  return { cart, priced, view: priced.view };
}

export { cartLines };
