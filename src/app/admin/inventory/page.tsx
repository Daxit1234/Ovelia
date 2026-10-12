import type { Metadata } from "next";
import Link from "next/link";
import { AdjustStockDialog } from "@/components/admin/inventory/adjust-dialog";
import { MovementsTable } from "@/components/admin/inventory/movements-table";
import { AdminPageHeader, EmptyState, Panel, StatCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { oneOf, param } from "@/lib/admin/list";
import { connectDB, InventoryMovement, Product, type VariantDoc } from "@/lib/db";
import { hasPermission } from "@/lib/domain/roles";
import { escapeRegex } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const user = await requireStaffPage("inventory:read", "/admin/inventory");
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 60);
  const level = oneOf(param(sp, "level"), ["", "low", "out"] as const, "");
  const canAdjust = hasPermission(user.role, "inventory:adjust");
  await connectDB();

  const products = await Product.find(q ? { $or: [{ name: new RegExp(escapeRegex(q), "i") }, { "variants.sku": new RegExp(escapeRegex(q), "i") }] } : {}, { name: 1, slug: 1, variants: 1, status: 1 })
    .sort({ name: 1 })
    .lean();
  type Row = { productId: string; productName: string; status: string; v: VariantDoc };
  let rows: Row[] = products.flatMap((p) => (p.variants as VariantDoc[]).map((v) => ({ productId: p._id.toHexString(), productName: p.name, status: p.status, v })));
  if (q) rows = rows.filter((r) => r.productName.toLowerCase().includes(q.toLowerCase()) || r.v.sku.toLowerCase().includes(q.toLowerCase()));
  const all = rows;
  if (level === "out") rows = rows.filter((r) => r.v.stock === 0);
  if (level === "low") rows = rows.filter((r) => r.v.stock > 0 && r.v.stock <= r.v.lowStockThreshold);

  const movements = await InventoryMovement.find(q ? { $or: [{ sku: new RegExp(escapeRegex(q), "i") }, { productName: new RegExp(escapeRegex(q), "i") }] } : {})
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const lowCount = all.filter((r) => r.v.stock > 0 && r.v.stock <= r.v.lowStockThreshold).length;
  const outCount = all.filter((r) => r.v.stock === 0).length;
  const totalUnits = all.reduce((s, r) => s + r.v.stock, 0);
  const reserved = all.reduce((s, r) => s + (r.v.reserved ?? 0), 0);
  const stockValue = all.reduce((s, r) => s + (r.v.stock + (r.v.reserved ?? 0)) * (r.v.costPrice ?? 0), 0);

  return (
    <>
      <AdminPageHeader title="Inventory" description="Stock by variant. Available = can be sold now; reserved = held for online payments in progress." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Units available" value={totalUnits} />
        <StatCard label="Units reserved" value={reserved} hint="Pending online payments" />
        <StatCard label="Low / out of stock" value={`${lowCount} / ${outCount}`} tone={lowCount + outCount > 0 ? "warn" : "default"} />
        <StatCard label="Stock value (at cost)" value={formatINR(stockValue)} />
      </div>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-3">
        <Input name="q" defaultValue={q} placeholder="Product name or SKU" className="h-9 w-60" aria-label="Search inventory" />
        <select name="level" defaultValue={level} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm" aria-label="Stock level">
          <option value="">All stock levels</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <Button type="submit" size="sm" className="h-9">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href="/admin/inventory">Reset</Link>
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No variants match" />
      ) : (
        <div className="mb-6 overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product / variant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Alert at</TableHead>
                <TableHead>Status</TableHead>
                {canAdjust ? <TableHead className="text-right">Adjust</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.v._id.toHexString()}>
                  <TableCell>
                    <Link href={`/admin/products/${r.productId}`} className="font-medium hover:underline">
                      {r.productName}
                    </Link>
                    <span className="text-muted-foreground"> · {r.v.label}</span>
                    {!r.v.isActive ? <Badge variant="secondary" className="ml-2">Inactive</Badge> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.v.sku}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.v.stock}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.v.reserved ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.v.lowStockThreshold}</TableCell>
                  <TableCell>
                    {r.v.stock === 0 ? <Badge variant="destructive">Out of stock</Badge> : r.v.stock <= r.v.lowStockThreshold ? <Badge className="bg-amber-100 text-amber-900">Low</Badge> : <Badge variant="outline">OK</Badge>}
                  </TableCell>
                  {canAdjust ? (
                    <TableCell className="text-right">
                      <AdjustStockDialog productId={r.productId} variantId={r.v._id.toHexString()} label={`${r.productName} · ${r.v.label}`} stock={r.v.stock} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Panel
        title="Recent stock movements"
        description="Every change to stock, with who made it and why."
        actions={
          <Link href={q ? `/admin/inventory/movements?q=${encodeURIComponent(q)}` : "/admin/inventory/movements"} className="text-sm font-semibold text-brand-green">
            All movements →
          </Link>
        }
      >
        {movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements yet.</p> : <MovementsTable movements={movements} />}
      </Panel>
    </>
  );
}
