import "server-only";
import type { Types } from "mongoose";
import { connectDB, Order, ReturnRequest, type OrderItemDoc, type ReturnStatus } from "@/lib/db";
import { ObjectId } from "@/lib/db/model";
import { invalidateProducts } from "@/lib/cache-tags";
import { siteUrl } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { AppError, NotFoundError } from "@/lib/result";
import { runAfter } from "@/lib/services/background";
import { restockLines } from "@/lib/services/inventory";
import { notifyAdmins, notifyReturnUpdate } from "@/lib/services/notifications/order-notifications";
import { templates } from "@/lib/services/notifications/templates";
import type { OrderActor } from "@/lib/services/orders";
import { approveRefund, createRefund } from "@/lib/services/refunds";
import { loadSettings } from "@/lib/services/settings";
import { RETURN_STATUS_LABELS } from "@/lib/domain/returns";

export { RETURN_REASONS, RETURN_STATUS_LABELS } from "@/lib/domain/returns";

const OPEN_STATUSES: ReturnStatus[] = ["requested", "approved", "received"];

export async function returnEligibility(order: { status: string; deliveredAt: Date | null }): Promise<{ eligible: boolean; reason: string | null; deadline: Date | null }> {
  const settings = await loadSettings();
  if (!settings.orders.returnsEnabled) return { eligible: false, reason: "Returns are not available at the moment.", deadline: null };
  if (order.status !== "delivered" || !order.deliveredAt) {
    return { eligible: false, reason: "Returns can be requested after your order is delivered.", deadline: null };
  }
  const deadline = new Date(order.deliveredAt.getTime() + settings.orders.returnWindowDays * 24 * 60 * 60 * 1000);
  if (deadline < new Date()) {
    return { eligible: false, reason: `The ${settings.orders.returnWindowDays}-day return window for this order has closed.`, deadline };
  }
  return { eligible: true, reason: null, deadline };
}

export async function createReturnRequest(input: {
  orderId: Types.ObjectId;
  userId: string | null;
  items: { orderItemId: string; quantity: number }[];
  reason: string;
  details: string;
  resolution: "refund" | "replacement";
}) {
  await connectDB();
  const order = await Order.findById(input.orderId).lean();
  if (!order) throw new NotFoundError("Order not found");
  const eligibility = await returnEligibility(order);
  if (!eligibility.eligible) throw new AppError(eligibility.reason!);
  if (input.items.length === 0) throw new AppError("Select at least one item to return.");

  const open = await ReturnRequest.find({ orderId: order._id, status: { $in: OPEN_STATUSES } }).lean();
  const alreadyRequested = new Map<string, number>();
  for (const req of open) {
    for (const item of req.items) {
      const key = item.orderItemId.toHexString();
      alreadyRequested.set(key, (alreadyRequested.get(key) ?? 0) + item.quantity);
    }
  }

  const items = input.items.map((requested) => {
    const item = (order.items as OrderItemDoc[]).find((i) => i._id.toHexString() === requested.orderItemId);
    if (!item) throw new AppError("One of the selected items is not part of this order.");
    const remaining = item.quantity - item.returnedQuantity - (alreadyRequested.get(requested.orderItemId) ?? 0);
    if (!Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > remaining) {
      throw new AppError(`You can return up to ${Math.max(0, remaining)} of ${item.productName} (${item.variantLabel}).`);
    }
    return {
      orderItemId: item._id,
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      quantity: requested.quantity,
      unitRefund: Math.floor(item.lineTotal / item.quantity),
    };
  });

  const refundAmount = items.reduce((sum, i) => sum + i.unitRefund * i.quantity, 0);
  const request = await ReturnRequest.create({
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: input.userId ? new ObjectId(input.userId) : null,
    items,
    reason: input.reason,
    details: input.details,
    resolution: input.resolution,
    status: "requested",
    refundAmount,
    history: [{ status: "requested", note: input.reason, at: new Date(), by: "Customer" }],
  });

  runAfter(() =>
    notifyAdmins(
      templates.adminAlert(
        `Return requested: ${order.orderNumber}`,
        `${items.length} item(s), ${formatINR(refundAmount)} — ${input.reason}`,
        siteUrl(`/admin/returns`),
      ),
      "admin_return_request",
      `admin-return:${request._id.toHexString()}`,
    ),
  );
  runAfter(() => notifyReturnUpdate(order, request._id.toHexString(), "Requested", "We have received your return request and will review it shortly."));
  return request.toObject();
}

