import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass, OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { compact } from "@/lib/admin/list";
import { listOrders, ORDER_SORTS, parseOrderFilters } from "@/lib/admin/orders";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES } from "@/lib/domain/order-status";
import { hasPermission } from "@/lib/domain/roles";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const user = await requireStaffPage("orders:read", "/admin/orders");
  const filters = parseOrderFilters(await searchParams);
  const { rows, total, pageCount } = await listOrders(filters);
  const params = compact({
    q: filters.q,
    status: filters.status,
    payment: filters.payment,
    method: filters.method,
    from: filters.from,
    to: filters.to,
    attention: filters.attention ? "1" : "",
    sort: filters.sort === "newest" ? "" : filters.sort,
  });
  const exportHref = `/api/admin/export/orders?${new URLSearchParams(params).toString()}`;

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Search, filter and fulfil customer orders."
        actions={
          hasPermission(user.role, "orders:export") ? (
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download className="size-4" /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />
      <FilterBar resetHref="/admin/orders">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={filters.q} placeholder="Order no., name, email, phone, AWB…" className="h-9" />
        </FilterField>
        <FilterField label="Order status">
          <select name="status" defaultValue={filters.status} className={filterSelectClass}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Payment status">
          <select name="payment" defaultValue={filters.payment} className={filterSelectClass}>
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Payment method">
          <select name="method" defaultValue={filters.method} className={filterSelectClass}>
            <option value="">Online &amp; COD</option>
            <option value="razorpay">Online</option>
            <option value="cod">Cash on Delivery</option>
          </select>
        </FilterField>
        <FilterField label="Sort">
          <select name="sort" defaultValue={filters.sort} className={filterSelectClass}>
            {Object.entries(ORDER_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Placed from">
          <Input type="date" name="from" defaultValue={filters.from} className="h-9" />
        </FilterField>
        <FilterField label="Placed to">
          <Input type="date" name="to" defaultValue={filters.to} className="h-9" />
        </FilterField>
        <label className="flex h-9 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="attention" value="1" defaultChecked={filters.attention} className="size-4 accent-brand-green" /> Needs attention only
        </label>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="No orders found" description="Try different filters or a broader search." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o._id.toHexString()} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/admin/orders/${o._id.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                      {o.orderNumber}
                    </Link>
                    {o.needsAttention ? (
                      <span className="ml-1.5 inline-flex text-amber-600" title="Needs attention">
                        <AlertTriangle className="size-3.5" aria-label="Needs attention" />
                      </span>
                    ) : null}
                    {o.cancellation?.status === "requested" ? <span className="ml-1.5 text-xs text-rose-700">cancel req.</span> : null}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{o.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.shippingAddress.city}, {o.shippingAddress.state}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(o.placedAt)}</TableCell>
                  <TableCell>{o.items.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(o.pricing.grandTotal)}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={o.paymentStatus} method={o.paymentMethod} />
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/orders" params={params} page={filters.page} pageCount={pageCount} total={total} />
    </>
  );
}
