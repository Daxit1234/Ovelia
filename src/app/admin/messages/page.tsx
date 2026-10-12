import type { Metadata } from "next";
import Link from "next/link";
import type { QueryFilter } from "mongoose";
import { Mail, Phone } from "lucide-react";
import { MessageControls } from "@/components/admin/messages/message-controls";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { requireStaffPage } from "@/lib/auth/session";
import { compact, oneOf, pageParam, param } from "@/lib/admin/list";
import { connectDB, ContactMessage, type ContactMessageDoc } from "@/lib/db";
import { hasPermission } from "@/lib/domain/roles";
import { escapeRegex, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Messages" };

const PAGE_SIZE = 20;
const STATUS_FILTERS = { open: "Open (new and in progress)", new: "New", in_progress: "In progress", resolved: "Resolved", all: "All messages" } as const;
const STATUS_TONES = { new: "bg-amber-100 text-amber-900", in_progress: "bg-sky-100 text-sky-900", resolved: "bg-emerald-100 text-emerald-900" } as const;
const STATUS_LABELS = { new: "New", in_progress: "In progress", resolved: "Resolved" } as const;

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  const user = await requireStaffPage("messages:read", "/admin/messages");
  const sp = await searchParams;
  const status = oneOf(param(sp, "status"), Object.keys(STATUS_FILTERS) as (keyof typeof STATUS_FILTERS)[], "open");
  const q = param(sp, "q").slice(0, 80);
  const page = pageParam(sp);

  const filter: QueryFilter<ContactMessageDoc> = {};
  if (status === "open") filter.status = { $in: ["new", "in_progress"] };
  else if (status !== "all") filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { subject: rx }, { message: rx }, { orderNumber: rx }];
  }
  await connectDB();
  const [messages, total] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    ContactMessage.countDocuments(filter),
  ]);
  const canOrders = hasPermission(user.role, "orders:read");

  return (
    <>
      <AdminPageHeader title="Messages" description="Enquiries from the contact form. Reply by email; customers are not notified of status changes." />
      <FilterBar resetHref="/admin/messages">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={q} placeholder="Name, email, subject, text or order number" className="h-9" />
        </FilterField>
        <FilterField label="Show">
          <select name="status" defaultValue={status} className={filterSelectClass}>
            {Object.entries(STATUS_FILTERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      {messages.length === 0 ? (
        <EmptyState title={status === "open" ? "No open messages" : "No messages found"} />
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const id = m._id.toHexString();
            return (
              <li key={id} className="grid gap-4 rounded-2xl border bg-white p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</Badge>
                    <span className="font-semibold text-brand-ink">{m.subject}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.name} · {formatDateTime(m.createdAt)}
                    {m.orderNumber ? (
                      <>
                        {" · Order "}
                        {canOrders ? (
                          <Link href={`/admin/orders?q=${encodeURIComponent(m.orderNumber)}`} className="font-semibold text-brand-green hover:underline">
                            {m.orderNumber}
                          </Link>
                        ) : (
                          m.orderNumber
                        )}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-3 text-sm whitespace-pre-line text-brand-ink">{m.message}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-green hover:underline">
                      <Mail className="size-4" aria-hidden /> {m.email}
                    </a>
                    {m.phone ? (
                      <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline">
                        <Phone className="size-4" aria-hidden /> {m.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
                <MessageControls messageId={id} status={m.status} notes={m.notes} />
              </li>
            );
          })}
        </ul>
      )}
      <AdminPagination basePath="/admin/messages" params={compact({ status: status === "open" ? "" : status, q })} page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} />
    </>
  );
}
