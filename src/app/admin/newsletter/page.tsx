import type { Metadata } from "next";
import type { QueryFilter } from "mongoose";
import { Download } from "lucide-react";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass, StatCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { compact, oneOf, pageParam, param } from "@/lib/admin/list";
import { connectDB, NewsletterSubscriber, type NewsletterSubscriberDoc } from "@/lib/db";
import { hasPermission } from "@/lib/domain/roles";
import { escapeRegex, formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Newsletter" };

const PAGE_SIZE = 50;

async function subscriberCounts() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [subscribed, unsubscribed, recent] = await Promise.all([
    NewsletterSubscriber.countDocuments({ status: "subscribed" }),
    NewsletterSubscriber.countDocuments({ status: "unsubscribed" }),
    NewsletterSubscriber.countDocuments({ status: "subscribed", consentAt: { $gte: since } }),
  ]);
  return { subscribed, unsubscribed, recent };
}

export default async function NewsletterPage({ searchParams }: PageProps<"/admin/newsletter">) {
  const user = await requireStaffPage("newsletter:read", "/admin/newsletter");
  const sp = await searchParams;
  const status = oneOf(param(sp, "status"), ["subscribed", "unsubscribed", "all"] as const, "subscribed");
  const q = param(sp, "q").slice(0, 80);
  const page = pageParam(sp);

  const filter: QueryFilter<NewsletterSubscriberDoc> = {};
  if (status !== "all") filter.status = status;
  if (q) filter.email = new RegExp(escapeRegex(q), "i");
  await connectDB();
  const [subscribers, total, { subscribed, unsubscribed, recent }] = await Promise.all([
    NewsletterSubscriber.find(filter, { email: 1, status: 1, source: 1, consentAt: 1, unsubscribedAt: 1 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    NewsletterSubscriber.countDocuments(filter),
    subscriberCounts(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Newsletter"
        description="People who asked for offers and updates by email. Every message you send must include the unsubscribe link."
        actions={
          hasPermission(user.role, "newsletter:export") ? (
            <Button variant="outline" asChild>
              <a href="/api/admin/export/newsletter">
                <Download className="size-4" /> Export subscribers
              </a>
            </Button>
          ) : null
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Subscribed" value={formatNumber(subscribed)} />
        <StatCard label="New in the last 30 days" value={formatNumber(recent)} />
        <StatCard label="Unsubscribed" value={formatNumber(unsubscribed)} />
      </div>
      <FilterBar resetHref="/admin/newsletter">
        <FilterField label="Email" className="sm:col-span-2">
          <Input name="q" defaultValue={q} placeholder="Search email" className="h-9" />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={status} className={filterSelectClass}>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="all">All</option>
          </select>
        </FilterField>
      </FilterBar>
      {subscribers.length === 0 ? (
        <EmptyState title="No subscribers found" description="Sign-ups come from the newsletter form on the home page and footer." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Consent given</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((s) => (
                <TableRow key={s._id.toHexString()}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell className="text-sm capitalize">{s.source}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(s.consentAt)}</TableCell>
                  <TableCell>
                    {s.status === "subscribed" ? (
                      <Badge className="bg-emerald-100 text-emerald-900">Subscribed</Badge>
                    ) : (
                      <Badge variant="secondary">Unsubscribed{s.unsubscribedAt ? ` · ${formatDateTime(s.unsubscribedAt)}` : ""}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/newsletter" params={compact({ status: status === "subscribed" ? "" : status, q })} page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} />
    </>
  );
}
