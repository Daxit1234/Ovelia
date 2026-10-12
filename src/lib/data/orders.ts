import "server-only";
import { connectDB, Order, Refund, ReturnRequest, Review, Shipment, type OrderDoc, type OrderItemDoc } from "@/lib/db";
import { toObjectId } from "@/lib/db/model";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from "@/lib/domain/order-status";
import { verifyOrderAccessToken } from "@/lib/services/order-access";
import { customerDirectCancelStatuses } from "@/lib/services/orders";
import { RETURN_STATUS_LABELS, returnEligibility } from "@/lib/services/returns";
import { loadSettings } from "@/lib/services/settings";
import { connection } from "next/server";

export interface CustomerOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  sku: string;
  image: string | null;
  quantity: number;
  unitMrp: number;
  unitPrice: number;
  lineSubtotal: number;
  discount: number;
  lineTotal: number;
  returnedQuantity: number;
  reviewed: boolean;
}

export interface CustomerOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  paymentStatusLabel: string;
  paymentMethod: "razorpay" | "cod";
  paymentMethodLabel: string;
  placedAt: string;
  deliveredAt: string | null;
  customer: { name: string; email: string; phone: string };
  shippingAddress: OrderDoc["shippingAddress"];
  billingAddress: OrderDoc["billingAddress"];
  shippingMethod: OrderDoc["shippingMethod"];
  items: CustomerOrderItem[];
  pricing: OrderDoc["pricing"];
  appliedPromotions: { name: string; code: string | null; amount: number; freeShipping: boolean }[];
  timeline: { status: OrderStatus; label: string; at: string }[];
  shipment: { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; shippedAt: string | null; events: { status: string; description: string; location: string; at: string }[] };
  cancellation: { status: string; reason: string; note: string };
  cancelMode: "direct" | "request" | null;
  canRetryPayment: boolean;
  paymentWindowEndsAt: string | null;
  invoiceNumber: string | null;
  returns: { id: string; status: string; statusLabel: string; reason: string; refundAmount: number; createdAt: string; items: { productName: string; variantLabel: string; quantity: number }[] }[];
  refunds: { id: string; amount: number; status: string; createdAt: string }[];
  returnWindow: { eligible: boolean; reason: string | null; deadline: string | null };
  isGuest: boolean;
}

