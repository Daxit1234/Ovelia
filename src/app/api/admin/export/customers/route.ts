import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/session";
import { customerQuery, orderStatsFor, parseCustomerFilters } from "@/lib/admin/customers";
import { csvResponse, rupeesCell, toCsv } from "@/lib/csv";
import { connectDB, NewsletterSubscriber, User } from "@/lib/db";
import { maskMobile } from "@/lib/india";
import { AuthorizationError } from "@/lib/result";
import { audit } from "@/lib/services/audit";

const MAX_ROWS = 20_000;

/**
 * Customer list export. Phone numbers are masked: the file is for analysis
 * and email marketing, and full numbers stay in the admin only.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await authorize("customers:export");
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
  const filters = parseCustomerFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  await connectDB();
  const customers = await User.find(customerQuery(filters), { name: 1, email: 1, phone: 1, status: 1, emailVerified: 1, createdAt: 1, lastLoginAt: 1, marketingOptIn: 1 })
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .lean();
  const [stats, subscribers] = await Promise.all([
    orderStatsFor(customers.map((c) => c._id)),
    NewsletterSubscriber.find({ email: { $in: customers.map((c) => c.email) }, status: "subscribed" }, { email: 1 }).lean(),
  ]);
  const subscribed = new Set(subscribers.map((s) => s.email));
  const ist = (d: Date | null | undefined) => (d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");
  const csv = toCsv(customers, [
    { header: "Name", value: (c) => c.name },
    { header: "Email", value: (c) => c.email },
    { header: "Email verified", value: (c) => (c.emailVerified ? "yes" : "no") },
    { header: "Phone (masked)", value: (c) => (c.phone ? maskMobile(c.phone) : "") },
    { header: "Status", value: (c) => c.status },
    { header: "Newsletter", value: (c) => (subscribed.has(c.email) ? "subscribed" : "no") },
    { header: "Orders", value: (c) => stats.get(c._id.toHexString())?.orders ?? 0 },
    { header: "Net spent (INR)", value: (c) => rupeesCell(stats.get(c._id.toHexString())?.spent ?? 0) },
    { header: "Last order (IST)", value: (c) => ist(stats.get(c._id.toHexString())?.lastOrderAt) },
    { header: "Joined (IST)", value: (c) => ist(c.createdAt) },
    { header: "Last sign-in (IST)", value: (c) => ist(c.lastLoginAt) },
  ]);
  await audit({
    actor: { id: user.id, name: user.name, email: user.email, role: user.role },
    action: "export.customers",
    entityType: "export",
    summary: `Exported ${customers.length} customers`,
    changes: { filters: { q: filters.q, status: filters.status } },
  });
  return csvResponse(csv, `ovelia-customers-${new Date().toISOString().slice(0, 10)}.csv`);
}
