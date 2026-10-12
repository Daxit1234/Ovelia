import "server-only";
import type { QueryFilter } from "mongoose";
import { connectDB, Order, Refund, ReturnRequest, RETURN_STATUSES, type ReturnRequestDoc, type ReturnStatus } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { escapeRegex } from "@/lib/format";
import { oneOf, pageParam, param, type SearchParams } from "@/lib/admin/list";
import { refundableAmount } from "@/lib/services/refunds";

export const OPEN_RETURN_STATUSES: ReturnStatus[] = ["requested", "approved", "received"];
export const RETURNS_PAGE_SIZE = 25;

export interface ReturnFilters {
  q: string;
  status: "open" | "all" | ReturnStatus;
  page: number;
}

export function parseReturnFilters(params: SearchParams): ReturnFilters {
  return {
    q: param(params, "q").slice(0, 60),
    status: oneOf(param(params, "status"), ["open", "all", ...RETURN_STATUSES] as const, "open"),
    page: pageParam(params),
  };
}

export async function listReturns(filters: ReturnFilters) {
  await connectDB();
  const query: QueryFilter<ReturnRequestDoc> = {};
  if (filters.status === "open") query.status = { $in: OPEN_RETURN_STATUSES };
  else if (filters.status !== "all") query.status = filters.status;
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ orderNumber: rx }, { "items.sku": rx }, { "items.productName": rx }];
  }
  const [rows, total] = await Promise.all([
    ReturnRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * RETURNS_PAGE_SIZE)
      .limit(RETURNS_PAGE_SIZE)
      .lean(),
    ReturnRequest.countDocuments(query),
  ]);
  const orders = await Order.find({ _id: { $in: rows.map((r) => r.orderId) } }, { customer: 1, paymentMethod: 1 }).lean();
  const byId = new Map(orders.map((o) => [o._id.toHexString(), o]));
  return {
    rows: rows.map((r) => ({ ...r, order: byId.get(r.orderId.toHexString()) ?? null })),
    total,
    pageCount: Math.ceil(total / RETURNS_PAGE_SIZE),
  };
}

export async function getAdminReturn(id: string) {
  if (!isObjectId(id)) return null;
  await connectDB();
  const request = await ReturnRequest.findById(toObjectId(id)).lean();
  if (!request) return null;
  const [order, refunds] = await Promise.all([
    Order.findById(request.orderId, { orderNumber: 1, customer: 1, status: 1, paymentMethod: 1, paymentStatus: 1, pricing: 1, deliveredAt: 1, placedAt: 1 }).lean(),
    Refund.find({ returnRequestId: request._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const refundable = order ? await refundableAmount(order) : 0;
  return { request, order, refunds, refundable };
}
