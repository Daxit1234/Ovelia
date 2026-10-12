import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actor: { id: string | null; name: string; email: string | null; role: string | null };
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

const auditSchema = new Schema<AuditLogDoc>(
  {
    actor: {
      id: { type: String, default: null },
      name: { type: String, default: "System" },
      email: { type: String, default: null },
      role: { type: String, default: null },
    },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, default: null },
    summary: { type: String, default: "" },
    changes: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditSchema.index({ "actor.id": 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = defineModel<AuditLogDoc>("AuditLog", auditSchema);

/* ------------------------------------------------------------------ */
/* Notification log                                                    */
/* ------------------------------------------------------------------ */

export interface NotificationLogDoc {
  _id: Types.ObjectId;
  channel: "email" | "sms" | "whatsapp";
  template: string;
  to: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  provider: string;
  providerMessageId: string | null;
  error: string | null;
  orderId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
  dedupeKey: string | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationLogDoc>(
  {
    channel: { type: String, enum: ["email", "sms", "whatsapp"], required: true },
    template: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, default: "" },
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
    provider: { type: String, default: "" },
    providerMessageId: { type: String, default: null },
    error: { type: String, default: null },
    orderId: { type: Schema.Types.ObjectId, default: null },
    userId: { type: Schema.Types.ObjectId, default: null },
    dedupeKey: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ orderId: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });

export const NotificationLog = defineModel<NotificationLogDoc>("NotificationLog", notificationSchema);

/* ------------------------------------------------------------------ */
/* Webhook events (idempotency)                                        */
/* ------------------------------------------------------------------ */

export interface WebhookEventDoc {
  _id: Types.ObjectId;
  provider: "razorpay" | "shiprocket";
  eventId: string;
  eventType: string;
  status: "processing" | "processed" | "failed" | "ignored";
  attempts: number;
  error: string | null;
  summary: string;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<WebhookEventDoc>(
  {
    provider: { type: String, enum: ["razorpay", "shiprocket"], required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    status: { type: String, enum: ["processing", "processed", "failed", "ignored"], default: "processing" },
    attempts: { type: Number, default: 1 },
    error: { type: String, default: null },
    summary: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ createdAt: -1 });

export const WebhookEvent = defineModel<WebhookEventDoc>("WebhookEvent", webhookEventSchema);

/* ------------------------------------------------------------------ */
/* Counters (invoice numbering)                                        */
/* ------------------------------------------------------------------ */

export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });

export const Counter = defineModel<CounterDoc>("Counter", counterSchema);

/* ------------------------------------------------------------------ */
/* Rate limiting buckets                                               */
/* ------------------------------------------------------------------ */

export interface RateLimitBucketDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<RateLimitBucketDoc>(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitBucket = defineModel<RateLimitBucketDoc>("RateLimitBucket", rateLimitSchema);

/* ------------------------------------------------------------------ */
/* Cached provider credentials (e.g. Shiprocket auth token)            */
/* ------------------------------------------------------------------ */

export interface IntegrationTokenDoc {
  _id: string;
  token: string;
  expiresAt: Date;
}

const integrationTokenSchema = new Schema<IntegrationTokenDoc>(
  {
    _id: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);

export const IntegrationToken = defineModel<IntegrationTokenDoc>("IntegrationToken", integrationTokenSchema);
