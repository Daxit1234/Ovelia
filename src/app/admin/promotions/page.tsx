import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { deletePromotionAction, setPromotionActiveAction } from "@/app/admin/promotions/actions";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { compact } from "@/lib/admin/list";
import {
  describeConditions,
  describeOffer,
  describeSchedule,
  listPromotions,
  parsePromotionFilters,
  PROMOTION_STATE_LABELS,
  PROMOTION_STATES,
  type PromotionState,
} from "@/lib/admin/promotions";
import { PROMOTION_TYPES } from "@/lib/domain/pricing";
import { hasPermission } from "@/lib/domain/roles";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PROMOTION_TYPE_LABELS } from "@/lib/validation/promotion";

export const metadata: Metadata = { title: "Promotions" };

const STATE_TONES: Record<PromotionState, string> = {
  active: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-sky-100 text-sky-900",
  expired: "bg-stone-200 text-stone-900",
  paused: "bg-amber-100 text-amber-900",
  used_up: "bg-stone-200 text-stone-900",
};

export default async function AdminPromotionsPage({ searchParams }: PageProps<"/admin/promotions">) {
  const user = await requireStaffPage("promotions:read", "/admin/promotions");
  const filters = parsePromotionFilters(await searchParams);
  const { rows, total, pageCount } = await listPromotions(filters);
  const canWrite = hasPermission(user.role, "promotions:write");
  const params = compact({ q: filters.q, state: filters.state, type: filters.type });

  return (
    <>
      <AdminPageHeader
        title="Promotions"
        description="Coupon codes and automatic offers. Prices and discounts are always recalculated on the server at checkout."
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/promotions/new">
                <Plus className="size-4" /> New promotion
              </Link>
            </Button>
          ) : null
        }
      />
      <FilterBar resetHref="/admin/promotions">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={filters.q} placeholder="Name, code or campaign" className="h-9" />
        </FilterField>
        <FilterField label="Status">
          <select name="state" defaultValue={filters.state} className={filterSelectClass}>
            <option value="">Any status</option>
            {PROMOTION_STATES.map((s) => (
              <option key={s} value={s}>
                {PROMOTION_STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Type">
          <select name="type" defaultValue={filters.type} className={filterSelectClass}>
            <option value="">Any type</option>
            {PROMOTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROMOTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="No promotions found" description={canWrite ? "Create a coupon code or an automatic offer." : undefined} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promotion</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Status</TableHead>
                {canWrite ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const id = p._id.toHexString();
                return (
                  <TableRow key={id}>
                    <TableCell className="max-w-64 whitespace-normal">
                      <Link href={`/admin/promotions/${id}`} className="font-semibold text-brand-green hover:underline">
                        {p.name}
                      </Link>
                      {p.campaign ? <span className="block text-xs text-muted-foreground">{p.campaign}</span> : null}
                    </TableCell>
                    <TableCell>{p.code ? <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{p.code}</span> : <span className="text-xs text-muted-foreground">Automatic</span>}</TableCell>
                    <TableCell className="text-sm">
                      {describeOffer(p)}
                      {p.appliesTo !== "all" && p.type !== "bundle" ? <span className="block text-xs text-muted-foreground">{p.appliesTo === "products" ? pluralize(p.productIds.length, "product") : pluralize(p.categoryIds.length, "category", "categories")}</span> : null}
                    </TableCell>
                    <TableCell className="max-w-48 text-xs whitespace-normal text-muted-foreground">{describeConditions(p)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{describeSchedule(p)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.usageCount}
                      {p.usageLimit ? <span className="text-muted-foreground"> / {p.usageLimit}</span> : null}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-full font-medium", STATE_TONES[p.state])}>{PROMOTION_STATE_LABELS[p.state]}</Badge>
                      {p.stackable ? <span className="mt-1 block text-[11px] text-muted-foreground">Stackable</span> : null}
                    </TableCell>
                    {canWrite ? (
                      <TableCell className="text-right whitespace-nowrap">
                        <ActionButton variant="ghost" action={setPromotionActiveAction.bind(null, id, !p.isActive)}>
                          {p.isActive ? "Pause" : "Activate"}
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          action={deletePromotionAction.bind(null, id)}
                          confirm={{ title: `Delete “${p.name}”?`, description: "Only promotions that were never used can be deleted. Used promotions can be paused instead." }}
                          confirmLabel="Delete"
                        >
                          Delete
                        </ActionButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/promotions" params={params} page={filters.page} pageCount={pageCount} total={total} />
    </>
  );
}
