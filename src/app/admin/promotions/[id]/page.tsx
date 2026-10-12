import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PromotionForm } from "@/components/admin/promotions/promotion-form";
import { AdminPageHeader, Panel, StatCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { categoryOptions } from "@/lib/admin/products";
import { getPromotionForm, productVariantOptions, PROMOTION_STATE_LABELS, recentRedemptions } from "@/lib/admin/promotions";
import { hasPermission } from "@/lib/domain/roles";
import { formatDateTime, formatNumber } from "@/lib/format";
import { maskEmail } from "@/lib/india";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Promotion" };

const REDEMPTION_LABELS = { reserved: "Awaiting payment", confirmed: "Used", released: "Released" } as const;

export default async function EditPromotionPage({ params }: PageProps<"/admin/promotions/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("promotions:read", `/admin/promotions/${id}`);
  const [promo, products, categories, redemptions] = await Promise.all([getPromotionForm(id), productVariantOptions(), categoryOptions(), recentRedemptions(id)]);
  if (!promo) notFound();
  const canWrite = hasPermission(user.role, "promotions:write");
  const canSeeOrders = hasPermission(user.role, "orders:read");

  return (
    <>
      <AdminPageHeader title={promo.name} description={`Status: ${PROMOTION_STATE_LABELS[promo.state]}`} back={{ href: "/admin/promotions", label: "Promotions" }} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Times used" value={formatNumber(promo.usage.confirmed)} hint={promo.usage.usageLimit ? `Limit ${formatNumber(promo.usage.usageLimit)}` : "No total limit"} />
        <StatCard label="Discount given" value={formatINR(promo.usage.discountGiven)} hint="On confirmed orders" />
        <StatCard label="Awaiting payment" value={formatNumber(promo.usage.pending)} hint="Held for online payments in progress" />
      </div>
      {canWrite ? (
        <PromotionForm promotionId={promo.id} initial={promo.values} products={products} categories={categories} />
      ) : (
        <p className="mb-5 rounded-xl border bg-white p-4 text-sm text-muted-foreground">You can view this promotion but not edit it.</p>
      )}
      <Panel title="Recent uses" className="mt-5">
        {redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not used yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redemptions.map((r) => (
                <TableRow key={r._id.toHexString()}>
                  <TableCell>
                    {canSeeOrders ? (
                      <Link href={`/admin/orders/${r.orderId.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                        {r.orderNumber}
                      </Link>
                    ) : (
                      r.orderNumber
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{maskEmail(r.email)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>{REDEMPTION_LABELS[r.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
