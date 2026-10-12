import "server-only";
import { Resend } from "resend";
import type { Types } from "mongoose";
import { connectDB, NotificationLog } from "@/lib/db";
import { getEnv, integrations } from "@/lib/env";
import { loadSettings } from "@/lib/services/settings";
import { renderEmail, type EmailContent } from "@/lib/services/notifications/email-layout";
import type { StoreSettings } from "@/lib/validation/settings";

export type DeliveryStatus = "sent" | "failed" | "skipped";

export interface SendEmailInput {
  to: string | string[];
  template: string;
  content: EmailContent;
  orderId?: Types.ObjectId | string | null;
  userId?: Types.ObjectId | string | null;
  /** Prevents sending the same notification twice (e.g. "order-confirmed:<id>"). */
  dedupeKey?: string | null;
  settings?: StoreSettings;
}

let resendClient: Resend | null = null;
function resend(): Resend {
  resendClient ??= new Resend(getEnv().RESEND_API_KEY);
  return resendClient;
}

async function log(
  input: SendEmailInput,
  status: DeliveryStatus,
  extra: { subject: string; providerMessageId?: string | null; error?: string | null; provider: string },
) {
  try {
    await NotificationLog.create({
      channel: "email",
      template: input.template,
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      subject: extra.subject,
      status,
      provider: extra.provider,
      providerMessageId: extra.providerMessageId ?? null,
      error: extra.error ?? null,
      orderId: input.orderId ?? null,
      userId: input.userId ?? null,
      dedupeKey: status === "sent" ? (input.dedupeKey ?? null) : null,
    });
  } catch (error) {
    // A duplicate dedupe key means a concurrent send already succeeded.
    if ((error as { code?: number }).code !== 11000) console.error("Failed to write notification log", error);
  }
}

/**
 * Sends a transactional email through Resend. Never throws: failures are
 * logged so that an email outage cannot break checkout or order processing.
 */
export async function sendEmail(input: SendEmailInput): Promise<DeliveryStatus> {
  try {
    await connectDB();
    if (input.dedupeKey) {
      const already = await NotificationLog.exists({ dedupeKey: input.dedupeKey, status: "sent" });
      if (already) return "skipped";
    }
    const settings = input.settings ?? (await loadSettings());
    const { html, text } = renderEmail(input.content, settings);
    const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
    if (recipients.length === 0) return "skipped";

    if (!integrations.email()) {
      if (getEnv().NODE_ENV !== "production") {
        console.info(`[email:dev] To: ${recipients.join(", ")} | ${input.content.subject}\n${text}`);
      }
      await log(input, "skipped", { subject: input.content.subject, provider: "none", error: "Email provider not configured" });
      return "skipped";
    }

    const env = getEnv();
    const { data, error } = await resend().emails.send(
      {
        from: env.EMAIL_FROM,
        to: recipients,
        subject: input.content.subject,
        html,
        text,
        replyTo: env.EMAIL_REPLY_TO || settings.store.supportEmail || undefined,
        tags: [{ name: "template", value: input.template.replace(/[^a-zA-Z0-9_-]/g, "_") }],
      },
      input.dedupeKey ? { idempotencyKey: input.dedupeKey.slice(0, 256) } : undefined,
    );
    if (error || !data) {
      await log(input, "failed", { subject: input.content.subject, provider: "resend", error: error?.message ?? "Unknown error" });
      return "failed";
    }
    await log(input, "sent", { subject: input.content.subject, provider: "resend", providerMessageId: data.id });
    return "sent";
  } catch (error) {
    console.error("sendEmail failed", error);
    await log(input, "failed", {
      subject: input.content.subject,
      provider: "resend",
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    return "failed";
  }
}

/* ------------------------------------------------------------------ */
/* SMS / WhatsApp extension point                                      */
/* ------------------------------------------------------------------ */

export interface TextChannel {
  readonly name: "sms" | "whatsapp";
  readonly provider: string;
  isConfigured(): boolean;
  send(to: string, message: string): Promise<{ messageId: string }>;
}

const textChannels = new Map<TextChannel["name"], TextChannel>();

/**
 * Register an SMS or WhatsApp provider (e.g. MSG91, Gupshup, Twilio). No
 * provider is registered by default, so no text messages are sent or claimed.
 */
export function registerTextChannel(channel: TextChannel): void {
  textChannels.set(channel.name, channel);
}

export function activeTextChannels(): TextChannel["name"][] {
  return [...textChannels.values()].filter((c) => c.isConfigured()).map((c) => c.name);
}

export async function sendTextMessage(
  channelName: TextChannel["name"],
  to: string,
  message: string,
  meta: { template: string; orderId?: string | null; userId?: string | null },
): Promise<DeliveryStatus> {
  const channel = textChannels.get(channelName);
  if (!channel || !channel.isConfigured()) return "skipped";
  await connectDB();
  try {
    const { messageId } = await channel.send(to, message);
    await NotificationLog.create({
      channel: channelName,
      template: meta.template,
      to,
      status: "sent",
      provider: channel.provider,
      providerMessageId: messageId,
      orderId: meta.orderId ?? null,
      userId: meta.userId ?? null,
    });
    return "sent";
  } catch (error) {
    await NotificationLog.create({
      channel: channelName,
      template: meta.template,
      to,
      status: "failed",
      provider: channel.provider,
      error: error instanceof Error ? error.message : String(error),
      orderId: meta.orderId ?? null,
      userId: meta.userId ?? null,
    });
    return "failed";
  }
}
