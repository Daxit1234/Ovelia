import { createHash, timingSafeEqual } from "node:crypto";
import { connectDB, WebhookEvent } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { applyCarrierUpdate } from "@/lib/services/orders";

interface ShiprocketWebhook {
  awb?: string | number;
  current_status?: string;
  shipment_status?: string;
  order_id?: string;
  sr_order_id?: string | number;
  current_timestamp?: string;
  etd?: string;
  scans?: { date?: string; activity?: string; location?: string; "sr-status-label"?: string; status?: string }[];
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function parseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const normalized = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? `${value.replace(" ", "T")}+05:30` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Courier tracking webhook (Shiprocket format). Configure the URL
 * <site>/api/webhooks/shipping in Shiprocket with the same token as
 * SHIPROCKET_WEBHOOK_TOKEN; Shiprocket sends it in the x-api-key header.
 * (Shiprocket rejects webhook URLs containing the words "shiprocket" or "sr",
 * hence the generic path.)
 */
export async function POST(request: Request) {
  const expected = getEnv().SHIPROCKET_WEBHOOK_TOKEN;
  const provided = request.headers.get("x-api-key") ?? "";
  if (!expected || !safeEqual(expected, provided)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();
  let body: ShiprocketWebhook;
  try {
    body = JSON.parse(rawBody) as ShiprocketWebhook;
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = body.current_status ?? body.shipment_status ?? "";
  const eventId = createHash("sha256").update(`${body.awb ?? ""}|${status}|${body.current_timestamp ?? ""}|${(body.scans ?? []).length}`).digest("hex");
  await connectDB();
  const existing = await WebhookEvent.findOneAndUpdate(
    { provider: "shiprocket", eventId },
    { $setOnInsert: { provider: "shiprocket", eventId, eventType: status || "unknown", status: "processing" } },
    { upsert: true, returnDocument: "before" },
  ).lean();
  if (existing && existing.status !== "failed") return Response.json({ ok: true, duplicate: true });

  try {
    const result = await applyCarrierUpdate({
      orderNumber: body.order_id ?? null,
      trackingNumber: body.awb !== undefined ? String(body.awb) : null,
      rawStatus: status,
      source: "webhook",
      events: (body.scans ?? []).map((scan) => ({
        status: scan["sr-status-label"] ?? scan.status ?? "",
        description: scan.activity ?? "",
        location: scan.location ?? "",
        at: parseDate(scan.date),
      })),
    });
    await WebhookEvent.updateOne(
      { provider: "shiprocket", eventId },
      {
        $set: {
          status: result.orderNumber ? "processed" : "ignored",
          summary: result.orderNumber ? `${result.orderNumber}: ${status}${result.changed ? ` -> ${result.status}` : ""}` : "order not found",
          processedAt: new Date(),
        },
      },
    );
    // Always 200 so the courier does not retry events for unknown orders.
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Shipping webhook failed", message);
    await WebhookEvent.updateOne({ provider: "shiprocket", eventId }, { $set: { status: "failed", error: message.slice(0, 500) } });
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
