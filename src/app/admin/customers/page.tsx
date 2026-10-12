import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { CUSTOMER_SORTS, listCustomers, parseCustomerFilters } from "@/lib/admin/customers";
import { compact } from "@/lib/admin/list";
import { hasPermission } from "@/lib/domain/roles";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const user = await requireStaffPage("customers:read", "/admin/customers");
  const filters = parseCustomerFilters(await searchParams);
  const { rows, total, pageCount } = await listCustomers(filters);
  const params = compact({ q: filters.q, status: filters.status, sort: filters.sort === "newest" ? "" : filters.sort });
  const exportHref = `/api/admin/export/customers?${new URLSearchParams(compact({ q: filters.q, status: filters.status })).toString()}`;

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Registered customer accounts. Guest checkouts appear on their orders."
        actions={
          hasPermission(user.role, "customers:export") ? (
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download className="size-4" /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />
      <FilterBar resetHref="/admin/customers">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={filters.q} placeholder="Name, email or phone" className="h-9" />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status} className={filterSelectClass}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </FilterField>
        <FilterField label="Sort">
          <select name="sort" defaultValue={filters.sort} className={filterSelectClass}>
            {Object.entries(CUSTOMER_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="No customers found" description="Customers appear here when they create an account." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Net spent</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c._id.toHexString()}>
                  <TableCell>
                    <Link href={`/admin/customers/${c._id.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {c.email}
                      {c.emailVerified ? "" : " · unverified"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.stats.orders}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(c.stats.spent)}</TableCell>
                  <TableCell className="text-sm">{c.stats.lastOrderAt ? formatDate(c.stats.lastOrderAt) : "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(c.createdAt)}</TableCell>
                  <TableCell>{c.status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="outline">Active</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/customers" params={params} page={filters.page} pageCount={pageCount} total={total} />
    </>
  );
}
