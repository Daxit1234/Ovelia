import type { Metadata } from "next";
import type { QueryFilter } from "mongoose";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { compact, pageParam, param, parseDay } from "@/lib/admin/list";
import { AuditLog, connectDB, type AuditLogDoc } from "@/lib/db";
import { ROLE_LABELS, type UserRole } from "@/lib/domain/roles";
import { escapeRegex, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireStaffPage("audit:read", "/admin/audit");
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 80);
  const entity = param(sp, "entity").slice(0, 40);
  const from = param(sp, "from");
  const to = param(sp, "to");
  const page = pageParam(sp);

  await connectDB();
  const entityTypes = (await AuditLog.distinct("entityType")).sort();
  const filter: QueryFilter<AuditLogDoc> = {};
  if (entity && entityTypes.includes(entity)) filter.entityType = entity;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ summary: rx }, { action: rx }, { "actor.name": rx }, { "actor.email": rx }, { entityId: q }];
  }
  const fromDate = parseDay(from);
  const toDate = parseDay(to, true);
  if (fromDate || toDate) filter.createdAt = { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) };

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return (
    <>
      <AdminPageHeader title="Audit log" description="A record of every important admin action: who did what, when and from where. Sensitive values are redacted." />
      <FilterBar resetHref="/admin/audit">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={q} placeholder="Summary, action, person or record id" className="h-9" />
        </FilterField>
        <FilterField label="Area">
          <select name="entity" defaultValue={entity} className={filterSelectClass}>
            <option value="">Everything</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From">
          <Input type="date" name="from" defaultValue={from} className="h-9" />
        </FilterField>
        <FilterField label="To">
          <Input type="date" name="to" defaultValue={to} className="h-9" />
        </FilterField>
      </FilterBar>
      {entries.length === 0 ? (
        <EmptyState title="No entries found" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e._id.toHexString()} className="align-top">
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell className="text-sm">
                    {e.actor.name}
                    <span className="block text-xs text-muted-foreground">{e.actor.role ? (ROLE_LABELS[e.actor.role as UserRole] ?? e.actor.role) : "System"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xl text-sm whitespace-normal">
                    {e.summary}
                    {e.changes && Object.keys(e.changes).length ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">Changes</summary>
                        <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">{JSON.stringify(e.changes, null, 2)}</pre>
                      </details>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{e.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/audit" params={compact({ q, entity, from, to })} page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} />
    </>
  );
}
