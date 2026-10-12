import "server-only";
import { randomInt } from "node:crypto";
import type { Types } from "mongoose";
import {
  connectDB,
  Counter,
  Order,
  Payment,
  Product,
  Shipment,
  withTransaction,
  type OrderDoc,
  type OrderItemDoc,
  type StatusEvent,
  type VariantDoc,
} from "@/lib/db";
import { ObjectId } from "@/lib/db/model";
import { invalidateProducts } from "@/lib/cache-tags";
import {
  canAdminTransition,
  canCarrierTransition,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/domain/order-status";
import { integrations, siteUrl } from "@/lib/env";
import { financialYear } from "@/lib/india";
import { formatINR } from "@/lib/money";
import { AppError, NotFoundError } from "@/lib/result";
import { runAfter } from "@/lib/services/background";
import { cartLines, findCart, priceLines, removePurchasedFromCart, type CartIdentity } from "@/lib/services/cart";
import {
  commitReservation,
  deductStock,
  InsufficientStockError,
  releaseReservation,
  reserveStock,
  restockLines,
  type InventoryActor,
  type StockLine,
} from "@/lib/services/inventory";
import {
  notifyAdmins,
  notifyCancellationDecision,
  notifyCancelled,
  notifyDelivered,
  notifyOrderConfirmed,
  notifyPaymentFailed,
  notifyShipped,
  notifyStatusUpdate,
} from "@/lib/services/notifications/order-notifications";
import { templates } from "@/lib/services/notifications/templates";
import { customerOrderPath } from "@/lib/services/order-access";
import {
  capturePayment,
  createRazorpayOrder,
  describeRazorpayError,
  fetchOrderPayments,
  fetchPayment,
  razorpayKeyId,
  type RazorpayPaymentInfo,
} from "@/lib/services/payments/razorpay";
import { confirmRedemptions, recordRedemptions, releaseRedemptions } from "@/lib/services/promotions";
import { approveRefund, createRefund } from "@/lib/services/refunds";
import { loadSettings } from "@/lib/services/settings";
import { bookingProvider, checkServiceability, getShippingProvider } from "@/lib/services/shipping";
import { isExceptionStatus, mapCarrierStatus } from "@/lib/services/shipping/status-map";
import type { TrackingEvent } from "@/lib/services/shipping/types";
import type { AddressData, CheckoutData } from "@/lib/validation/checkout";

export interface OrderActor {
  id: string | null;
  name: string;
  type: "admin" | "customer" | "system" | "carrier";
  email?: string | null;
}

export const SYSTEM: OrderActor = { id: null, name: "System", type: "system" };
const PAID_STATES: PaymentStatus[] = ["paid", "partially_refunded", "refunded"];

export function isPaid(status: PaymentStatus): boolean {
  return PAID_STATES.includes(status);
}

function inventoryActor(actor: OrderActor): InventoryActor {
  return { id: actor.id, name: actor.name, email: actor.email ?? null, type: actor.type === "admin" ? "admin" : actor.type === "customer" ? "customer" : "system" };
}

function statusEvent(status: OrderStatus, note: string, actor: OrderActor): StatusEvent {
  return { status, note, at: new Date(), by: { id: actor.id, name: actor.name, type: actor.type } };
}

function stockLinesOf(order: Pick<OrderDoc, "items">): StockLine[] {
  return (order.items as OrderItemDoc[]).map((item) => ({
    productId: item.productId.toHexString(),
    variantId: item.variantId.toHexString(),
    quantity: item.quantity,
  }));
}

function productIdsOf(order: Pick<OrderDoc, "items">): string[] {
  return [...new Set((order.items as OrderItemDoc[]).map((i) => i.productId.toHexString()))];
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

const ORDER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function orderNumberCandidate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const ymd = ["year", "month", "day"].map((t) => parts.find((p) => p.type === t)?.value ?? "00").join("");
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return `OV-${ymd}-${suffix}`;
}

async function generateOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = orderNumberCandidate();
    if (!(await Order.exists({ orderNumber: candidate }))) return candidate;
  }
  throw new AppError("Could not allocate an order number. Please try again.");
}

