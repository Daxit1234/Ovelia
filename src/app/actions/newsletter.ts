"use server";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { connectDB, NewsletterSubscriber } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { rateLimitByIp } from "@/lib/services/rate-limit";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";

function unsubscribeHash(email: string): string {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET).update(`newsletter:${email}`).digest("hex");
}

const schema = z.object({
  email: z.email("Enter a valid email address").max(254).transform((v) => v.trim().toLowerCase()),
  source: z.string().max(40).default("website"),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(200).optional(),
});

export async function subscribeNewsletterAction(input: z.input<typeof schema>): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid email address");
  if (parsed.data.website) return ok(null, "Thanks for subscribing!");
  const limit = await rateLimitByIp("newsletter", 5, 600);
  if (!limit.allowed) return fail("Too many attempts. Please try again later.");
  try {
    await connectDB();
    const { email, source } = parsed.data;
    await NewsletterSubscriber.updateOne(
      { email },
      {
        $set: { status: "subscribed", unsubscribedAt: null, unsubscribeTokenHash: unsubscribeHash(email) },
        $setOnInsert: { email, source, consentAt: new Date() },
      },
      { upsert: true },
    );
    return ok(null, "Thanks for subscribing! You'll hear about offers and new launches first.");
  } catch (error) {
    return toActionError(error, "Could not subscribe right now. Please try again.");
  }
}

export async function unsubscribeNewsletterAction(email: string, token: string): Promise<ActionResult<null>> {
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success || token !== unsubscribeHash(parsed.data)) return fail("This unsubscribe link is invalid.");
  await connectDB();
  await NewsletterSubscriber.updateOne({ email: parsed.data }, { $set: { status: "unsubscribed", unsubscribedAt: new Date() } });
  return ok(null, "You have been unsubscribed.");
}
