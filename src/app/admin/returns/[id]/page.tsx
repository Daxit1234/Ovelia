import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnActions } from "@/components/admin/returns/return-actions";
import { AdminPageHeader, KeyValue, OrderStatusBadge, Panel, PaymentStatusBadge, ReturnStatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { getAdminReturn } from "@/lib/admin/returns";
import { RETURN_STATUS_LABELS } from "@/lib/domain/returns";
import { hasPermission } from "@/lib/domain/roles";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Return" };

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending_approval: "Awaiting approval",
  processing: "Processing",
  processed: "Refunded",
  failed: "Failed",
  rejected: "Rejected",
  manual: "Recorded manually",
};

export default async function AdminReturnPage({ params }: PageProps<"/admin/returns/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("returns:manage", `/admin/returns/${id}`);
  const data = await getAdminReturn(id);
  if (!data) notFound();
  const { request, order, refunds, refundable } = data;
  const canRefund = hasPermission(user.role, "orders:refund");
  const canSeeOrder = hasPermission(user.role, "orders:read");

  return (
    <>
      <AdminPageHeader
        title={`Return · ${request.orderNumber}`}
        description={`Requested ${formatDateTime(request.createdAt)} · customer wants a ${request.resolution}`}
        back={{ href: "/admin/returns", label: "Returns" }}
        actions={<ReturnStatusBadge status={request.status} />}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Items to return">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Refund value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.items.map((item) => (
                  <TableRow key={item.orderItemId.toHexString()}>
                    <TableCell>
                      {item.productName} <span className="text-muted-foreground">· {item.variantLabel}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(item.unitRefund * item.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-sm text-muted-foreground">
              Refund value is what the customer paid for these items after discounts. {request.restock ? "" : "These items were not restocked."}
            </p>
          </Panel>

          <Panel title="Customer's reason">
            <p className="font-medium text-brand-ink">{request.reason}</p>
            {request.details ? <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{request.details}</p> : <p className="mt-2 text-sm text-muted-foreground">No further details given.</p>}
          </Panel>

          <Panel title="History">
            <ol className="space-y-3 border-l pl-4">
              {[...request.history].reverse().map((h, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand-teal" aria-hidden />
                  <p className="font-medium text-brand-ink">
                    {RETURN_STATUS_LABELS[h.status]} <span className="font-normal text-muted-foreground">· {h.by} · {formatDateTime(h.at)}</span>
                  </p>
                  {h.note ? <p className="text-muted-foreground">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Actions">
            <ReturnActions
              returnId={request._id.toHexString()}
              status={request.status}
              canRefund={canRefund}
              refund={{
                defaultAmount: Math.min(request.refundAmount, refundable) / 100,
                maxAmount: refundable / 100,
                isCod: order?.paymentMethod === "cod",
                paid: (order?.pricing.amountPaid ?? 0) > 0,
              }}
            />
          </Panel>

          {order ? (
            <Panel title="Order" actions={canSeeOrder ? <Link href={`/admin/orders/${order._id.toHexString()}`} className="text-sm font-semibold text-brand-green">Open order →</Link> : null}>
              <KeyValue
                items={[
                  { label: "Customer", value: order.customer.name },
                  { label: "Email", value: order.customer.email },
                  { label: "Status", value: <OrderStatusBadge status={order.status} /> },
                  { label: "Payment", value: <PaymentStatusBadge status={order.paymentStatus} method={order.paymentMethod} /> },
                  { label: "Paid", value: formatINR(order.pricing.amountPaid) },
                  { label: "Refunded", value: formatINR(order.pricing.amountRefunded) },
                  { label: "Still refundable", value: formatINR(refundable) },
                  { label: "Delivered", value: order.deliveredAt ? formatDateTime(order.deliveredAt) : "—" },
                ]}
              />
            </Panel>
          ) : null}

          {refunds.length ? (
            <Panel title="Refunds for this return">
              <ul className="space-y-2 text-sm">
                {refunds.map((r) => (
                  <li key={r._id.toHexString()} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span>
                      <span className="block text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                      {r.failureReason ? <span className="block text-xs text-rose-700">{r.failureReason}</span> : null}
                    </span>
                    <Badge variant={r.status === "failed" ? "destructive" : "secondary"}>{REFUND_STATUS_LABELS[r.status] ?? r.status}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
