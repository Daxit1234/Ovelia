"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB, ContactMessage } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { normalizeIndianMobile } from "@/lib/india";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { runAfter } from "@/lib/services/background";
import { sendEmail } from "@/lib/services/notifications";
import { notifyAdmins } from "@/lib/services/notifications/order-notifications";
import { templates } from "@/lib/services/notifications/templates";
import { clientIp, hashIdentifier, rateLimitByIp } from "@/lib/services/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email").max(254),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
  subject: z.enum(["Order support", "Product question", "Returns & refunds", "Bulk / business enquiry", "Feedback", "Other"]),
  orderNumber: z.string().trim().max(32),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(3000),
  website: z.string().max(200).optional(),
});

export type ContactInput = z.input<typeof contactSchema>;

export async function submitContactAction(input: ContactInput): Promise<ActionResult<null>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  if (parsed.data.website) return ok(null, "Thanks! We've received your message.");
  const limit = await rateLimitByIp("contact", 5, 3600);
  if (!limit.allowed) return fail("You've sent several messages recently. Please try again later.");
  try {
    await connectDB();
    const user = await getSessionUser();
    const data = parsed.data;
    const message = await ContactMessage.create({
      name: data.name,
      email: data.email.toLowerCase(),
      phone: normalizeIndianMobile(data.phone) ?? "",
      subject: data.subject,
      orderNumber: data.orderNumber.toUpperCase(),
      message: data.message,
      userId: user?.id ?? null,
      ipHash: hashIdentifier(await clientIp()),
    });
    runAfter(() =>
      sendEmail({
        to: data.email,
        template: "contact_ack",
        content: templates.contactAcknowledgement(data.name, data.subject),
        dedupeKey: `contact-ack:${message._id.toHexString()}`,
      }),
    );
    runAfter(() =>
      notifyAdmins(
        templates.adminAlert(`New message: ${data.subject}`, `${data.name} (${data.email}): ${data.message.slice(0, 300)}`, siteUrl("/admin/messages")),
        "admin_contact",
        `admin-contact:${message._id.toHexString()}`,
      ),
    );
    return ok(null, "Thanks! We've received your message and will reply soon.");
  } catch (error) {
    return toActionError(error, "Could not send your message. Please try again.");
  }
}