async function toView(order: OrderDoc, userId: string | null): Promise<CustomerOrderView> {
  const settings = await loadSettings();
  const [returns, refunds, shipment, reviewed] = await Promise.all([
    ReturnRequest.find({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
    Refund.find({ orderId: order._id, status: { $ne: "rejected" } }).sort({ createdAt: -1 }).lean(),
    Shipment.findOne({ orderId: order._id, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).lean(),
    userId ? Review.find({ userId: toObjectId(userId), productId: { $in: (order.items as OrderItemDoc[]).map((i) => i.productId) } }, { productId: 1 }).lean() : Promise.resolve([]),
  ]);
  const reviewedIds = new Set(reviewed.map((r) => r.productId.toHexString()));
  const direct = customerDirectCancelStatuses(settings.orders.customerCancelUntil);
  const cancelMode =
    order.status === "cancelled"
      ? null
      : direct.includes(order.status)
        ? "direct"
        : ["processing", "packed", "on_hold"].includes(order.status) && order.cancellation?.status !== "requested"
          ? "request"
          : null;
  const eligibility = await returnEligibility(order);
  const canRetryPayment =
    order.status === "pending_payment" &&
    order.paymentMethod === "razorpay" &&
    !!order.razorpayOrderId &&
    (!order.reservationExpiresAt || order.reservationExpiresAt > new Date());

  return {
    id: order._id.toHexString(),
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: order.paymentMethod === "cod" && order.paymentStatus === "pending" ? "Pay on delivery" : PAYMENT_STATUS_LABELS[order.paymentStatus],
    paymentMethod: order.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[order.paymentMethod],
    placedAt: order.placedAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    customer: order.customer,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    shippingMethod: order.shippingMethod,
    items: (order.items as OrderItemDoc[]).map((i) => ({
      id: i._id.toHexString(),
      productId: i.productId.toHexString(),
      productName: i.productName,
      productSlug: i.productSlug,
      variantLabel: i.variantLabel,
      sku: i.sku,
      image: i.image,
      quantity: i.quantity,
      unitMrp: i.unitMrp,
      unitPrice: i.unitPrice,
      lineSubtotal: i.lineSubtotal,
      discount: i.discount,
      lineTotal: i.lineTotal,
      returnedQuantity: i.returnedQuantity,
      reviewed: reviewedIds.has(i.productId.toHexString()),
    })),
    pricing: order.pricing,
    appliedPromotions: order.appliedPromotions.map((p) => ({ name: p.name, code: p.code, amount: p.amount, freeShipping: p.freeShipping })),
    timeline: order.statusHistory.map((e) => ({ status: e.status, label: ORDER_STATUS_LABELS[e.status], at: new Date(e.at).toISOString() })),
    shipment: {
      courierName: order.shipment?.courierName ?? null,
      trackingNumber: order.shipment?.trackingNumber ?? null,
      trackingUrl: order.shipment?.trackingUrl ?? null,
      shippedAt: order.shipment?.shippedAt?.toISOString() ?? null,
      events: (shipment?.events ?? [])
        .filter((e) => e.source !== "admin" || e.status)
        .map((e) => ({ status: e.status, description: e.description, location: e.location, at: new Date(e.at).toISOString() }))
        .reverse(),
    },
    cancellation: { status: order.cancellation?.status ?? "none", reason: order.cancellation?.reason ?? "", note: order.cancellation?.note ?? "" },
    cancelMode,
    canRetryPayment,
    paymentWindowEndsAt: order.reservationExpiresAt?.toISOString() ?? null,
    invoiceNumber: order.invoiceNumber,
    returns: returns.map((r) => ({
      id: r._id.toHexString(),
      status: r.status,
      statusLabel: RETURN_STATUS_LABELS[r.status],
      reason: r.reason,
      refundAmount: r.refundAmount,
      createdAt: r.createdAt.toISOString(),
      items: r.items.map((i) => ({ productName: i.productName, variantLabel: i.variantLabel, quantity: i.quantity })),
    })),
    refunds: refunds.map((r) => ({ id: r._id.toHexString(), amount: r.amount, status: r.status, createdAt: r.createdAt.toISOString() })),
    returnWindow: { eligible: eligibility.eligible, reason: eligibility.reason, deadline: eligibility.deadline?.toISOString() ?? null },
    isGuest: !order.userId,
  };
}

/**
 * Loads an order for its owner (signed-in user) or for a guest holding the
 * signed access token from their confirmation email.
 */
export async function getOrderForCustomer(orderNumber: string, access: { userId?: string | null; token?: string | null }): Promise<CustomerOrderView | null> {
  await connection();
  await connectDB();
  const order = await Order.findOne({ orderNumber: orderNumber.toUpperCase() }).lean();
  if (!order) return null;
  const ownerId = order.userId?.toHexString() ?? null;
  const allowed = (access.userId && ownerId === access.userId) || verifyOrderAccessToken(order._id.toHexString(), access.token);
  if (!allowed) return null;
  return toView(order, access.userId ?? ownerId);
}

export interface OrderListItem {
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatusLabel: string;
  grandTotal: number;
  itemCount: number;
  images: string[];
}

export async function listCustomerOrders(userId: string, page = 1, pageSize = 10): Promise<{ orders: OrderListItem[]; total: number }> {
  await connectDB();
  const filter = { userId: toObjectId(userId) };
  const [total, docs] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort({ placedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ]);
  return {
    total,
    orders: docs.map((o) => ({
      orderNumber: o.orderNumber,
      placedAt: o.placedAt.toISOString(),
      status: o.status,
      statusLabel: ORDER_STATUS_LABELS[o.status],
      paymentStatusLabel: o.paymentMethod === "cod" && o.paymentStatus === "pending" ? "Pay on delivery" : PAYMENT_STATUS_LABELS[o.paymentStatus],
      grandTotal: o.pricing.grandTotal,
      itemCount: (o.items as OrderItemDoc[]).reduce((s, i) => s + i.quantity, 0),
      images: (o.items as OrderItemDoc[]).map((i) => i.image).filter((x): x is string => !!x).slice(0, 3),
    })),
  };
}
