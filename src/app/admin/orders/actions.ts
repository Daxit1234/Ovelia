"use server";

import { z } from "zod";
import { authorize, type StaffUser } from "@/lib/auth/session";
import { connectDB, Order } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/domain/order-status";
import { formatINR, toPaise } from "@/lib/money";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import {
  addInternalNote,
  bookShipment,
  cancelOrder,
  clearAttention,
  ensureInvoiceNumber,
  refreshTracking,
  resolveCancellationRequest,
  updateOrderStatus,
  type OrderActor,
} from "@/lib/services/orders";
import { approveRefund, createRefund, rejectRefund } from "@/lib/services/refunds";

function actor(user: StaffUser): OrderActor {
  return { id: user.id, name: user.name, type: "admin", email: user.email };
}

function auditActor(user: StaffUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function loadOrder(orderId: string) {
  if (!isObjectId(orderId)) return null;
  await connectDB();
  return Order.findById(toObjectId(orderId), { orderNumber: 1, status: 1, pricing: 1, paymentMethod: 1 }).lean();
}

const shipmentSchema = z.object({
  courierName: z.string().trim().max(60),
  trackingNumber: z.string().trim().max(60),
  trackingUrl: z.union([z.literal(""), z.url().max(500)]),
});

const statusSchema = z.object({
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500),
  shipment: shipmentSchema.optional(),
  restock: z.boolean().optional(),
});

export async function updateOrderStatusAction(orderId: string, input: z.input<typeof statusSchema>): Promise<ActionResult<null>> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  try {
    const user = await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    if (parsed.data.to === "cancelled") return fail("Use the Cancel order action to cancel and refund.");
    if (parsed.data.to === "shipped" && !parsed.data.shipment?.courierName && !parsed.data.shipment?.trackingNumber) {
      const existing = await Order.findById(order._id, { "shipment.trackingNumber": 1 }).lean();
      if (!existing?.shipment?.trackingNumber) return fail("Add the courier name or tracking number before marking as shipped.");
    }
    const shipment = parsed.data.shipment
      ? {
          courierName: parsed.data.shipment.courierName || null,
          trackingNumber: parsed.data.shipment.trackingNumber || null,
          trackingUrl: parsed.data.shipment.trackingUrl || null,
        }
      : undefined;
    await updateOrderStatus(order._id, parsed.data.to, { actor: actor(user), note: parsed.data.note, shipment, restock: parsed.data.restock });
    await audit({
      actor: auditActor(user),
      action: "order.status",
      entityType: "order",
      entityId: order._id.toHexString(),
      summary: `${order.orderNumber}: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[parsed.data.to]}`,
      changes: { from: order.status, to: parsed.data.to, note: parsed.data.note, shipment },
    });
    return ok(null, `Order marked as ${ORDER_STATUS_LABELS[parsed.data.to].toLowerCase()}`);
  } catch (error) {
    return toActionError(error, "Could not update the order status.");
  }
}

export async function saveTrackingAction(orderId: string, input: z.input<typeof shipmentSchema>): Promise<ActionResult<null>> {
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid tracking details");
  try {
    const user = await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          "shipment.provider": "manual",
          "shipment.courierName": parsed.data.courierName || null,
          "shipment.trackingNumber": parsed.data.trackingNumber || null,
          "shipment.trackingUrl": parsed.data.trackingUrl || null,
        },
      },
    );
    await audit({
      actor: auditActor(user),
      action: "order.tracking",
      entityType: "order",
      entityId: order._id.toHexString(),
      summary: `${order.orderNumber}: tracking ${parsed.data.courierName} ${parsed.data.trackingNumber}`.trim(),
      changes: parsed.data,
    });
    return ok(null, "Tracking details saved");
  } catch (error) {
    return toActionError(error);
  }
}

const bookingSchema = z.object({
  weightGrams: z.number().int().min(50).max(50_000),
  lengthCm: z.number().min(1).max(200),
  breadthCm: z.number().min(1).max(200),
  heightCm: z.number().min(1).max(200),
});

export async function bookShipmentAction(orderId: string, input: z.input<typeof bookingSchema>): Promise<ActionResult<null>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return fail("Enter valid package weight and dimensions.");
  try {
    const user = await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    const result = await bookShipment(order._id, parsed.data, actor(user));
    await audit({
      actor: auditActor(user),
      action: "order.ship_book",
      entityType: "order",
      entityId: order._id.toHexString(),
      summary: `${order.orderNumber}: courier booking ${result.status}`,
      changes: { ...parsed.data, message: result.message },
    });
    return result.status === "booked" ? ok(null, result.message) : { ok: false, error: result.message };
  } catch (error) {
    return toActionError(error, "Could not book the shipment.");
  }
}

export async function refreshTrackingAction(orderId: string): Promise<ActionResult<null>> {
  try {
    await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    return ok(null, await refreshTracking(order._id));
  } catch (error) {
    return toActionError(error, "Could not refresh tracking.");
  }
}

