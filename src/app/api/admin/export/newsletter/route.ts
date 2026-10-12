import { authorize } from "@/lib/auth/session";
import { csvResponse, toCsv } from "@/lib/csv";
import { connectDB, NewsletterSubscriber } from "@/lib/db";
import { AuthorizationError } from "@/lib/result";
import { audit } from "@/lib/services/audit";

/** Current subscribers only: people who unsubscribed must never be exported for mailing. */
export async function GET() {
  let user;
  try {
    user = await authorize("newsletter:export");
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
  await connectDB();
  const subscribers = await NewsletterSubscriber.find({ status: "subscribed" }, { email: 1, source: 1, consentAt: 1 }).sort({ consentAt: 1 }).lean();
  const csv = toCsv(subscribers, [
    { header: "Email", value: (s) => s.email },
    { header: "Source", value: (s) => s.source },
    { header: "Consent given (IST)", value: (s) => s.consentAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) },
  ]);
  await audit({
    actor: { id: user.id, name: user.name, email: user.email, role: user.role },
    action: "export.newsletter",
    entityType: "export",
    summary: `Exported ${subscribers.length} newsletter subscribers`,
  });
  return csvResponse(csv, `ovelia-newsletter-${new Date().toISOString().slice(0, 10)}.csv`);
}
