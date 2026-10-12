import "server-only";
import type { QueryFilter } from "mongoose";
import {
  connectDB,
  Order,
  Payment,
  Refund,
  ReturnRequest,
  Shipment,
  type OrderDoc,
} from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/domain/order-status";
import { escapeRegex } from "@/lib/format";
import { oneOf, pageParam, param, parseDay, type SearchParams } from "@/lib/admin/list";

export const ORDER_SORTS = { newest: "Newest first", oldest: "Oldest first", total_desc: "Highest value", total_asc: "Lowest value" } as const;
export type OrderSort = keyof typeof ORDER_SORTS;

export interface OrderFilters {
  q: string;
  status: OrderStatus | "";
  payment: PaymentStatus | "";
  method: "razorpay" | "cod" | "";
  from: string;
  to: string;
  attention: boolean;
  sort: OrderSort;
  page: number;
}

export function parseOrderFilters(params: SearchParams): OrderFilters {
  return {
    q: param(params, "q").slice(0, 80),
    status: oneOf(param(params, "status"), ["", ...ORDER_STATUSES] as const, ""),
    payment: oneOf(param(params, "payment"), ["", ...PAYMENT_STATUSES] as const, ""),
    method: oneOf(param(params, "method"), ["", "razorpay", "cod"] as const, ""),
    from: param(params, "from"),
    to: param(params, "to"),
    attention: param(params, "attention") === "1",
    sort: oneOf(param(params, "sort"), Object.keys(ORDER_SORTS) as OrderSort[], "newest"),
    page: pageParam(params),
  };
}

export function orderQuery(filters: OrderFilters): QueryFilter<OrderDoc> {
  const query: QueryFilter<OrderDoc> = {};
  if (filters.status) query.status = filters.status;
  if (filters.payment) query.paymentStatus = filters.payment;
  if (filters.method) query.paymentMethod = filters.method;
  if (filters.attention) query.needsAttention = true;
  const from = parseDay(filters.from);
  const to = parseDay(filters.to, true);
  if (from || to) query.placedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    const digits = filters.q.replace(/\D/g, "");
    query.$or = [
      { orderNumber: rx },
      { "customer.email": rx },
      { "customer.name": rx },
      ...(digits.length >= 4 ? [{ "customer.phone": new RegExp(escapeRegex(digits.slice(-10))) }] : []),
      { "shipment.trackingNumber": rx },
      { invoiceNumber: rx },
    ];
  }
  return query;
}

function sortSpec(sort: OrderSort): Record<string, 1 | -1> {
  switch (sort) {
    case "oldest":
      return { placedAt: 1 };
    case "total_desc":
      return { "pricing.grandTotal": -1, placedAt: -1 };
    case "total_asc":
      return { "pricing.grandTotal": 1, placedAt: -1 };
    default:
      return { placedAt: -1 };
  }
}

export const ORDERS_PAGE_SIZE = 25;

export async function listOrders(filters: OrderFilters) {
  await connectDB();
  const query = orderQuery(filters);
  const [total, rows] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query, {
      orderNumber: 1,
      customer: 1,
      placedAt: 1,
      status: 1,
      paymentStatus: 1,
      paymentMethod: 1,
      pricing: 1,
      items: 1,
      needsAttention: 1,
      cancellation: 1,
      shippingAddress: 1,
    })
      .sort(sortSpec(filters.sort))
      .skip((filters.page - 1) * ORDERS_PAGE_SIZE)
      .limit(ORDERS_PAGE_SIZE)
      .lean(),
  ]);
  return { total, rows, pageCount: Math.ceil(total / ORDERS_PAGE_SIZE) };
}

export async function getAdminOrder(id: string) {
  if (!isObjectId(id)) return null;
  await connectDB();
  const order = await Order.findById(toObjectId(id)).lean();
  if (!order) return null;
  const [payments, refunds, shipments, returns, customerOrders] = await Promise.all([
    Payment.find({ orderId: order._id }).sort({ createdAt: 1 }).lean(),
    Refund.find({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
    Shipment.find({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
    ReturnRequest.find({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
    Order.countDocuments(order.userId ? { userId: order.userId } : { "customer.email": order.customer.email }),
  ]);
  return { order, payments, refunds, shipments, returns, customerOrders };
}

export async function ordersForExport(filters: OrderFilters, limit = 5000) {
  await connectDB();
  return Order.find(orderQuery(filters)).sort(sortSpec(filters.sort)).limit(limit).lean();
}
