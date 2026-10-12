"use server";

import { z } from "zod";
import { connectDB, Order } from "@/lib/db";
import { INDIAN_STATE_NAMES, normalizeIndianMobile } from "@/lib/india";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { saveAddress } from "@/lib/services/addresses";
import { getCartView } from "@/lib/services/cart";
import { customerIdentity, resolveCartIdentity } from "@/lib/services/cart-identity";
import { customerOrderPath, verifyOrderAccessToken } from "@/lib/services/order-access";
import {
  confirmOnlinePayment,
  getRetryCheckout,
  markPaymentFailed,
  placeOrder,
  TotalChangedError,
  type RazorpayCheckoutData,
} from "@/lib/services/orders";
import { fetchPayment, verifyCheckoutSignature } from "@/lib/services/payments/razorpay";
import { rateLimitByIp } from "@/lib/services/rate-limit";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import type { CartView } from "@/lib/types";

const quoteSchema = z.object({
  shippingMethod: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["razorpay", "cod"]).nullable(),
  state: z.enum(INDIAN_STATE_NAMES).nullable(),
  email: z.string().trim().max(254).nullable(),
  phone: z.string().trim().max(20).nullable(),
});

/** Server-priced totals for the options currently selected at checkout. */
export async function quoteCheckoutAction(input: z.input<typeof quoteSchema>): Promise<ActionResult<CartView>> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid checkout details");
  try {
    const { identity, user } = await resolveCartIdentity(false);
    const email = parsed.data.email && z.email().safeParse(parsed.data.email).success ? parsed.data.email.toLowerCase() : null;
    const phone = normalizeIndianMobile(parsed.data.phone);
    const { view } = await getCartView(identity, customerIdentity(user, { email, phone }), {
      shippingMethod: parsed.data.shippingMethod,
      paymentMethod: parsed.data.paymentMethod,
      destinationState: parsed.data.state,
    });
    return ok(view);
  } catch (error) {
    return toActionError(error, "Could not calculate your order total.");
  }
}

export interface PlaceOrderResponse {
  orderNumber: string;
  redirectTo: string;
  razorpay: RazorpayCheckoutData | null;
}

export async function placeOrderAction(input: CheckoutInput): Promise<ActionResult<PlaceOrderResponse> & { newTotal?: number }> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  const limit = await rateLimitByIp("checkout", 12, 600);
  if (!limit.allowed) return fail("Too many attempts. Please wait a few minutes and try again.");

  try {
    const { identity, user } = await resolveCartIdentity(false);
    if (!identity.userId && !identity.guestToken) return fail("Your cart is empty.");
    const result = await placeOrder(parsed.data, {
      userId: user?.id ?? null,
      cartIdentity: identity,
      actor: { id: user?.id ?? null, name: parsed.data.contact.name, type: "customer", email: parsed.data.contact.email },
    });
    if (user && parsed.data.saveAddress) {
      await saveAddress(user.id, { ...parsed.data.shippingAddress, label: "home", isDefault: false }).catch((e) => console.error("Address save failed", e));
    }
    const separator = result.confirmationPath.includes("?") ? "&" : "?";
    return ok({
      orderNumber: result.orderNumber,
      redirectTo: `${result.confirmationPath}${separator}placed=1`,
      razorpay: result.razorpay,
    });
  } catch (error) {
    if (error instanceof TotalChangedError) return { ok: false, error: error.message, newTotal: error.newTotal };
    return toActionError(error, "We could not place your order. Please try again.");
  }
}

const verifySchema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

/**
 * Called by Razorpay Checkout's success handler. The signature proves the
 * response came from Razorpay; the payment state and amount are then
 * re-fetched from Razorpay's API before the order is confirmed.
 */
export async function verifyPaymentAction(input: z.input<typeof verifySchema>): Promise<ActionResult<{ redirectTo: string; status: string }>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid payment response.");
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  if (!verifyCheckoutSignature({ razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, signature: razorpay_signature })) {
    return fail("We could not verify this payment. If money was debited, it will be reconciled automatically — please contact support with your order number.");
  }
  try {
    const result = await confirmOnlinePayment({ razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, source: "checkout" });
    if (!result.order) return fail("Order not found for this payment.");
    const path = customerOrderPath({ id: result.order._id.toHexString(), orderNumber: result.order.orderNumber, userId: result.order.userId?.toHexString() ?? null });
    return ok({ redirectTo: `${path}${path.includes("?") ? "&" : "?"}placed=1`, status: result.outcome });
  } catch (error) {
    return toActionError(error, "Your payment is being confirmed. Please check your order page in a moment.");
  }
}

/** Records a failed attempt reported by Checkout, after confirming it with Razorpay. */
export async function reportPaymentFailureAction(input: { razorpayOrderId: string; razorpayPaymentId: string }): Promise<void> {
  if (!/^order_[A-Za-z0-9]+$/.test(input.razorpayOrderId) || !/^pay_[A-Za-z0-9]+$/.test(input.razorpayPaymentId)) return;
  const limit = await rateLimitByIp("payment-failure", 20, 600);
  if (!limit.allowed) return;
  try {
    const payment = await fetchPayment(input.razorpayPaymentId);
    if (payment.orderId === input.razorpayOrderId && payment.status === "failed") {
      await markPaymentFailed({ razorpayOrderId: input.razorpayOrderId, payment, source: "checkout" });
    }
  } catch (error) {
    console.error("Could not record payment failure", error);
  }
}

/** Razorpay Checkout options to retry payment for an unpaid order the caller owns. */
export async function retryPaymentAction(input: { orderNumber: string; token?: string | null }): Promise<ActionResult<RazorpayCheckoutData>> {
  const orderNumber = input.orderNumber?.trim().toUpperCase();
  if (!orderNumber || orderNumber.length > 32) return fail("Order not found.");
  try {
    await connectDB();
    const order = await Order.findOne({ orderNumber }, { _id: 1, userId: 1 }).lean();
    if (!order) return fail("Order not found.");
    const { user } = await resolveCartIdentity(false);
    const isOwner = order.userId ? user?.id === order.userId.toHexString() : false;
    if (!isOwner && !verifyOrderAccessToken(order._id.toHexString(), input.token)) return fail("Order not found.");
    return ok(await getRetryCheckout(order._id));
  } catch (error) {
    return toActionError(error, "Could not restart the payment.");
  }
}

