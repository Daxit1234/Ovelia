import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { connectDB, RateLimitBucket } from "@/lib/db";
import { getEnv } from "@/lib/env";

export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

/** One-way hash of an IP so we can rate limit without storing raw IPs. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(`${getEnv().BETTER_AUTH_SECRET}:${value}`).digest("hex").slice(0, 32);
}

/**
 * Fixed-window counter stored in MongoDB (shared across serverless
 * instances). Buckets expire automatically via a TTL index.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }> {
  await connectDB();
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const id = `${key}:${windowStart}`;
  const bucket = await RateLimitBucket.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs + 60_000) } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  const allowed = (bucket?.count ?? 0) <= limit;
  return { allowed, retryAfter: allowed ? 0 : Math.ceil((windowStart + windowMs - Date.now()) / 1000) };
}

/** Rate limit by hashed client IP plus a scope name. */
export async function rateLimitByIp(scope: string, limit: number, windowSeconds: number) {
  const ip = await clientIp();
  return rateLimit(`${scope}:${hashIdentifier(ip)}`, limit, windowSeconds);
}
