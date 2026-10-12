import { createHash } from "node:crypto";
import { connectDB, WebhookEvent } from "@/lib/db";
import { confirmOnlinePayment, markPaymentFailed } from "@/lib/services/orders";
import { applyRefundWebhook } from "@/lib/services/refunds";
import { verifyWebhookSignature, type RazorpayPaymentInfo } from "@/lib/services/payments/razorpay";

interface RazorpayPaymentEntity {
  id: string;
  order_id: string | null;
  status: RazorpayPaymentInfo["status"];
  amount: number;
  currency: string;
  method?: string | null;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    order?: { entity: { id: string; status: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; status?: string; notes?: Record<string, string> | unknown[] } };
  };
}

/**
 * Razorpay webhook endpoint. Configure in the Razorpay dashboard with the
 * events payment.captured, payment.authorized, payment.failed, order.paid,
 * refund.processed and refund.failed, using RAZORPAY_WEBHOOK_SECRET.
 *
 * Every event is verified with HMAC-SHA256 over the raw body and processed
 * idempotently using the x-razorpay-event-id header.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"))) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? createHash("sha256").update(rawBody).digest("hex");
  await connectDB();

  // Idempotency: claim the event; replays of processed events are acknowledged.
  const existing = await WebhookEvent.findOneAndUpdate(
    { provider: "razorpay", eventId },
    { $setOnInsert: { provider: "razorpay", eventId, eventType: body.event, status: "processing" } },
    { upsert: true, returnDocument: "before" },
  ).lean();
  if (existing && (existing.status === "processed" || existing.status === "ignored")) {
    return Response.json({ ok: true, duplicate: true });
  }
  if (existing) await WebhookEvent.updateOne({ _id: existing._id }, { $inc: { attempts: 1 }, $set: { status: "processing" } });

  try {
    let summary = "ignored";
    const payment = body.payload.payment?.entity;
    switch (body.event) {
      case "payment.captured":
      case "payment.authorized": {
        if (payment?.order_id) {
          const result = await confirmOnlinePayment({ razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id, source: "webhook" });
          summary = `payment ${payment.id}: ${result.outcome}`;
        }
        break;
      }
      case "order.paid": {
        const orderId = body.payload.order?.entity.id ?? payment?.order_id;
        if (orderId && payment) {
          const result = await confirmOnlinePayment({ razorpayOrderId: orderId, razorpayPaymentId: payment.id, source: "webhook" });
          summary = `order ${orderId}: ${result.outcome}`;
        }
        break;
      }
      case "payment.failed": {
        if (payment?.order_id) {
          await markPaymentFailed({
            razorpayOrderId: payment.order_id,
            source: "webhook",
            payment: {
              id: payment.id,
              orderId: payment.order_id,
              status: "failed",
              amount: Number(payment.amount),
              currency: payment.currency,
              method: payment.method ?? null,
              captured: false,
              errorCode: payment.error_code ?? null,
              errorDescription: payment.error_description ?? null,
            },
          });
          summary = `payment ${payment.id}: failed`;
        }
        break;
      }
      case "refund.processed":
      case "refund.failed":
      case "refund.created": {
        const refund = body.payload.refund?.entity;
        if (refund) summary = await applyRefundWebhook(refund, body.event);
        break;
      }
    }
    await WebhookEvent.updateOne(
      { provider: "razorpay", eventId },
      { $set: { status: summary === "ignored" ? "ignored" : "processed", summary, processedAt: new Date(), error: null } },
    );
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Razorpay webhook failed", body.event, message);
    await WebhookEvent.updateOne({ provider: "razorpay", eventId }, { $set: { status: "failed", error: message.slice(0, 500) } });
    // Non-2xx makes Razorpay retry later.
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}

/** Lets operators confirm the endpoint is reachable (no data is exposed). */
export function GET() {
  return Response.json({ ok: true });
}
