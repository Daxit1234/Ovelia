import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass, ReturnStatusBadge } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { compact } from "@/lib/admin/list";
import { listReturns, parseReturnFilters } from "@/lib/admin/returns";
import { RETURN_STATUSES } from "@/lib/db";
import { RETURN_STATUS_LABELS } from "@/lib/domain/returns";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Returns" };

export default async function AdminReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  await requireStaffPage("returns:manage", "/admin/returns");
  const filters = parseReturnFilters(await searchParams);
  const { rows, total, pageCount } = await listReturns(filters);
  const params = compact({ q: filters.q, status: filters.status === "open" ? "" : filters.status });

  return (
    <>
      <AdminPageHeader title="Returns & refunds" description="Review return requests, receive items back into stock and refund customers." />
      <FilterBar resetHref="/admin/returns">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={filters.q} placeholder="Order number, SKU or product" className="h-9" />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status} className={filterSelectClass}>
            <option value="open">Open (needs action)</option>
            <option value="all">All returns</option>
            {RETURN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RETURN_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title={filters.status === "open" ? "No open returns" : "No returns found"} description="Customers can request a return from their order page after delivery, within the return window set in Settings." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Refund value</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id.toHexString()}>
                  <TableCell>
                    <Link href={`/admin/returns/${r._id.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                      {r.orderNumber}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{r.resolution === "replacement" ? "Wants a replacement" : "Wants a refund"}</span>
                  </TableCell>
                  <TableCell>
                    {r.order ? (
                      <>
                        <span className="block font-medium">{r.order.customer.name}</span>
                        <span className="text-xs text-muted-foreground">{r.order.paymentMethod === "cod" ? "Cash on Delivery" : "Paid online"}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-56 text-sm whitespace-normal">{r.items.map((i) => `${i.productName} (${i.variantLabel}) × ${i.quantity}`).join(", ")}</TableCell>
                  <TableCell className="max-w-48 text-sm whitespace-normal">{r.reason}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(r.refundAmount)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <ReturnStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/returns" params={params} page={filters.page} pageCount={pageCount} total={total} />
    </>
  );
}
