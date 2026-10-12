import "server-only";
import { headers } from "next/headers";
import { AuditLog, connectDB } from "@/lib/db";

const SENSITIVE_KEYS = /password|secret|token|hash|key|authorization|cookie/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 2000)}…`;
  return value;
}

export interface AuditActor {
  id: string | null;
  name: string;
  email: string | null;
  role: string | null;
}

/** Records an administrative action. Never throws. */
export async function audit(entry: {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await connectDB();
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      userAgent = h.get("user-agent");
    } catch {
      // Outside a request (scripts).
    }
    await AuditLog.create({
      actor: entry.actor,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      changes: entry.changes ? (sanitize(entry.changes) as Record<string, unknown>) : null,
      ip,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

/** Shallow diff of changed fields for audit trails. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
  }
  return changes;
}