export type ReturnAction = "approve" | "reject" | "receive" | "refund" | "close";

const ALLOWED: Record<ReturnAction, ReturnStatus[]> = {
  approve: ["requested"],
  reject: ["requested", "approved"],
  receive: ["approved"],
  refund: ["approved", "received"],
  close: ["requested", "approved", "received", "refunded"],
};

const NEXT: Record<ReturnAction, ReturnStatus> = {
  approve: "approved",
  reject: "rejected",
  receive: "received",
  refund: "refunded",
  close: "closed",
};

export async function updateReturnRequest(
  returnId: string,
  action: ReturnAction,
  opts: { note: string; restock?: boolean; refundAmount?: number },
  actor: OrderActor,
) {
  await connectDB();
  const request = await ReturnRequest.findById(returnId).lean();
  if (!request) throw new NotFoundError("Return request not found");
  if (!ALLOWED[action].includes(request.status)) {
    throw new AppError(`A ${RETURN_STATUS_LABELS[request.status].toLowerCase()} return cannot be ${action === "refund" ? "refunded" : `${action}d`}.`);
  }
  const order = await Order.findById(request.orderId).lean();
  if (!order) throw new NotFoundError("Order not found");

  if (action === "receive") {
    const restock = opts.restock !== false;
    for (const item of request.items) {
      await Order.updateOne({ _id: order._id, "items._id": item.orderItemId }, { $inc: { "items.$.returnedQuantity": item.quantity } });
    }
    if (restock) {
      const lines = request.items.map((ri) => {
        const orderItem = (order.items as OrderItemDoc[]).find((i) => i._id.equals(ri.orderItemId))!;
        return { productId: orderItem.productId.toHexString(), variantId: orderItem.variantId.toHexString(), quantity: ri.quantity };
      });
      await restockLines(lines, "return", { orderId: order._id, orderNumber: order.orderNumber, reason: `Return ${request._id.toHexString()} received`, actor: { id: actor.id, name: actor.name, type: "admin" } }, null);
      invalidateProducts(lines.map((l) => l.productId));
    }
    const refreshed = await Order.findById(order._id).lean();
    const fullyReturned = (refreshed!.items as OrderItemDoc[]).every((i) => i.returnedQuantity >= i.quantity);
    if (fullyReturned && refreshed!.status === "delivered") {
      await Order.updateOne(
        { _id: order._id, status: "delivered" },
        { $set: { status: "returned" }, $push: { statusHistory: { status: "returned", note: "All items returned", at: new Date(), by: { id: actor.id, name: actor.name, type: actor.type } } } },
      );
    }
    await ReturnRequest.updateOne({ _id: request._id }, { $set: { restock } });
  }

  if (action === "refund") {
    const amount = opts.refundAmount ?? request.refundAmount;
    if (order.pricing.amountPaid <= 0) {
      throw new AppError("This order has no recorded payment to refund. For Cash on Delivery orders, mark the order as delivered first.");
    }
    const refund = await createRefund({
      order,
      amount,
      reason: `Return: ${request.reason}`,
      source: "return",
      requestedBy: { id: actor.id, name: actor.name, type: "admin" },
      returnRequestId: request._id,
    });
    await approveRefund(refund._id.toHexString(), { id: actor.id, name: actor.name, type: "admin" });
    await ReturnRequest.updateOne({ _id: request._id }, { $set: { refundAmount: amount } });
  }

  const next = NEXT[action];
  await ReturnRequest.updateOne(
    { _id: request._id, status: request.status },
    { $set: { status: next, adminNote: opts.note || request.adminNote }, $push: { history: { status: next, note: opts.note, at: new Date(), by: actor.name } } },
  );
  runAfter(() => notifyReturnUpdate(order, request._id.toHexString(), RETURN_STATUS_LABELS[next], opts.note));
}
