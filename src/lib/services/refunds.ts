import "server-only";
import type { Types } from "mongoose";
import { connectDB, Order, Payment, Refund, type OrderDoc, type RefundDoc } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { AppError, NotFoundError } from "@/lib/result";
import { runAfter } from "@/lib/services/background";
import { notifyAdmins, notifyRefund } from "@/lib/services/notifications/order-notifications";
import { templates } from "@/lib/services/notifications/templates";
import { createRazorpayRefund, describeRazorpayError } from "@/lib/services/payments/razorpay";
import { integrations, siteUrl } from "@/lib/env";

export interface RefundActor {
  id: string | null;
  name: string;
  type: "admin" | "customer" | "system";
}

const OPEN_REFUND_STATUSES = ["pending_approval", "processing", "processed", "manual"] as const;

/** Amount still refundable on an order, accounting for refunds in flight. */
export async function refundableAmount(order: Pick<OrderDoc, "_id" | "pricing">): Promise<number> {
  const [agg] = await Refund.aggregate<{ total: number }>([
    { $match: { orderId: order._id, status: { $in: [...OPEN_REFUND_STATUSES] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return Math.max(0, order.pricing.amountPaid - (agg?.total ?? 0));
}

export async function createRefund(input: {
  order: Pick<OrderDoc, "_id" | "orderNumber" | "pricing" | "paymentMethod">;
  amount: number;
  reason: string;
  source: "cancellation" | "return" | "admin";
  requestedBy: RefundActor;
  returnRequestId?: Types.ObjectId | null;
}): Promise<RefundDoc> {
  await connectDB();
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new AppError("Refund amount must be greater than zero.");
  const available = await refundableAmount(input.order);
  if (input.amount > available) {
    throw new AppError(`Refund exceeds the refundable amount of ${formatINR(available)}.`, "REFUND_LIMIT");
  }
  const payment = await Payment.findOne({
    orderId: input.order._id,
    provider: "razorpay",
    status: { $in: ["captured", "partially_refunded"] },
  }).lean();
  const refund = await Refund.create({
    orderId: input.order._id,
    orderNumber: input.order.orderNumber,
    paymentId: payment?._id ?? null,
    razorpayPaymentId: payment?.razorpayPaymentId ?? null,
    amount: input.amount,
    status: "pending_approval",
    reason: input.reason,
    source: input.source,
    returnRequestId: input.returnRequestId ?? null,
    requestedBy: input.requestedBy,
  });
  runAfter(() =>
    notifyAdmins(
      templates.adminAlert(
        `Refund awaiting approval: ${input.order.orderNumber}`,
        `${formatINR(input.amount)} — ${input.reason}`,
        siteUrl(`/admin/orders/${input.order._id.toHexString()}`),
      ),
      "admin_refund_pending",
      `admin-refund-pending:${refund._id.toHexString()}`,
    ),
  );
  return refund.toObject();
}

async function applyRefundToOrder(refund: Pick<RefundDoc, "_id" | "orderId" | "paymentId" | "amount">, direction: 1 | -1) {
  const claim = await Refund.updateOne(
    { _id: refund._id, appliedToOrder: direction === 1 ? false : true },
    { $set: { appliedToOrder: direction === 1 } },
  );
  if (claim.modifiedCount === 0) return;
  const order = await Order.findOneAndUpdate(
    { _id: refund.orderId },
    { $inc: { "pricing.amountRefunded": direction * refund.amount } },
    { returnDocument: "after" },
  ).lean();
  if (!order) return;
  const refunded = order.pricing.amountRefunded;
  const paymentStatus = refunded <= 0 ? "paid" : refunded >= order.pricing.amountPaid ? "refunded" : "partially_refunded";
  if (order.pricing.amountPaid > 0) await Order.updateOne({ _id: order._id }, { $set: { paymentStatus } });
  if (refund.paymentId) {
    const payment = await Payment.findOneAndUpdate(
      { _id: refund.paymentId },
      { $inc: { amountRefunded: direction * refund.amount } },
      { returnDocument: "after" },
    ).lean();
    if (payment) {
      const status = payment.amountRefunded <= 0 ? "captured" : payment.amountRefunded >= payment.amount ? "refunded" : "partially_refunded";
      await Payment.updateOne({ _id: payment._id }, { $set: { status } });
    }
  }
}

/**
 * Approves a refund and executes it. Online payments are refunded through
 * Razorpay; Cash on Delivery refunds are paid out manually by the store and
 * recorded here once completed.
 */
export async function approveRefund(refundId: string, approver: RefundActor, options: { manualReference?: string } = {}): Promise<RefundDoc> {
  await connectDB();
  const pending = await Refund.findOne({ _id: refundId, status: { $in: ["pending_approval", "failed"] } }, { orderId: 1, amount: 1, status: 1 }).lean();
  if (!pending) throw new AppError("This refund has already been processed or is not awaiting approval.");
  // Re-check the limit: other refunds may have completed since this one was
  // requested (for example while a failed refund waited to be retried).
  const [paid, others] = await Promise.all([
    Order.findById(pending.orderId, { "pricing.amountPaid": 1 }).lean(),
    Refund.aggregate<{ total: number }>([
      { $match: { orderId: pending.orderId, _id: { $ne: pending._id }, status: { $in: [...OPEN_REFUND_STATUSES] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const available = Math.max(0, (paid?.pricing?.amountPaid ?? 0) - (others[0]?.total ?? 0));
  if (pending.amount > available) {
    throw new AppError(`This refund of ${formatINR(pending.amount)} is more than the ${formatINR(available)} still refundable on the order.`, "REFUND_LIMIT");
  }
  const refund = await Refund.findOneAndUpdate(
    { _id: pending._id, status: pending.status },
    { $set: { status: "processing", approvedBy: { id: approver.id, name: approver.name }, failureReason: "" } },
    { returnDocument: "after" },
  ).lean();
  if (!refund) throw new AppError("This refund has already been processed or is not awaiting approval.");
  const order = await Order.findById(refund.orderId).lean();
  if (!order) throw new NotFoundError("Order not found");

  if (order.paymentMethod === "cod" || !refund.razorpayPaymentId) {
    const updated = await Refund.findOneAndUpdate(
      { _id: refund._id },
      {
        $set: {
          status: "processed",
          processedAt: new Date(),
          failureReason: "",
          reason: options.manualReference ? `${refund.reason} (ref: ${options.manualReference})` : refund.reason,
        },
      },
      { returnDocument: "after" },
    ).lean();
    await applyRefundToOrder(refund, 1);
    runAfter(() => notifyRefund(order, refund, "processed"));
    return updated!;
  }

  if (!integrations.razorpay()) {
    await Refund.updateOne({ _id: refund._id }, { $set: { status: "failed", failureReason: "Razorpay is not configured" } });
    throw new AppError("Online refunds need Razorpay to be configured.");
  }

  try {
    const result = await createRazorpayRefund(refund.razorpayPaymentId, {
      amount: refund.amount,
      receipt: `rf_${refund._id.toHexString()}`,
      notes: { orderNumber: order.orderNumber, refundId: refund._id.toHexString() },
    });
    const processed = result.status === "processed";
    const updated = await Refund.findOneAndUpdate(
      { _id: refund._id },
      { $set: { razorpayRefundId: result.id, status: processed ? "processed" : "processing", processedAt: processed ? new Date() : null } },
      { returnDocument: "after" },
    ).lean();
    await applyRefundToOrder(refund, 1);
    runAfter(() => notifyRefund(order, refund, processed ? "processed" : "initiated"));
    return updated!;
  } catch (error) {
    const message = describeRazorpayError(error);
    await Refund.updateOne({ _id: refund._id }, { $set: { status: "failed", failureReason: message } });
    throw new AppError(`Razorpay could not process the refund: ${message}`);
  }
}

export async function rejectRefund(refundId: string, actor: RefundActor, note: string): Promise<void> {
  await connectDB();
  const res = await Refund.updateOne(
    { _id: refundId, status: { $in: ["pending_approval", "failed"] } },
    { $set: { status: "rejected", failureReason: note, approvedBy: { id: actor.id, name: actor.name } } },
  );
  if (res.modifiedCount === 0) throw new AppError("Only pending or failed refunds can be rejected.");
}

interface RazorpayRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  status?: string;
  notes?: Record<string, string> | unknown[];
}

/** Reconciles refund state from Razorpay webhooks (including dashboard refunds). */
export async function applyRefundWebhook(entity: RazorpayRefundEntity, event: string): Promise<string> {
  await connectDB();
  let refund = await Refund.findOne({ razorpayRefundId: entity.id }).lean();

  if (!refund) {
    const notes = (!Array.isArray(entity.notes) ? entity.notes : undefined) as Record<string, string> | undefined;
    if (notes?.refundId) {
      refund = await Refund.findOneAndUpdate({ _id: notes.refundId }, { $set: { razorpayRefundId: entity.id } }, { returnDocument: "after" }).lean();
    }
  }

  if (!refund) {
    // Refund created outside Ovelia (e.g. Razorpay dashboard): record it.
    const payment = await Payment.findOne({ razorpayPaymentId: entity.payment_id }).lean();
    if (!payment) return "ignored: unknown payment";
    const created = await Refund.create({
      orderId: payment.orderId,
      orderNumber: payment.orderNumber,
      paymentId: payment._id,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayRefundId: entity.id,
      amount: Number(entity.amount),
      status: "processing",
      reason: "Refund issued from the Razorpay dashboard",
      source: "admin",
      requestedBy: { id: null, name: "Razorpay", type: "system" },
    });
    refund = created.toObject();
    if (event !== "refund.failed") await applyRefundToOrder(refund, 1);
  }

  const order = await Order.findById(refund.orderId).lean();
  if (event === "refund.processed") {
    const res = await Refund.updateOne({ _id: refund._id, status: { $ne: "processed" } }, { $set: { status: "processed", processedAt: new Date() } });
    await applyRefundToOrder(refund, 1);
    if (res.modifiedCount && order) runAfter(() => notifyRefund(order, refund!, "processed"));
    return "refund processed";
  }
  if (event === "refund.failed") {
    await Refund.updateOne({ _id: refund._id }, { $set: { status: "failed", failureReason: "Refund failed at Razorpay" } });
    await applyRefundToOrder(refund, -1);
    if (order) {
      runAfter(() => notifyRefund(order, refund!, "failed"));
      runAfter(() =>
        notifyAdmins(
          templates.adminAlert(`Refund failed for ${order.orderNumber}`, `${formatINR(refund!.amount)} could not be refunded. Retry from the order page.`, siteUrl(`/admin/orders/${order._id.toHexString()}`)),
          "admin_refund_failed",
          `admin-refund-failed:${refund!._id.toHexString()}`,
        ),
      );
    }
    return "refund failed";
  }
  return "refund noted";
}
