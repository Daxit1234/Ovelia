import type { Metadata } from "next";
import type { QueryFilter } from "mongoose";
import { MOVEMENT_LABELS, MovementsTable } from "@/components/admin/inventory/movements-table";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { requireStaffPage } from "@/lib/auth/session";
import { compact, oneOf, pageParam, param, parseDay } from "@/lib/admin/list";
import { connectDB, InventoryMovement, MOVEMENT_TYPES, type InventoryMovementDoc } from "@/lib/db";
import { escapeRegex } from "@/lib/format";

export const metadata: Metadata = { title: "Stock movements" };

const PAGE_SIZE = 30;

export default async function StockMovementsPage({ searchParams }: PageProps<"/admin/inventory/movements">) {
  await requireStaffPage("inventory:read", "/admin/inventory/movements");
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 60);
  const type = oneOf(param(sp, "type"), ["", ...MOVEMENT_TYPES] as const, "");
  const from = param(sp, "from");
  const to = param(sp, "to");
  const page = pageParam(sp);

  const filter: QueryFilter<InventoryMovementDoc> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ sku: rx }, { productName: rx }, { orderNumber: rx }];
  }
  if (type) filter.type = type;
  const fromDate = parseDay(from);
  const toDate = parseDay(to, true);
  if (fromDate || toDate) filter.createdAt = { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) };

  await connectDB();
  const [movements, total] = await Promise.all([
    InventoryMovement.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    InventoryMovement.countDocuments(filter),
  ]);
  const params = compact({ q, type, from, to });

  return (
    <>
      <AdminPageHeader title="Stock movements" description="The complete stock ledger: sales, reservations, returns, imports and manual adjustments." back={{ href: "/admin/inventory", label: "Inventory" }} />
      <FilterBar resetHref="/admin/inventory/movements">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={q} placeholder="SKU, product or order number" className="h-9" />
        </FilterField>
        <FilterField label="Type">
          <select name="type" defaultValue={type} className={filterSelectClass}>
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_LABELS[t]}
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
      {movements.length === 0 ? (
        <EmptyState title="No movements found" description="Try a different search or date range." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white px-2">
          <MovementsTable movements={movements} />
        </div>
      )}
      <AdminPagination basePath="/admin/inventory/movements" params={params} page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} />
    </>
  );
}
