"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB, Order } from "@/lib/db";
import { normalizeIndianMobile } from "@/lib/india";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { customerOrderPath, verifyOrderAccessToken } from "@/lib/services/order-access";
import { customerCancel } from "@/lib/services/orders";
import { rateLimitByIp } from "@/lib/services/rate-limit";
import { createReturnRequest, RETURN_REASONS } from "@/lib/services/returns";
import { trackOrderSchema } from "@/lib/validation/checkout";

async function authorizedOrder(orderNumber: string, token: string | null | undefined) {
  await connectDB();
  const order = await Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() }).lean();
  if (!order) return null;
  const user = await getSessionUser();
  const isOwner = !!order.userId && user?.id === order.userId.toHexString();
  if (!isOwner && !verifyOrderAccessToken(order._id.toHexString(), token)) return null;
  return { order, user };
}

export async function cancelOrderAction(input: { orderNumber: string; token?: string | null; reason: string }): Promise<ActionResult<{ outcome: "cancelled" | "requested" }>> {
  const reason = z.string().trim().min(3, "Please tell us why you want to cancel").max(300).safeParse(input.reason);
  if (!reason.success) return fail(reason.error.issues[0].message);
  try {
    const found = await authorizedOrder(input.orderNumber, input.token);
    if (!found) return fail("Order not found.");
    const outcome = await customerCancel(found.order._id, reason.data, {
      id: found.user?.id ?? null,
      name: found.order.customer.name,
      type: "customer",
      email: found.order.customer.email,
    });
    return ok(
      { outcome },
      outcome === "cancelled" ? "Your order has been cancelled." : "Your cancellation request has been sent. We'll update you shortly.",
    );
  } catch (error) {
    return toActionError(error, "Could not cancel this order.");
  }
}

const returnSchema = z.object({
  orderNumber: z.string().min(6).max(32),
  token: z.string().max(64).nullable().optional(),
  items: z.array(z.object({ orderItemId: z.string().regex(/^[a-f0-9]{24}$/), quantity: z.number().int().min(1).max(99) })).min(1, "Select at least one item"),
  reason: z.enum(RETURN_REASONS),
  details: z.string().trim().max(1000),
  resolution: z.enum(["refund", "replacement"]),
});

export async function requestReturnAction(input: z.input<typeof returnSchema>): Promise<ActionResult<null>> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your return request.");
  try {
    const found = await authorizedOrder(parsed.data.orderNumber, parsed.data.token);
    if (!found) return fail("Order not found.");
    await createReturnRequest({
      orderId: found.order._id,
      userId: found.order.userId?.toHexString() ?? null,
      items: parsed.data.items,
      reason: parsed.data.reason,
      details: parsed.data.details,
      resolution: parsed.data.resolution,
    });
    return ok(null, "Return request submitted. We'll review it and get back to you.");
  } catch (error) {
    return toActionError(error, "Could not submit the return request.");
  }
}

/** Finds an order by number + email/phone, returning a link to its tracking page. */
export async function trackOrderAction(input: z.input<typeof trackOrderSchema>): Promise<ActionResult<{ href: string }>> {
  const parsed = trackOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details and try again.");
  const limit = await rateLimitByIp("track-order", 10, 600);
  if (!limit.allowed) return fail("Too many attempts. Please try again in a few minutes.");
  await connectDB();
  const order = await Order.findOne({ orderNumber: parsed.data.orderNumber }, { orderNumber: 1, customer: 1, userId: 1 }).lean();
  const contact = parsed.data.contact.trim().toLowerCase();
  const phone = normalizeIndianMobile(contact);
  const matches = order && (order.customer.email === contact || (phone !== null && order.customer.phone === phone));
  if (!order || !matches) return fail("We couldn't find an order with those details. Check the order number and the email or phone used at checkout.");
  // Always use the token link so guests and signed-out customers can view it.
  return ok({ href: customerOrderPath({ id: order._id.toHexString(), orderNumber: order.orderNumber, userId: null }) });
}