/** Sequential GST invoice numbers per Indian financial year, e.g. OVL/2026-27/00042. */
export async function ensureInvoiceNumber(orderId: Types.ObjectId | string): Promise<string> {
  await connectDB();
  const order = await Order.findById(orderId, { invoiceNumber: 1, status: 1 }).lean();
  if (!order) throw new NotFoundError("Order not found");
  if (order.invoiceNumber) return order.invoiceNumber;
  if (order.status === "pending_payment" || order.status === "cancelled") {
    throw new AppError("Invoices are issued only for confirmed orders.");
  }
  const now = new Date();
  const fy = financialYear(now);
  const counter = await Counter.findOneAndUpdate({ _id: `invoice:${fy}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }).lean();
  const number = `OVL/${fy}/${String(counter!.seq).padStart(5, "0")}`;
  const res = await Order.updateOne({ _id: order._id, invoiceNumber: null }, { $set: { invoiceNumber: number, invoiceDate: now } });
  if (res.modifiedCount === 0) {
    const again = await Order.findById(order._id, { invoiceNumber: 1 }).lean();
    return again!.invoiceNumber!;
  }
  return number;
}

/* ------------------------------------------------------------------ */
/* Locking                                                             */
/* ------------------------------------------------------------------ */

const LOCK_TTL_MS = 2 * 60 * 1000;

async function acquireLock(orderId: Types.ObjectId): Promise<boolean> {
  const res = await Order.updateOne(
    { _id: orderId, $or: [{ processingLock: null }, { processingLock: { $lt: new Date(Date.now() - LOCK_TTL_MS) } }] },
    { $set: { processingLock: new Date() } },
  );
  return res.modifiedCount === 1;
}

async function releaseLock(orderId: Types.ObjectId): Promise<void> {
  await Order.updateOne({ _id: orderId }, { $set: { processingLock: null } });
}

async function adjustSalesCount(order: Pick<OrderDoc, "items">, direction: 1 | -1): Promise<void> {
  const totals = new Map<string, number>();
  for (const item of order.items as OrderItemDoc[]) {
    const key = item.productId.toHexString();
    totals.set(key, (totals.get(key) ?? 0) + item.quantity);
  }
  if (totals.size === 0) return;
  await Product.bulkWrite(
    [...totals].map(([id, qty]) => ({
      updateOne: { filter: { _id: new ObjectId(id) }, update: { $inc: { salesCount: direction * qty } } },
    })),
  );
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export interface RazorpayCheckoutData {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: "INR";
  description: string;
  prefill: { name: string; email: string; contact: string };
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "razorpay" | "cod";
  confirmationPath: string;
  razorpay: RazorpayCheckoutData | null;
}

export class TotalChangedError extends AppError {
  readonly newTotal: number;
  constructor(newTotal: number) {
    super(`Your order total has changed to ${formatINR(newTotal)}. Please review your order and place it again.`, "TOTAL_CHANGED", 409);
    this.newTotal = newTotal;
  }
}

function addressSnapshot(address: AddressData) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    landmark: address.landmark ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: "India",
  };
}

function confirmationPath(order: Pick<OrderDoc, "_id" | "orderNumber" | "userId">): string {
  return customerOrderPath({ id: order._id.toHexString(), orderNumber: order.orderNumber, userId: order.userId?.toHexString() ?? null });
}

function checkoutData(order: Pick<OrderDoc, "razorpayOrderId" | "pricing" | "orderNumber" | "customer">): RazorpayCheckoutData | null {
  if (!order.razorpayOrderId) return null;
  return {
    keyId: razorpayKeyId(),
    razorpayOrderId: order.razorpayOrderId,
    amount: order.pricing.grandTotal,
    currency: "INR",
    description: `Order ${order.orderNumber}`,
    prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.phone },
  };
}

function resultFor(order: OrderDoc): PlaceOrderResult {
  return {
    orderId: order._id.toHexString(),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    confirmationPath: confirmationPath(order),
    razorpay: order.status === "pending_payment" ? checkoutData(order) : null,
  };
}

/**
 * Places an order from the customer's cart. All prices, discounts, shipping
 * and taxes are recomputed on the server; `expectedTotal` is only compared to
 * make sure the customer is charged what they saw.
 */
export async function placeOrder(
  input: CheckoutData,
  ctx: { userId: string | null; cartIdentity: CartIdentity; actor: OrderActor },
): Promise<PlaceOrderResult> {
  await connectDB();
  const existing = await Order.findOne({ checkoutKey: input.checkoutKey }).lean();
  if (existing) return resultFor(existing);

  const settings = await loadSettings();
  if (!ctx.userId && !settings.orders.guestCheckoutEnabled) throw new AppError("Please sign in to place your order.", "LOGIN_REQUIRED", 401);
  if (input.paymentMethod === "razorpay" && (!settings.payments.razorpayEnabled || !integrations.razorpay())) {
    throw new AppError("Online payment is currently unavailable. Please choose Cash on Delivery.", "PAYMENT_UNAVAILABLE");
  }
  if (input.paymentMethod === "cod" && !settings.payments.codEnabled) {
    throw new AppError("Cash on Delivery is currently unavailable.", "PAYMENT_UNAVAILABLE");
  }

  const cart = await findCart(ctx.cartIdentity);
  if (!cart || cart.items.length === 0) throw new AppError("Your cart is empty.", "EMPTY_CART");

  const identity = { userId: ctx.userId, email: input.contact.email, phone: input.contact.phone };
  const priced = await priceLines(cartLines(cart), {
    identity,
    shippingMethod: input.shippingMethod,
    paymentMethod: input.paymentMethod,
    destinationState: input.shippingAddress.state,
    couponCode: cart.couponCode,
    settings,
  });
  const pricing = priced.pricing;
  if (!priced.view.canCheckout) throw new AppError(priced.view.issues[0] ?? "Please review your cart before checking out.", "CART_INVALID");
  if (input.paymentMethod === "cod" && !pricing.codAvailable) {
    throw new AppError(pricing.codUnavailableReason ?? "Cash on Delivery is not available for this order.", "COD_UNAVAILABLE");
  }

  const weightGrams = pricing.lines.reduce((sum, line) => {
    const variant = (priced.products.get(line.productId)?.variants as VariantDoc[] | undefined)?.find((v) => v._id.toHexString() === line.variantId);
    return sum + (variant?.weightGrams ?? 0) * line.quantity;
  }, 0);
  const serviceability = await checkServiceability(input.shippingAddress.pincode, {
    cod: input.paymentMethod === "cod",
    weightGrams: weightGrams || undefined,
    declaredValue: pricing.grandTotal,
    settings,
  });
  if (!serviceability.serviceable) throw new AppError(serviceability.message ?? "We cannot deliver to this PIN code yet.", "NOT_SERVICEABLE");
  if (input.paymentMethod === "cod" && !serviceability.codAvailable) {
    throw new AppError("Cash on Delivery is not available for this PIN code. Please pay online.", "COD_UNAVAILABLE");
  }

  if (pricing.grandTotal !== input.expectedTotal) throw new TotalChangedError(pricing.grandTotal);

  // A new checkout from the same cart replaces any unpaid earlier attempt.
  const stale = await Order.find({ cartId: cart._id, status: "pending_payment", paymentStatus: { $in: ["pending", "failed"] } }, { _id: 1 }).lean();
  for (const old of stale) await reconcileOrCancelUnpaid(old._id, "Replaced by a newer checkout attempt");

  const isCod = input.paymentMethod === "cod";
  const orderId = new ObjectId();
  const reservationId = new ObjectId();
  const orderNumber = await generateOrderNumber();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.orders.reservationMinutes * 60 * 1000);
  const shippingMethod = pricing.shippingMethod;

  const items = pricing.lines.map((line) => {
    const product = priced.products.get(line.productId)!;
    const variant = (product.variants as VariantDoc[]).find((v) => v._id.toHexString() === line.variantId)!;
    return {
      _id: new ObjectId(),
      productId: product._id,
      variantId: variant._id,
      productName: product.name,
      productSlug: product.slug,
      variantLabel: variant.label,
      sku: variant.sku,
      image: product.images?.[0]?.url ?? null,
      hsnCode: product.hsnCode ?? "",
      quantity: line.quantity,
      unitMrp: Math.max(variant.mrp, line.unitPrice),
      unitPrice: line.unitPrice,
      lineSubtotal: line.lineSubtotal,
      discount: line.discount,
      lineTotal: line.lineTotal,
      taxRate: line.taxRate,
      taxableValue: line.taxableValue,
      taxAmount: line.taxAmount,
      returnedQuantity: 0,
    };
  });

  const shippingAddress = addressSnapshot(input.shippingAddress);
  const billingAddress = input.billingSameAsShipping || !input.billingAddress ? shippingAddress : addressSnapshot(input.billingAddress);
  const initialStatus: OrderStatus = isCod ? "confirmed" : "pending_payment";
  const userObjectId = ctx.userId ? new ObjectId(ctx.userId) : null;

  const orderDoc = {
    _id: orderId,
    orderNumber,
    userId: userObjectId,
    isGuest: !ctx.userId,
    customer: { name: input.contact.name, email: input.contact.email, phone: input.contact.phone },
    shippingAddress,
    billingAddress,
    items,
    pricing: {
      currency: "INR" as const,
      pricesIncludeTax: settings.tax.pricesIncludeTax,
      mrpTotal: pricing.mrpTotal,
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      shippingFeeBeforeDiscount: pricing.shippingFeeBeforeDiscount,
      shippingFee: pricing.shippingFee,
      codFee: pricing.codFee,
      taxTotal: pricing.taxTotal,
      cgst: pricing.tax.cgst,
      sgst: pricing.tax.sgst,
      igst: pricing.tax.igst,
      interState: pricing.tax.interState,
      grandTotal: pricing.grandTotal,
      amountPaid: 0,
      amountRefunded: 0,
    },
    shippingMethod: {
      code: shippingMethod,
      label: shippingMethod === "express" ? settings.shipping.expressLabel : settings.shipping.standardLabel,
      eta: shippingMethod === "express" ? settings.shipping.expressEta : settings.shipping.standardEta,
    },
    appliedPromotions: pricing.appliedPromotions.map((p) => ({
      promotionId: new ObjectId(p.id),
      name: p.name,
      code: p.code,
      type: p.type,
      amount: p.amount,
      freeShipping: p.freeShipping,
    })),
    couponCode: pricing.coupon?.status === "applied" ? pricing.coupon.code : null,
    paymentMethod: input.paymentMethod,
    paymentStatus: "pending" as PaymentStatus,
    status: initialStatus,
    statusHistory: [
      statusEvent(initialStatus, isCod ? "Order placed with Cash on Delivery" : "Order created, awaiting online payment", ctx.actor),
    ],
    customerNote: input.customerNote ?? "",
    reservationId: isCod ? null : reservationId,
    reservationExpiresAt: isCod ? null : expiresAt,
    stockCommitted: isCod,
    salesCounted: isCod,
    cartId: cart._id,
    checkoutKey: input.checkoutKey,
    placedAt: now,
    confirmedAt: isCod ? now : null,
  };

  const actor = inventoryActor(ctx.actor);
  try {
    await withTransaction(async (session) => {
      try {
        await Order.create([orderDoc], { session: session ?? undefined });
        await Payment.create(
          [
            {
              orderId,
              orderNumber,
              provider: isCod ? "cod" : "razorpay",
              amount: pricing.grandTotal,
              status: "created",
              events: [{ type: "created", source: "checkout", at: now }],
            },
          ],
          { session: session ?? undefined },
        );
        await recordRedemptions(
          { _id: orderId, orderNumber, userId: userObjectId, customer: orderDoc.customer },
          pricing.appliedPromotions,
          isCod ? "confirmed" : "reserved",
          session,
        );
        const lines = items.map((i) => ({ productId: i.productId.toHexString(), variantId: i.variantId.toHexString(), quantity: i.quantity }));
        if (isCod) {
          await deductStock(lines, { orderId, orderNumber, reason: "Cash on Delivery order placed", actor }, session);
        } else {
          await reserveStock(lines, { orderId, orderNumber, expiresAt, actor, reservationId }, session);
        }
      } catch (error) {
        if (!session) {
          // No transaction: undo everything written so far for this order.
          await releaseRedemptions(orderId, null).catch(() => undefined);
          await Payment.deleteMany({ orderId }).catch(() => undefined);
          await Order.deleteOne({ _id: orderId }).catch(() => undefined);
        }
        throw error;
      }
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await Order.findOne({ checkoutKey: input.checkoutKey }).lean();
      if (duplicate) return resultFor(duplicate);
    }
    throw error;
  }

  invalidateProducts(productIdsOf(orderDoc));

  if (isCod) {
    const order = (await Order.findById(orderId).lean())!;
    await removePurchasedFromCart(cart._id, stockLinesOf(order));
    await adjustSalesCount(order, 1);
    runAfter(() => notifyOrderConfirmed(order));
    return resultFor(order);
  }

  try {
    const rz = await createRazorpayOrder({
      amount: pricing.grandTotal,
      receipt: orderNumber,
      notes: { orderId: orderId.toHexString(), orderNumber },
    });
    await Order.updateOne({ _id: orderId }, { $set: { razorpayOrderId: rz.id } });
    await Payment.updateOne({ orderId }, { $set: { razorpayOrderId: rz.id } });
  } catch (error) {
    console.error("Razorpay order creation failed", describeRazorpayError(error));
    await cancelUnpaidOrder(orderId, "Online payment could not be started", SYSTEM);
    throw new AppError("We could not start the online payment. Please try again or choose Cash on Delivery.", "PAYMENT_INIT_FAILED", 502);
  }
  const order = (await Order.findById(orderId).lean())!;
  return resultFor(order);
}

/** Re-opens Razorpay Checkout for an unpaid order (e.g. after a failed attempt). */
export async function getRetryCheckout(orderId: Types.ObjectId): Promise<RazorpayCheckoutData> {
  await connectDB();
  const order = await Order.findById(orderId).lean();
  if (!order) throw new NotFoundError("Order not found");
  if (order.status !== "pending_payment" || isPaid(order.paymentStatus)) throw new AppError("This order does not need payment.");
  if (order.reservationExpiresAt && order.reservationExpiresAt < new Date()) {
    throw new AppError("The payment window for this order has expired. Please place a new order.");
  }
  if (!order.razorpayOrderId) throw new AppError("Online payment is not available for this order.");
  return checkoutData(order)!;
}

/* ------------------------------------------------------------------ */
/* Payment confirmation                                                */
/* ------------------------------------------------------------------ */

export type ConfirmOutcome = "confirmed" | "on_hold" | "already_paid" | "not_found" | "not_captured" | "amount_mismatch";

async function recordPaymentEvent(
  order: Pick<OrderDoc, "_id" | "orderNumber" | "razorpayOrderId">,
  payment: RazorpayPaymentInfo,
  source: "checkout" | "webhook" | "reconcile",
  status: "authorized" | "captured" | "failed",
) {
  const update = {
    $set: {
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: payment.id,
      status,
      method: payment.method,
      errorCode: payment.errorCode,
      errorDescription: payment.errorDescription,
      amount: payment.amount,
    },
    $push: { events: { type: `payment.${status}`, source, at: new Date(), detail: payment.id } },
  };
  const existingForPayment = await Payment.findOne({ razorpayPaymentId: payment.id }, { _id: 1 }).lean();
  if (existingForPayment) {
    await Payment.updateOne({ _id: existingForPayment._id }, update);
    return;
  }
  const pending = await Payment.findOne({ orderId: order._id, provider: "razorpay", razorpayPaymentId: null }, { _id: 1 }).lean();
  if (pending) {
    await Payment.updateOne({ _id: pending._id }, update);
  } else {
    await Payment.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      provider: "razorpay",
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: payment.id,
      amount: payment.amount,
      status,
      method: payment.method,
      errorCode: payment.errorCode,
      errorDescription: payment.errorDescription,
      events: [{ type: `payment.${status}`, source, at: new Date(), detail: payment.id }],
    });
  }
}

/**
 * Confirms an online payment. Safe to call repeatedly and concurrently from
 * the checkout callback, webhooks and reconciliation: the payment is verified
 * with Razorpay's API and the order is only updated once.
 */
export async function confirmOnlinePayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  source: "checkout" | "webhook" | "reconcile";
}): Promise<{ outcome: ConfirmOutcome; order: OrderDoc | null }> {
  await connectDB();
  const order = await Order.findOne({ razorpayOrderId: input.razorpayOrderId }).lean();
  if (!order) return { outcome: "not_found", order: null };
  if (isPaid(order.paymentStatus)) return { outcome: "already_paid", order };

  let payment = await fetchPayment(input.razorpayPaymentId);
  if (payment.orderId !== input.razorpayOrderId) throw new AppError("Payment does not belong to this order.", "PAYMENT_MISMATCH");

  if (payment.status === "authorized") {
    try {
      payment = await capturePayment(payment.id, payment.amount);
    } catch (error) {
      // Auto-capture may have raced us; re-read the authoritative state.
      payment = await fetchPayment(payment.id);
      if (payment.status !== "captured") throw new AppError(`Payment capture failed: ${describeRazorpayError(error)}`);
    }
  }

  if (payment.status === "failed") {
    await markPaymentFailed({ razorpayOrderId: input.razorpayOrderId, payment, source: input.source });
    return { outcome: "not_captured", order };
  }
  if (payment.status !== "captured") return { outcome: "not_captured", order };

  if (payment.amount !== order.pricing.grandTotal || payment.currency !== "INR") {
    await recordPaymentEvent(order, payment, input.source, "captured");
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          needsAttention: true,
          attentionReason: `Captured ${formatINR(payment.amount)} does not match order total ${formatINR(order.pricing.grandTotal)}. Review and refund if needed.`,
        },
      },
    );
    runAfter(() =>
      notifyAdmins(
        templates.adminAlert(`Payment amount mismatch on ${order.orderNumber}`, "Captured amount differs from the order total.", siteUrl(`/admin/orders/${order._id.toHexString()}`)),
        "admin_payment_mismatch",
        `admin-payment-mismatch:${payment.id}`,
      ),
    );
    return { outcome: "amount_mismatch", order };
  }

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $nin: PAID_STATES } },
    {
      $set: { paymentStatus: "paid", paidAt: new Date(), "pricing.amountPaid": payment.amount },
      $push: { internalNotes: { note: `Payment ${payment.id} captured (${payment.method ?? "online"}) via ${input.source}`, at: new Date(), by: { id: null, name: "Razorpay", type: "system" } } },
    },
    { returnDocument: "after" },
  ).lean();
  await recordPaymentEvent(order, payment, input.source, "captured");
  if (!claimed) {
    return { outcome: "already_paid", order: await Order.findById(order._id).lean() };
  }

  const finalized = await finalizePaidOrder(claimed._id);
  return { outcome: finalized === "on_hold" ? "on_hold" : "confirmed", order: await Order.findById(order._id).lean() };
}

/**
 * Moves a paid order out of pending_payment: commits reserved stock (or
 * re-deducts it if the reservation expired) and confirms the order. Orders
 * that cannot be fulfilled are put on hold for staff to refund or restock.
 */
export async function finalizePaidOrder(orderId: Types.ObjectId): Promise<"confirmed" | "on_hold" | "skipped"> {
  if (!(await acquireLock(orderId))) return "skipped";
  try {
    const order = await Order.findById(orderId).lean();
    if (!order || !isPaid(order.paymentStatus)) return "skipped";
    if (order.status !== "pending_payment" && order.status !== "cancelled") return "skipped";
    const wasCancelled = order.status === "cancelled";
    const ctx = { orderId: order._id, orderNumber: order.orderNumber, actor: { id: null, name: "Razorpay", type: "system" as const } };

    let stockOk = order.stockCommitted;
    if (!stockOk && order.reservationId) {
      const result = await commitReservation(order.reservationId, { ...ctx, reason: "Payment confirmed" }, null);
      stockOk = result === "committed" || result === "already";
    }
    if (!stockOk) {
      try {
        await deductStock(stockLinesOf(order), { ...ctx, reason: "Payment received after reservation expired" }, null);
        stockOk = true;
      } catch (error) {
        if (!(error instanceof InsufficientStockError)) throw error;
      }
    }

    const nextStatus: OrderStatus = stockOk ? "confirmed" : "on_hold";
    const note = stockOk
      ? wasCancelled
        ? "Payment received after the order was auto-cancelled; order restored"
        : "Payment received and verified"
      : "Payment received but stock is no longer available — refund or restock required";
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ["pending_payment", "cancelled"] } },
      {
        $set: {
          status: nextStatus,
          stockCommitted: stockOk,
          confirmedAt: new Date(),
          cancelledAt: null,
          "cancellation.status": "none",
          needsAttention: !stockOk || wasCancelled,
          attentionReason: !stockOk ? note : wasCancelled ? note : "",
        },
        $push: { statusHistory: statusEvent(nextStatus, note, SYSTEM) },
      },
      { returnDocument: "after" },
    ).lean();
    if (!updated) return "skipped";

    if (stockOk && !updated.salesCounted) {
      await Order.updateOne({ _id: order._id, salesCounted: false }, { $set: { salesCounted: true } });
      await adjustSalesCount(updated, 1);
    }
    await confirmRedemptions(order._id, null);
    await removePurchasedFromCart(order.cartId, stockLinesOf(order));
    invalidateProducts(productIdsOf(order));

    if (stockOk) {
      runAfter(() => notifyOrderConfirmed(updated));
    } else {
      runAfter(() => notifyStatusUpdate(updated, "We have received your payment and are checking stock for your order. We will update you shortly."));
      runAfter(() =>
        notifyAdmins(
          templates.adminAlert(`Action needed: ${order.orderNumber}`, note, siteUrl(`/admin/orders/${order._id.toHexString()}`)),
          "admin_order_on_hold",
          `admin-on-hold:${order._id.toHexString()}`,
        ),
      );
    }
    return stockOk ? "confirmed" : "on_hold";
  } finally {
    await releaseLock(orderId);
  }
}

export async function markPaymentFailed(input: {
  razorpayOrderId: string;
  payment: RazorpayPaymentInfo;
  source: "checkout" | "webhook" | "reconcile";
}): Promise<void> {
  await connectDB();
  const order = await Order.findOne({ razorpayOrderId: input.razorpayOrderId }).lean();
  if (!order || isPaid(order.paymentStatus)) return;
  await recordPaymentEvent(order, input.payment, input.source, "failed");
  const res = await Order.updateOne(
    { _id: order._id, paymentStatus: { $in: ["pending", "failed"] }, status: "pending_payment" },
    { $set: { paymentStatus: "failed" } },
  );
  if (res.matchedCount) runAfter(() => notifyPaymentFailed(order, input.payment.id));
}

/** Cancels an order that was never paid and returns its reserved stock. */
export async function cancelUnpaidOrder(orderId: Types.ObjectId, reason: string, actor: OrderActor): Promise<boolean> {
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending_payment", paymentStatus: { $in: ["pending", "failed"] } },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellation: {
          status: "approved",
          reason,
          requestedAt: new Date(),
          requestedBy: actor.type === "customer" ? "customer" : actor.type === "admin" ? "admin" : "system",
          resolvedAt: new Date(),
          resolvedBy: actor.name,
          note: "",
        },
      },
      $push: { statusHistory: statusEvent("cancelled", reason, actor) },
    },
    { returnDocument: "after" },
  ).lean();
  if (!order) return false;
  if (order.reservationId) {
    await releaseReservation(order.reservationId, reason, { orderId: order._id, orderNumber: order.orderNumber, actor: inventoryActor(actor) }, null);
  }
  await releaseRedemptions(order._id, null);
  await Payment.updateMany(
    { orderId: order._id, status: "created" },
    { $set: { status: "failed" }, $push: { events: { type: "cancelled", source: "system", at: new Date(), detail: reason } } },
  );
  invalidateProducts(productIdsOf(order));
  return true;
}

/**
 * Before cancelling an unpaid order, asks Razorpay whether a payment was
 * actually captured (e.g. webhook delayed) so paid orders are never lost.
 */
export async function reconcileOrCancelUnpaid(orderId: Types.ObjectId, reason: string): Promise<"confirmed" | "cancelled" | "unchanged"> {
  const order = await Order.findById(orderId).lean();
  if (!order || order.status !== "pending_payment") return "unchanged";
  if (order.razorpayOrderId && integrations.razorpay()) {
    try {
      const payments = await fetchOrderPayments(order.razorpayOrderId);
      const successful = payments.find((p) => p.status === "captured" || p.status === "authorized");
      if (successful) {
        const result = await confirmOnlinePayment({ razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: successful.id, source: "reconcile" });
        if (result.outcome === "confirmed" || result.outcome === "on_hold" || result.outcome === "already_paid") return "confirmed";
      }
    } catch (error) {
      console.error(`Could not reconcile ${order.orderNumber} with Razorpay; leaving it for the next run`, error);
      return "unchanged";
    }
  }
  return (await cancelUnpaidOrder(order._id, reason, SYSTEM)) ? "cancelled" : "unchanged";
}

/** Scheduled job: expires unpaid orders whose stock hold has lapsed and finishes stuck paid orders. */
export async function runPaymentMaintenance(now = new Date()): Promise<{ expired: number; recovered: number; finalized: number }> {
  await connectDB();
  let expired = 0;
  let recovered = 0;
  let finalized = 0;
  const overdue = await Order.find(
    { status: "pending_payment", reservationExpiresAt: { $lte: now }, paymentStatus: { $in: ["pending", "failed"] } },
    { _id: 1 },
  )
    .limit(50)
    .lean();
  for (const order of overdue) {
    const result = await reconcileOrCancelUnpaid(order._id, "Payment not completed in time");
    if (result === "cancelled") expired++;
    if (result === "confirmed") recovered++;
  }
  const stuck = await Order.find(
    { status: "pending_payment", paymentStatus: "paid", updatedAt: { $lte: new Date(now.getTime() - 60_000) } },
    { _id: 1 },
  )
    .limit(50)
    .lean();
  for (const order of stuck) {
    if ((await finalizePaidOrder(order._id)) !== "skipped") finalized++;
  }
  return { expired, recovered, finalized };
}

/* ------------------------------------------------------------------ */
/* Cancellation                                                        */
/* ------------------------------------------------------------------ */

const CANCELLABLE: OrderStatus[] = ["confirmed", "processing", "packed", "on_hold"];

export async function cancelOrder(
  orderId: Types.ObjectId,
  opts: { actor: OrderActor; reason: string; refundMode: "auto" | "approval" | "none"; notify?: boolean },
): Promise<OrderDoc> {
  await connectDB();
  const current = await Order.findById(orderId).lean();
  if (!current) throw new NotFoundError("Order not found");
  if (current.status === "pending_payment") {
    await cancelUnpaidOrder(orderId, opts.reason, opts.actor);
    return (await Order.findById(orderId).lean())!;
  }
  if (!CANCELLABLE.includes(current.status)) throw new AppError("This order can no longer be cancelled.");
  if (!(await acquireLock(orderId))) throw new AppError("This order is being updated. Please try again in a moment.");

  try {
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: { $in: CANCELLABLE } },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          "cancellation.status": "approved",
          "cancellation.reason": opts.reason,
          "cancellation.requestedAt": current.cancellation?.requestedAt ?? new Date(),
          "cancellation.requestedBy": current.cancellation?.requestedBy ?? (opts.actor.type === "customer" ? "customer" : opts.actor.type === "admin" ? "admin" : "system"),
          "cancellation.resolvedAt": new Date(),
          "cancellation.resolvedBy": opts.actor.name,
        },
        $push: { statusHistory: statusEvent("cancelled", opts.reason, opts.actor) },
      },
      { returnDocument: "after" },
    ).lean();
    if (!order) throw new AppError("This order can no longer be cancelled.");

    const ctx = { orderId: order._id, orderNumber: order.orderNumber, reason: "Order cancelled", actor: inventoryActor(opts.actor) };
    if (order.stockCommitted) {
      await restockLines(stockLinesOf(order), "restock", ctx, null);
      await Order.updateOne({ _id: order._id }, { $set: { stockCommitted: false } });
    } else if (order.reservationId) {
      await releaseReservation(order.reservationId, "Order cancelled", ctx, null);
    }
    await releaseRedemptions(order._id, null);
    if (order.salesCounted) {
      await Order.updateOne({ _id: order._id }, { $set: { salesCounted: false } });
      await adjustSalesCount(order, -1);
    }

    // Cancel a booked courier shipment if the provider supports it.
    const shipment = await Shipment.findOne({ orderId: order._id, status: { $in: ["booked", "pending"] } }).lean();
    if (shipment) {
      const provider = getShippingProvider(await loadSettings());
      if (shipment.provider === "shiprocket" && provider.id === "shiprocket" && shipment.providerOrderId && provider.cancel) {
        await provider.cancel(shipment.providerOrderId).catch((e) => console.error("Courier cancellation failed", e));
      }
      await Shipment.updateOne({ _id: shipment._id }, { $set: { status: "cancelled" } });
    }

    let refundNote: string | null = null;
    const refundable = order.pricing.amountPaid - order.pricing.amountRefunded;
    if (refundable > 0 && opts.refundMode !== "none") {
      const refund = await createRefund({
        order,
        amount: refundable,
        reason: `Order cancelled: ${opts.reason}`,
        source: "cancellation",
        requestedBy: { id: opts.actor.id, name: opts.actor.name, type: opts.actor.type === "carrier" ? "system" : opts.actor.type },
      });
      if (opts.refundMode === "auto") {
        try {
          await approveRefund(refund._id.toHexString(), { id: opts.actor.id, name: opts.actor.name, type: opts.actor.type === "customer" ? "customer" : opts.actor.type === "admin" ? "admin" : "system" });
          refundNote = `A refund of ${formatINR(refundable)} has been initiated to your original payment method.`;
        } catch (error) {
          console.error("Automatic refund failed", error);
          refundNote = `Your refund of ${formatINR(refundable)} will be processed by our team shortly.`;
        }
      } else {
        refundNote = `Your refund of ${formatINR(refundable)} will be processed to your original payment method shortly.`;
      }
    }

    invalidateProducts(productIdsOf(order));
    if (opts.notify !== false) runAfter(() => notifyCancelled(order, opts.reason, refundNote));
    return (await Order.findById(order._id).lean())!;
  } finally {
    await releaseLock(orderId);
  }
}

export function customerDirectCancelStatuses(until: "confirmed" | "processing" | "packed"): OrderStatus[] {
  const statuses: OrderStatus[] = ["pending_payment", "confirmed"];
  if (until === "processing" || until === "packed") statuses.push("processing");
  if (until === "packed") statuses.push("packed");
  return statuses;
}

/** Customer-initiated cancellation: immediate when policy allows, otherwise a request for staff. */
export async function customerCancel(
  orderId: Types.ObjectId,
  reason: string,
  actor: OrderActor,
): Promise<"cancelled" | "requested"> {
  await connectDB();
  const settings = await loadSettings();
  const order = await Order.findById(orderId).lean();
  if (!order) throw new NotFoundError("Order not found");
  const direct = customerDirectCancelStatuses(settings.orders.customerCancelUntil);

  if (direct.includes(order.status)) {
    await cancelOrder(orderId, {
      actor,
      reason: reason || "Cancelled by customer",
      refundMode: settings.orders.autoRefundOnCustomerCancel ? "auto" : "approval",
    });
    return "cancelled";
  }
  if (["processing", "packed", "on_hold"].includes(order.status)) {
    if (order.cancellation?.status === "requested") throw new AppError("A cancellation request is already pending for this order.");
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          cancellation: { status: "requested", reason, requestedAt: new Date(), requestedBy: "customer", resolvedAt: null, resolvedBy: null, note: "" },
          needsAttention: true,
          attentionReason: "Customer requested cancellation",
        },
      },
    );
    runAfter(() =>
      notifyAdmins(
        templates.adminAlert(`Cancellation requested: ${order.orderNumber}`, reason || "No reason given", siteUrl(`/admin/orders/${order._id.toHexString()}`)),
        "admin_cancel_request",
        `admin-cancel-request:${order._id.toHexString()}`,
      ),
    );
    return "requested";
  }
  throw new AppError("This order can no longer be cancelled. You can request a return after delivery if eligible.");
}

export async function resolveCancellationRequest(orderId: Types.ObjectId, approve: boolean, note: string, actor: OrderActor): Promise<void> {
  await connectDB();
  const order = await Order.findById(orderId).lean();
  if (!order || order.cancellation?.status !== "requested") throw new AppError("There is no pending cancellation request for this order.");
  if (approve) {
    const cancelled = await cancelOrder(orderId, { actor, reason: order.cancellation.reason || "Cancelled at customer request", refundMode: "auto", notify: false });
    await Order.updateOne({ _id: orderId }, { $set: { "cancellation.note": note, needsAttention: false, attentionReason: "" } });
    runAfter(() => notifyCancellationDecision(cancelled, true, note));
  } else {
    await Order.updateOne(
      { _id: orderId, "cancellation.status": "requested" },
      {
        $set: {
          "cancellation.status": "rejected",
          "cancellation.resolvedAt": new Date(),
          "cancellation.resolvedBy": actor.name,
          "cancellation.note": note,
          needsAttention: false,
          attentionReason: "",
        },
      },
    );
    runAfter(() => notifyCancellationDecision(order, false, note));
  }
}

/* ------------------------------------------------------------------ */
/* Fulfilment status                                                   */
/* ------------------------------------------------------------------ */

interface TransitionOptions {
  actor: OrderActor;
  note?: string;
  shipment?: { courierName?: string | null; trackingNumber?: string | null; trackingUrl?: string | null };
  restock?: boolean;
}

async function applyTransition(order: OrderDoc, to: OrderStatus, opts: TransitionOptions): Promise<OrderDoc> {
  const now = new Date();
  const set: Record<string, unknown> = { status: to };
  if (to === "delivered") {
    set.deliveredAt = now;
    set["shipment.deliveredAt"] = now;
    if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
      set.paymentStatus = "paid";
      set.paidAt = now;
      set["pricing.amountPaid"] = order.pricing.grandTotal;
    }
  }
  if (to === "shipped" || to === "out_for_delivery") {
    if (!order.shipment?.shippedAt) set["shipment.shippedAt"] = now;
  }
  if (opts.shipment && (opts.shipment.trackingNumber || opts.shipment.courierName)) {
    set["shipment.provider"] = order.shipment?.provider ?? "manual";
    if (opts.shipment.courierName) set["shipment.courierName"] = opts.shipment.courierName;
    if (opts.shipment.trackingNumber) set["shipment.trackingNumber"] = opts.shipment.trackingNumber;
    if (opts.shipment.trackingUrl) set["shipment.trackingUrl"] = opts.shipment.trackingUrl;
  }
  if (to === "confirmed" || to === "processing") {
    set.needsAttention = false;
    set.attentionReason = "";
  }

  const label = ORDER_STATUS_LABELS[to];
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: statusEvent(to, opts.note || label, opts.actor) } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw new AppError("This order was just updated by someone else. Refresh and try again.", "CONFLICT", 409);

  if (to === "packed" || to === "shipped") await ensureInvoiceNumber(updated._id).catch((e) => console.error(e));

  if ((to === "shipped" || to === "out_for_delivery") && (opts.shipment?.trackingNumber || opts.shipment?.courierName)) {
    await Shipment.findOneAndUpdate(
      { orderId: updated._id, provider: "manual", status: { $ne: "cancelled" } },
      {
        $set: {
          orderNumber: updated.orderNumber,
          courierName: opts.shipment.courierName ?? updated.shipment.courierName,
          trackingNumber: opts.shipment.trackingNumber ?? updated.shipment.trackingNumber,
          trackingUrl: opts.shipment.trackingUrl ?? updated.shipment.trackingUrl,
          status: "in_transit",
        },
        $setOnInsert: { provider: "manual", bookedAt: now, weightGrams: 0 },
        $push: { events: { status: "SHIPPED", description: opts.note ?? "Shipped", location: "", at: now, source: "admin" } },
      },
      { upsert: true },
    );
  }

  if (to === "delivered") {
    await Shipment.updateMany({ orderId: updated._id, status: { $nin: ["cancelled"] } }, { $set: { status: "delivered", deliveredAt: now } });
    if (order.paymentMethod === "cod") {
      await Payment.updateOne(
        { orderId: updated._id, provider: "cod" },
        { $set: { status: "captured" }, $push: { events: { type: "cod.collected", source: opts.actor.type === "admin" ? "admin" : "system", at: now } } },
      );
    }
  }

  if (to === "rto_delivered") {
    if (opts.restock !== false && updated.stockCommitted) {
      await restockLines(stockLinesOf(updated), "return", {
        orderId: updated._id,
        orderNumber: updated.orderNumber,
        reason: "Returned to origin (undelivered)",
        actor: inventoryActor(opts.actor),
      }, null);
      await Order.updateOne({ _id: updated._id }, { $set: { stockCommitted: false } });
      invalidateProducts(productIdsOf(updated));
    }
    const refundable = updated.pricing.amountPaid - updated.pricing.amountRefunded;
    if (refundable > 0) {
      await createRefund({
        order: updated,
        amount: refundable,
        reason: "Shipment returned to origin",
        source: "admin",
        requestedBy: { id: opts.actor.id, name: opts.actor.name, type: opts.actor.type === "admin" ? "admin" : "system" },
      }).catch((e) => console.error(e));
    }
  }

  // Customer notifications
  if (to === "shipped") {
    runAfter(() =>
      notifyShipped(updated, {
        courierName: updated.shipment.courierName,
        trackingNumber: updated.shipment.trackingNumber,
        trackingUrl: updated.shipment.trackingUrl,
      }),
    );
  } else if (to === "delivered") {
    runAfter(() => notifyDelivered(updated));
  } else if (to === "out_for_delivery" || to === "delivery_failed" || to === "on_hold") {
    runAfter(() => notifyStatusUpdate(updated, opts.note));
  }
  return updated;
}

/** Admin fulfilment update with server-side transition validation. */
export async function updateOrderStatus(orderId: Types.ObjectId, to: OrderStatus, opts: TransitionOptions): Promise<OrderDoc> {
  await connectDB();
  const order = await Order.findById(orderId).lean();
  if (!order) throw new NotFoundError("Order not found");
  if (to === "cancelled") {
    return cancelOrder(orderId, { actor: opts.actor, reason: opts.note || "Cancelled by the store", refundMode: "auto" });
  }
  if (!canAdminTransition(order.status, to)) {
    throw new AppError(`An order cannot move from "${ORDER_STATUS_LABELS[order.status]}" to "${ORDER_STATUS_LABELS[to]}".`, "INVALID_TRANSITION");
  }
  if (order.status === "on_hold" && !order.stockCommitted && (to === "confirmed" || to === "processing")) {
    throw new AppError("Stock was never deducted for this order. Restock the items or cancel and refund the order.");
  }
  return applyTransition(order, to, opts);
}

/** Applies a courier tracking update (webhook or tracking refresh). */
export async function applyCarrierUpdate(input: {
  orderNumber?: string | null;
  trackingNumber?: string | null;
  rawStatus: string;
  events?: TrackingEvent[];
  trackingUrl?: string | null;
  source: "webhook" | "provider";
}): Promise<{ orderNumber: string | null; changed: boolean; status: OrderStatus | null }> {
  await connectDB();
  let shipment = input.trackingNumber ? await Shipment.findOne({ trackingNumber: input.trackingNumber }).lean() : null;
  let order = shipment ? await Order.findById(shipment.orderId).lean() : null;
  if (!order && input.orderNumber) {
    order = await Order.findOne({ orderNumber: input.orderNumber }).lean();
    if (order) shipment = await Shipment.findOne({ orderId: order._id }).sort({ createdAt: -1 }).lean();
  }
  if (!order) return { orderNumber: null, changed: false, status: null };

  if (shipment) {
    const known = new Set(shipment.events.map((e) => `${e.status}|${new Date(e.at).getTime()}`));
    const fresh = (input.events ?? []).filter((e) => !known.has(`${e.status}|${e.at.getTime()}`));
    const mappedShipment = mapCarrierStatus(input.rawStatus);
    const shipmentStatus =
      mappedShipment === "delivered"
        ? "delivered"
        : mappedShipment === "out_for_delivery"
          ? "out_for_delivery"
          : mappedShipment === "delivery_failed"
            ? "failed"
            : mappedShipment === "rto_initiated"
              ? "rto"
              : mappedShipment === "rto_delivered"
                ? "rto_delivered"
                : mappedShipment === "shipped"
                  ? "in_transit"
                  : shipment.status;
    await Shipment.updateOne(
      { _id: shipment._id },
      {
        $set: { status: shipmentStatus, ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}) },
        $push: { events: { $each: fresh.map((e) => ({ ...e, source: input.source === "webhook" ? "webhook" : "provider" })) } },
      },
    );
  }

  if (isExceptionStatus(input.rawStatus)) {
    await Order.updateOne({ _id: order._id }, { $set: { needsAttention: true, attentionReason: `Courier reported: ${input.rawStatus}` } });
  }

  const mapped = mapCarrierStatus(input.rawStatus);
  if (!mapped || mapped === order.status || !canCarrierTransition(order.status, mapped)) {
    return { orderNumber: order.orderNumber, changed: false, status: order.status };
  }
  const carrier: OrderActor = { id: null, name: shipment?.courierName ?? "Courier", type: "carrier" };
  const updated = await applyTransition(order, mapped, { actor: carrier, note: `Courier update: ${input.rawStatus}` });
  return { orderNumber: order.orderNumber, changed: true, status: updated.status };
}

/* ------------------------------------------------------------------ */
/* Shipments                                                           */
/* ------------------------------------------------------------------ */

export async function bookShipment(
  orderId: Types.ObjectId,
  pkg: { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number },
  actor: OrderActor,
): Promise<{ status: "booked" | "pending"; message: string }> {
  await connectDB();
  const settings = await loadSettings();
  const provider = bookingProvider(settings);
  if (!provider?.createShipment) throw new AppError("No courier integration is configured. Enter courier details manually instead.");
  const order = await Order.findById(orderId).lean();
  if (!order) throw new NotFoundError("Order not found");
  if (!["confirmed", "processing", "packed"].includes(order.status)) throw new AppError("Only confirmed orders that have not shipped can be booked.");
  const active = await Shipment.findOne({ orderId, status: { $in: ["booked", "in_transit", "out_for_delivery"] } }).lean();
  if (active) throw new AppError("This order already has an active shipment.");

  const result = await provider.createShipment(
    {
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      paymentMethod: order.paymentMethod,
      grandTotal: order.pricing.grandTotal,
      subTotal: order.pricing.subtotal - order.pricing.discountTotal,
      shippingFee: order.pricing.shippingFee,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      items: (order.items as OrderItemDoc[]).map((i) => ({
        name: `${i.productName} ${i.variantLabel}`,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: Math.round(i.lineTotal / i.quantity),
        taxRate: i.taxRate,
        hsnCode: i.hsnCode,
      })),
    },
    pkg,
  );

  await Shipment.findOneAndUpdate(
    { orderId, provider: provider.id, status: { $in: ["pending"] } },
    {
      $set: {
        orderNumber: order.orderNumber,
        status: result.status,
        courierName: result.courierName,
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl,
        providerOrderId: result.providerOrderId,
        providerShipmentId: result.providerShipmentId,
        weightGrams: pkg.weightGrams,
        bookedAt: result.status === "booked" ? new Date() : null,
      },
      $setOnInsert: { provider: provider.id },
      $push: { events: { status: result.status.toUpperCase(), description: result.message, location: "", at: new Date(), source: "provider" } },
    },
    { upsert: true },
  );

  if (result.status === "booked") {
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          "shipment.provider": provider.id,
          "shipment.courierName": result.courierName,
          "shipment.trackingNumber": result.trackingNumber,
          "shipment.trackingUrl": result.trackingUrl,
        },
        $push: { internalNotes: { note: `Shipment booked: ${result.courierName ?? ""} ${result.trackingNumber ?? ""}`.trim(), at: new Date(), by: { id: actor.id, name: actor.name, type: actor.type } } },
      },
    );
  }
  return { status: result.status, message: result.message };
}

export async function refreshTracking(orderId: Types.ObjectId): Promise<string> {
  await connectDB();
  const settings = await loadSettings();
  const provider = getShippingProvider(settings);
  const shipment = await Shipment.findOne({ orderId, trackingNumber: { $ne: null }, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).lean();
  if (!shipment?.trackingNumber) throw new AppError("This order has no tracking number yet.");
  if (shipment.provider !== provider.id || !provider.track) throw new AppError("Live tracking is only available for shipments booked through the courier integration.");
  const tracking = await provider.track(shipment.trackingNumber);
  const result = await applyCarrierUpdate({
    trackingNumber: shipment.trackingNumber,
    rawStatus: tracking.rawStatus,
    events: tracking.events,
    trackingUrl: tracking.trackingUrl,
    source: "provider",
  });
  return result.changed ? `Status updated to ${ORDER_STATUS_LABELS[result.status!]}` : `Courier status: ${tracking.rawStatus || "no update yet"}`;
}

export async function addInternalNote(orderId: Types.ObjectId, note: string, actor: OrderActor): Promise<void> {
  await connectDB();
  await Order.updateOne({ _id: orderId }, { $push: { internalNotes: { note, at: new Date(), by: { id: actor.id, name: actor.name, type: actor.type } } } });
}

export async function clearAttention(orderId: Types.ObjectId): Promise<void> {
  await connectDB();
  await Order.updateOne({ _id: orderId }, { $set: { needsAttention: false, attentionReason: "" } });
}
