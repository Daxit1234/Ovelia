import { timingSafeEqual } from "node:crypto";
import { connectDB, RateLimitBucket, WebhookEvent } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { runPaymentMaintenance } from "@/lib/services/orders";

function authorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduled maintenance (run every 10–15 minutes, e.g. Vercel Cron):
 * - reconciles unpaid online orders with Razorpay before expiring them,
 * - releases stock held by expired payment reservations,
 * - finishes paid orders whose confirmation was interrupted,
 * - prunes old webhook and rate-limit records.
 *
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const started = Date.now();
  const payments = await runPaymentMaintenance(new Date());
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [webhooks, buckets] = await Promise.all([
    WebhookEvent.deleteMany({ createdAt: { $lt: cutoff }, status: { $in: ["processed", "ignored"] } }),
    RateLimitBucket.deleteMany({ expiresAt: { $lt: new Date() } }),
  ]);
  return Response.json({
    ok: true,
    ...payments,
    prunedWebhookEvents: webhooks.deletedCount,
    prunedRateLimitBuckets: buckets.deletedCount,
    tookMs: Date.now() - started,
  });
}

export const GET = handle;
export const POST = handle;
