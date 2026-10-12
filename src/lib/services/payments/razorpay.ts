import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { getEnv, integrations } from "@/lib/env";
import { AppError } from "@/lib/result";

let client: Razorpay | null = null;

export function razorpayClient(): Razorpay {
  if (!integrations.razorpay()) throw new AppError("Online payments are not configured.", "PAYMENTS_DISABLED", 503);
  const env = getEnv();
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });
  return client;
}

/** Public key id for Razorpay Checkout (safe to send to the browser). */
export function razorpayKeyId(): string {
  return getEnv().RAZORPAY_KEY_ID ?? "";
}

function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verifies the signature Razorpay Checkout returns after a payment:
 * HMAC-SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyCheckoutSignature(input: { razorpayOrderId: string; razorpayPaymentId: string; signature: string }): boolean {
  const secret = getEnv().RAZORPAY_KEY_SECRET;
  if (!secret || !input.signature) return false;
  const expected = createHmac("sha256", secret).update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest("hex");
  return safeEqualHex(expected, input.signature);
}

/** Verifies the X-Razorpay-Signature header against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = getEnv().RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export interface RazorpayPaymentInfo {
  id: string;
  orderId: string | null;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  method: string | null;
  captured: boolean;
  errorCode: string | null;
  errorDescription: string | null;
}

function normalizePayment(p: {
  id: string;
  order_id?: string | null;
  status: string;
  amount: number | string;
  currency: string;
  method?: string | null;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
}): RazorpayPaymentInfo {
  return {
    id: p.id,
    orderId: p.order_id ?? null,
    status: p.status as RazorpayPaymentInfo["status"],
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method ?? null,
    captured: Boolean(p.captured),
    errorCode: p.error_code ?? null,
    errorDescription: p.error_description ?? null,
  };
}

export async function createRazorpayOrder(input: { amount: number; receipt: string; notes: Record<string, string> }) {
  const order = await razorpayClient().orders.create({
    amount: input.amount,
    currency: "INR",
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPaymentInfo> {
  return normalizePayment(await razorpayClient().payments.fetch(paymentId));
}

export async function fetchOrderPayments(razorpayOrderId: string): Promise<RazorpayPaymentInfo[]> {
  const result = await razorpayClient().orders.fetchPayments(razorpayOrderId);
  return (result.items ?? []).map((p) => normalizePayment(p as Parameters<typeof normalizePayment>[0]));
}

/** Captures an authorized payment (needed when auto-capture is disabled). */
export async function capturePayment(paymentId: string, amount: number): Promise<RazorpayPaymentInfo> {
  return normalizePayment(await razorpayClient().payments.capture(paymentId, amount, "INR"));
}

export async function createRazorpayRefund(paymentId: string, input: { amount: number; receipt: string; notes: Record<string, string> }) {
  const refund = await razorpayClient().payments.refund(paymentId, {
    amount: input.amount,
    speed: "normal",
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
  });
  return { id: refund.id, status: String((refund as { status?: string }).status ?? "pending"), amount: Number(refund.amount ?? input.amount) };
}

export function describeRazorpayError(error: unknown): string {
  const e = error as { error?: { description?: string }; message?: string; statusCode?: number };
  return e?.error?.description ?? e?.message ?? "Payment provider error";
}
