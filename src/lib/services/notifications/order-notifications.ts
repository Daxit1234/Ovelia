import "server-only";
import type { OrderDoc, RefundDoc } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { customerOrderUrl } from "@/lib/services/order-access";
import { loadSettings } from "@/lib/services/settings";
import { sendEmail } from "@/lib/services/notifications";
import { templates, type EmailOrder } from "@/lib/services/notifications/templates";
import type { EmailContent } from "@/lib/services/notifications/email-layout";
import type { OrderItemDoc } from "@/lib/db";

type OrderLike = Pick<
  OrderDoc,
  "_id" | "orderNumber" | "userId" | "customer" | "placedAt" | "paymentMethod" | "status" | "items" | "pricing" | "shippingAddress"
>;

export function toEmailOrder(order: OrderLike): EmailOrder {
  const id = order._id.toHexString();
  return {
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    placedAt: order.placedAt,
    paymentMethod: order.paymentMethod,
    status: order.status,
    items: (order.items as OrderItemDoc[]).map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    pricing: order.pricing,
    shippingAddress: order.shippingAddress,
    orderUrl: customerOrderUrl({ id, orderNumber: order.orderNumber, userId: order.userId ? order.userId.toHexString() : null }),
  };
}

async function toCustomer(order: OrderLike, template: string, content: EmailContent, dedupeKey: string) {
  return sendEmail({
    to: order.customer.email,
    template,
    content,
    orderId: order._id,
    userId: order.userId,
    dedupeKey,
  });
}

export async function notifyAdmins(content: EmailContent, template: string, dedupeKey?: string) {
  const settings = await loadSettings();
  const recipients = settings.orders.notificationEmails.length
    ? settings.orders.notificationEmails
    : settings.store.supportEmail
      ? [settings.store.supportEmail]
      : [];
  if (recipients.length === 0) return "skipped" as const;
  return sendEmail({ to: recipients, template, content, settings, dedupeKey });
}

export async function notifyOrderConfirmed(order: OrderLike) {
  const email = toEmailOrder(order);
  const id = order._id.toHexString();
  await toCustomer(order, "order_confirmed", templates.orderConfirmation(email), `order-confirmed:${id}`);
  await notifyAdmins(templates.adminNewOrder(email, siteUrl(`/admin/orders/${id}`)), "admin_new_order", `admin-new-order:${id}`);
}

export async function notifyPaymentFailed(order: OrderLike, paymentRef: string) {
  await toCustomer(order, "payment_failed", templates.paymentFailed(toEmailOrder(order)), `payment-failed:${paymentRef}`);
}

export async function notifyShipped(
  order: OrderLike,
  shipment: { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null },
) {
  await toCustomer(
    order,
    "order_shipped",
    templates.orderShipped(toEmailOrder(order), shipment),
    `order-shipped:${order._id.toHexString()}:${shipment.trackingNumber ?? "manual"}`,
  );
}

export async function notifyDelivered(order: OrderLike) {
  await toCustomer(order, "order_delivered", templates.orderDelivered(toEmailOrder(order)), `order-delivered:${order._id.toHexString()}`);
}

export async function notifyStatusUpdate(order: OrderLike, note?: string) {
  await toCustomer(
    order,
    `order_${order.status}`,
    templates.orderStatusUpdate(toEmailOrder(order), note),
    `order-status:${order._id.toHexString()}:${order.status}`,
  );
}

export async function notifyCancelled(order: OrderLike, reason: string, refundNote: string | null) {
  await toCustomer(
    order,
    "order_cancelled",
    templates.orderCancelled(toEmailOrder(order), reason, refundNote),
    `order-cancelled:${order._id.toHexString()}`,
  );
}

export async function notifyCancellationDecision(order: OrderLike, approved: boolean, note: string) {
  await toCustomer(
    order,
    "cancellation_decision",
    templates.cancellationRequestUpdate(toEmailOrder(order), approved, note),
    `cancellation-decision:${order._id.toHexString()}:${approved ? "approved" : "rejected"}`,
  );
}

export async function notifyRefund(order: OrderLike, refund: Pick<RefundDoc, "_id" | "amount">, status: "initiated" | "processed" | "failed") {
  await toCustomer(
    order,
    `refund_${status}`,
    templates.refundUpdate(toEmailOrder(order), refund.amount, status),
    `refund-${status}:${refund._id.toHexString()}`,
  );
}

export async function notifyReturnUpdate(order: OrderLike, returnId: string, statusLabel: string, note: string) {
  await toCustomer(
    order,
    "return_update",
    templates.returnUpdate(toEmailOrder(order), statusLabel, note),
    `return:${returnId}:${statusLabel}`,
  );
}