export async function cancelOrderAdminAction(orderId: string, input: { reason: string; refund: boolean }): Promise<ActionResult<null>> {
  const reason = z.string().trim().min(3, "Enter a reason").max(300).safeParse(input.reason);
  if (!reason.success) return fail(reason.error.issues[0].message);
  try {
    const user = await authorize("orders:update");
    if (input.refund) await authorize("orders:refund");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    await cancelOrder(order._id, { actor: actor(user), reason: reason.data, refundMode: input.refund ? "auto" : "approval" });
    await audit({
      actor: auditActor(user),
      action: "order.cancel",
      entityType: "order",
      entityId: order._id.toHexString(),
      summary: `${order.orderNumber} cancelled: ${reason.data}`,
      changes: { refund: input.refund },
    });
    return ok(null, "Order cancelled");
  } catch (error) {
    return toActionError(error, "Could not cancel the order.");
  }
}

export async function resolveCancellationAction(orderId: string, approve: boolean, note: string): Promise<ActionResult<null>> {
  try {
    const user = await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    await resolveCancellationRequest(order._id, approve, note.trim().slice(0, 300), actor(user));
    await audit({
      actor: auditActor(user),
      action: approve ? "order.cancel_request_approved" : "order.cancel_request_rejected",
      entityType: "order",
      entityId: order._id.toHexString(),
      summary: `${order.orderNumber}: cancellation request ${approve ? "approved" : "rejected"}`,
      changes: { note },
    });
    return ok(null, approve ? "Order cancelled" : "Request declined");
  } catch (error) {
    return toActionError(error);
  }
}

const refundSchema = z.object({
  amount: z.number().positive("Enter a refund amount").max(10_000_000),
  reason: z.string().trim().min(3, "Enter a reason").max(300),
  processNow: z.boolean(),
});

export async function createRefundAction(orderId: string, input: z.input<typeof refundSchema>): Promise<ActionResult<null>> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid refund");
  try {
    const user = await authorize("orders:refund");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    const amount = toPaise(parsed.data.amount);
    const refund = await createRefund({
      order,
      amount,
      reason: parsed.data.reason,
      source: "admin",
      requestedBy: { id: user.id, name: user.name, type: "admin" },
    });
    if (parsed.data.processNow) await approveRefund(refund._id.toHexString(), { id: user.id, name: user.name, type: "admin" });
    await audit({
      actor: auditActor(user),
      action: "refund.create",
      entityType: "order",
      entityId: order._id.toHexString(),
      summary: `${order.orderNumber}: refund ${formatINR(amount)} (${parsed.data.processNow ? "processed" : "pending approval"})`,
      changes: { amount, reason: parsed.data.reason },
    });
    return ok(null, parsed.data.processNow ? "Refund initiated" : "Refund created and awaiting approval");
  } catch (error) {
    return toActionError(error, "Could not create the refund.");
  }
}

export async function approveRefundAction(refundId: string, manualReference = ""): Promise<ActionResult<null>> {
  if (!isObjectId(refundId)) return fail("Refund not found");
  try {
    const user = await authorize("orders:refund");
    const refund = await approveRefund(refundId, { id: user.id, name: user.name, type: "admin" }, { manualReference: manualReference.trim().slice(0, 80) || undefined });
    await audit({
      actor: auditActor(user),
      action: "refund.approve",
      entityType: "refund",
      entityId: refundId,
      summary: `Refund ${formatINR(refund.amount)} for ${refund.orderNumber} approved (${refund.status})`,
    });
    return ok(null, refund.status === "processed" ? "Refund processed" : "Refund initiated with Razorpay");
  } catch (error) {
    return toActionError(error, "Could not process the refund.");
  }
}

export async function rejectRefundAction(refundId: string, note: string): Promise<ActionResult<null>> {
  if (!isObjectId(refundId)) return fail("Refund not found");
  try {
    const user = await authorize("orders:refund");
    await rejectRefund(refundId, { id: user.id, name: user.name, type: "admin" }, note.trim().slice(0, 300) || "Rejected");
    await audit({ actor: auditActor(user), action: "refund.reject", entityType: "refund", entityId: refundId, summary: `Refund rejected: ${note}` });
    return ok(null, "Refund rejected");
  } catch (error) {
    return toActionError(error);
  }
}

export async function addOrderNoteAction(orderId: string, note: string): Promise<ActionResult<null>> {
  const text = note.trim();
  if (text.length < 2 || text.length > 1000) return fail("Enter a note (up to 1000 characters).");
  try {
    const user = await authorize("orders:read");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    await addInternalNote(order._id, text, actor(user));
    return ok(null, "Note added");
  } catch (error) {
    return toActionError(error);
  }
}

export async function generateInvoiceAction(orderId: string): Promise<ActionResult<null>> {
  try {
    const user = await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    const number = await ensureInvoiceNumber(order._id);
    await audit({ actor: auditActor(user), action: "order.invoice", entityType: "order", entityId: order._id.toHexString(), summary: `${order.orderNumber}: invoice ${number}` });
    return ok(null, `Invoice ${number} issued`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearAttentionAction(orderId: string): Promise<ActionResult<null>> {
  try {
    const user = await authorize("orders:update");
    const order = await loadOrder(orderId);
    if (!order) return fail("Order not found");
    await clearAttention(order._id);
    await audit({ actor: auditActor(user), action: "order.attention_cleared", entityType: "order", entityId: order._id.toHexString(), summary: `${order.orderNumber}: attention flag cleared` });
    return ok(null, "Marked as reviewed");
  } catch (error) {
    return toActionError(error);
  }
}
