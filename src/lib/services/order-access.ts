import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv, siteUrl } from "@/lib/env";

/**
 * Guest order links carry an HMAC of the order id, so links can be generated
 * for any email without storing tokens, and cannot be guessed or enumerated.
 */
export function orderAccessToken(orderId: string): string {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(`order-access:${orderId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderAccessToken(orderId));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function customerOrderPath(order: { id: string; orderNumber: string; userId: string | null }): string {
  if (order.userId) return `/account/orders/${order.orderNumber}`;
  return `/orders/${order.orderNumber}?token=${orderAccessToken(order.id)}`;
}

export function customerOrderUrl(order: { id: string; orderNumber: string; userId: string | null }): string {
  return siteUrl(customerOrderPath(order));
}
