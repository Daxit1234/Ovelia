import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText, Package, Printer } from "lucide-react";
import {
  addOrderNoteAction,
  approveRefundAction,
  bookShipmentAction,
  cancelOrderAdminAction,
  clearAttentionAction,
  createRefundAction,
  generateInvoiceAction,
  refreshTrackingAction,
  rejectRefundAction,
  resolveCancellationAction,
  saveTrackingAction,
  updateOrderStatusAction,
} from "@/app/admin/orders/actions";
import { ActionButton } from "@/components/admin/action-button";
import { BookShipmentDialog, CancelOrderDialog, DecisionButtons, NoteForm, RefundDialog, StatusUpdater, TrackingForm } from "@/components/admin/orders/order-controls";
import { AdminPageHeader, KeyValue, OrderStatusBadge, Panel, PaymentStatusBadge } from "@/components/admin/ui";
import { ProductImage } from "@/components/shared/product-image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireStaffPage } from "@/lib/auth/session";
import { getAdminOrder } from "@/lib/admin/orders";
import { allowedAdminTransitions, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/domain/order-status";
import { hasPermission } from "@/lib/domain/roles";
import { integrations } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { RETURN_STATUS_LABELS } from "@/lib/domain/returns";
import { loadSettings } from "@/lib/services/settings";
import { bookingProvider } from "@/lib/services/shipping";

export const metadata: Metadata = { title: "Order details" };

function Address({ a }: { a: { fullName: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string } }) {
  return (
    <address className="text-sm leading-6 not-italic">
      <span className="font-medium">{a.fullName}</span>
      <br />
      {a.line1}
      {a.line2 ? `, ${a.line2}` : ""}
      {a.landmark ? (
        <>
          <br />
          Landmark: {a.landmark}
        </>
      ) : null}
      <br />
      {a.city}, {a.state} {a.pincode}
      <br />
      +91 {a.phone}
    </address>
  );
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("orders:read", `/admin/orders/${id}`);
  const data = await getAdminOrder(id);
  if (!data) notFound();
  const { order, payments, refunds, shipments, returns, customerOrders } = data;
  const settings = await loadSettings();
  const canUpdate = hasPermission(user.role, "orders:update");
  const canRefund = hasPermission(user.role, "orders:refund");
  const orderId = order._id.toHexString();
  const allowed = [...allowedAdminTransitions(order.status)];
  const paid = order.pricing.amountPaid > 0;
  const refundable = Math.max(0, order.pricing.amountPaid - order.pricing.amountRefunded - refunds.filter((r) => r.status === "pending_approval").reduce((s, r) => s + r.amount, 0));
  const courier = bookingProvider(settings);
  const weight = order.items.reduce((s, i) => s + i.quantity, 0) * 600;
  const canCancel = ["pending_payment", "confirmed", "processing", "packed", "on_hold"].includes(order.status);

  return (
    <>
      <AdminPageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.placedAt)} · ${order.isGuest ? "Guest checkout" : "Registered customer"}`}
        back={{ href: "/admin/orders", label: "All orders" }}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/print/invoice/${order.orderNumber}`} target="_blank">
                <FileText className="size-4" /> Invoice
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/print/packing-slip/${order.orderNumber}`} target="_blank">
                <Printer className="size-4" /> Packing slip
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} method={order.paymentMethod} />
        <Badge variant="outline">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</Badge>
        {order.invoiceNumber ? <Badge variant="outline">Invoice {order.invoiceNumber}</Badge> : null}
      </div>

      {order.needsAttention ? (
        <Alert className="mb-5 border-amber-300 bg-amber-50">
          <AlertTriangle className="size-4 text-amber-700" />
          <AlertTitle>Needs attention</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{order.attentionReason || "Review this order."}</span>
            {canUpdate ? (
              <ActionButton action={clearAttentionAction.bind(null, orderId)} size="sm">
                Mark as reviewed
              </ActionButton>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {order.cancellation?.status === "requested" ? (
        <Alert className="mb-5 border-rose-200 bg-rose-50">
          <AlertTriangle className="size-4 text-rose-700" />
          <AlertTitle>Customer requested cancellation</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Reason: {order.cancellation.reason || "—"}</p>
            {canUpdate ? (
              <DecisionButtons
                approve={resolveCancellationAction.bind(null, orderId, true)}
                reject={resolveCancellationAction.bind(null, orderId, false)}
                approveLabel="Approve & cancel"
              />
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Panel title={`Items (${order.items.reduce((s, i) => s + i.quantity, 0)})`}>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item._id.toHexString()} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                    {item.image ? <ProductImage src={item.image} alt="" fill sizes="56px" className="object-cover" /> : <Package className="m-4 size-6 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {item.productName} — {item.variantLabel}
                    </p>
                    <p className="text-muted-foreground">
                      SKU {item.sku} · HSN {item.hsnCode || "—"} · GST {item.taxRate}%
                    </p>
                    {item.returnedQuantity ? <p className="text-amber-700">{item.returnedQuantity} returned</p> : null}
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>
                      {item.quantity} × {formatINR(item.unitPrice)}
                    </p>
                    {item.discount ? <p className="text-emerald-700">−{formatINR(item.discount)}</p> : null}
                    <p className="font-semibold">{formatINR(item.lineTotal)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t pt-4 text-sm">
              {[
                ["Subtotal", formatINR(order.pricing.subtotal)],
                ["Discounts", order.pricing.discountTotal ? `−${formatINR(order.pricing.discountTotal)}` : "—"],
                [`Shipping (${order.shippingMethod.label})`, order.pricing.shippingFee ? formatINR(order.pricing.shippingFee) : "Free"],
                ["COD fee", order.pricing.codFee ? formatINR(order.pricing.codFee) : "—"],
                [`GST (${order.pricing.interState ? "IGST" : "CGST+SGST"}, included)`, formatINR(order.pricing.taxTotal)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatINR(order.pricing.grandTotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Paid / refunded</dt>
                <dd className="tabular-nums">
                  {formatINR(order.pricing.amountPaid)} / {formatINR(order.pricing.amountRefunded)}
                </dd>
              </div>
            </dl>
            {order.appliedPromotions.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {order.appliedPromotions.map((p) => (
                  <Badge key={p.name} variant="secondary">
                    {p.code ?? p.name}: {p.freeShipping ? "free shipping" : `−${formatINR(p.amount)}`}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title="Customer">
              <KeyValue
                items={[
                  { label: "Name", value: order.customer.name },
                  { label: "Email", value: <a href={`mailto:${order.customer.email}`} className="text-brand-green hover:underline">{order.customer.email}</a> },
                  { label: "Phone", value: `+91 ${order.customer.phone}` },
                  { label: "Orders", value: `${customerOrders} total` },
                ]}
              />
              {order.userId && hasPermission(user.role, "customers:read") ? (
                <Link href={`/admin/customers/${order.userId.toHexString()}`} className="mt-3 inline-block text-sm font-semibold text-brand-green hover:underline">
                  View customer →
                </Link>
              ) : null}
              {order.customerNote ? <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm">Note: {order.customerNote}</p> : null}
            </Panel>
            <Panel title="Addresses">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Ship to</p>
                  <Address a={order.shippingAddress} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Bill to</p>
                  <Address a={order.billingAddress} />
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Payments & refunds">
            {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payment records.</p> : null}
            <ul className="space-y-3 text-sm">
              {payments.map((p) => (
                <li key={p._id.toHexString()} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {p.provider === "cod" ? "Cash on Delivery" : "Razorpay"} · {formatINR(p.amount)}
                    </p>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.razorpayOrderId ? `Order ${p.razorpayOrderId}` : ""} {p.razorpayPaymentId ? `· Payment ${p.razorpayPaymentId}` : ""} {p.method ? `· ${p.method}` : ""}
                  </p>
                  {p.errorDescription ? <p className="text-xs text-destructive">{p.errorDescription}</p> : null}
                </li>
              ))}
              {refunds.map((r) => (
                <li key={r._id.toHexString()} className="rounded-xl border border-dashed p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Refund {formatINR(r.amount)}</p>
                    <Badge variant={r.status === "failed" ? "destructive" : "outline"}>{r.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.reason} · {formatDateTime(r.createdAt)} {r.razorpayRefundId ? `· ${r.razorpayRefundId}` : ""}
                  </p>
                  {r.failureReason ? <p className="text-xs text-destructive">{r.failureReason}</p> : null}
                  {canRefund && (r.status === "pending_approval" || r.status === "failed") ? (
                    <div className="mt-2 flex gap-2">
                      <ActionButton
                        action={approveRefundAction.bind(null, r._id.toHexString(), "")}
                        size="sm"
                        variant="default"
                        confirm={{ title: `Refund ${formatINR(r.amount)}?`, description: order.paymentMethod === "cod" ? "Confirm you have paid this amount back to the customer (bank transfer / UPI)." : "This sends the refund to the customer's original payment method via Razorpay." }}
                      >
                        {r.status === "failed" ? "Retry refund" : "Approve refund"}
                      </ActionButton>
                      <ActionButton action={rejectRefundAction.bind(null, r._id.toHexString(), "Rejected by admin")} size="sm" confirm={{ title: "Reject this refund?" }}>
                        Reject
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          {returns.length ? (
            <Panel title="Return requests" actions={<Link href="/admin/returns" className="text-sm font-semibold text-brand-green">Manage returns →</Link>}>
              <ul className="space-y-2 text-sm">
                {returns.map((r) => (
                  <li key={r._id.toHexString()} className="rounded-xl border p-3">
                    <p className="font-medium">
                      {RETURN_STATUS_LABELS[r.status]} · {r.reason}
                    </p>
                    <p className="text-muted-foreground">{r.items.map((i) => `${i.productName} (${i.variantLabel}) × ${i.quantity}`).join(", ")}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Timeline">
            <ol className="space-y-3 border-l-2 border-brand-teal/30 pl-4 text-sm">
              {[...order.statusHistory].reverse().map((e, i) => (
                <li key={`${e.status}-${i}`}>
                  <p className="font-medium">{ORDER_STATUS_LABELS[e.status]}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.at)} · {e.by?.name ?? "System"}
                    {e.note && e.note !== ORDER_STATUS_LABELS[e.status] ? ` — ${e.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5">
          {canUpdate ? (
            <Panel title="Fulfilment">
              <StatusUpdater allowed={allowed} current={order.status} hasTracking={Boolean(order.shipment?.trackingNumber)} action={updateOrderStatusAction.bind(null, orderId)} />
              {canCancel ? (
                <div className="mt-4 border-t pt-4">
                  <CancelOrderDialog paid={paid} canRefund={canRefund} action={cancelOrderAdminAction.bind(null, orderId)} />
                </div>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Shipping">
            <KeyValue
              items={[
                { label: "Method", value: `${order.shippingMethod.label}` },
                { label: "Courier", value: order.shipment?.courierName ?? "—" },
                {
                  label: "Tracking",
                  value: order.shipment?.trackingUrl ? (
                    <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">
                      {order.shipment.trackingNumber ?? "Open link"}
                    </a>
                  ) : (
                    (order.shipment?.trackingNumber ?? "—")
                  ),
                },
                { label: "Shipped", value: order.shipment?.shippedAt ? formatDateTime(order.shipment.shippedAt) : "—" },
                { label: "Delivered", value: order.deliveredAt ? formatDateTime(order.deliveredAt) : "—" },
              ]}
            />
            {canUpdate ? (
              <div className="mt-4 space-y-3 border-t pt-4">
                <TrackingForm
                  initial={{ courierName: order.shipment?.courierName ?? "", trackingNumber: order.shipment?.trackingNumber ?? "", trackingUrl: order.shipment?.trackingUrl ?? "" }}
                  action={saveTrackingAction.bind(null, orderId)}
                />
                <div className="flex flex-wrap gap-2">
                  {courier && ["confirmed", "processing", "packed"].includes(order.status) ? <BookShipmentDialog defaultWeight={weight} action={bookShipmentAction.bind(null, orderId)} /> : null}
                  {shipments.some((s) => s.provider === "shiprocket" && s.trackingNumber) ? (
                    <ActionButton action={refreshTrackingAction.bind(null, orderId)}>Refresh tracking</ActionButton>
                  ) : null}
                </div>
                {!courier ? <p className="text-xs text-muted-foreground">Courier integration not configured — enter courier details manually.</p> : null}
              </div>
            ) : null}
            {shipments[0]?.events.length ? (
              <ol className="mt-4 space-y-2 border-t pt-4 text-xs">
                {[...shipments[0].events].reverse().slice(0, 8).map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.status}</span> {e.description ? `— ${e.description}` : ""}
                    <span className="block text-muted-foreground">{formatDateTime(e.at)} {e.location ? `· ${e.location}` : ""}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </Panel>

          <Panel title="Money">
            <div className="flex flex-wrap gap-2">
              {canRefund ? <RefundDialog maxRupees={refundable / 100} action={createRefundAction.bind(null, orderId)} /> : null}
              {canUpdate && !order.invoiceNumber && !["pending_payment", "cancelled"].includes(order.status) ? (
                <ActionButton action={generateInvoiceAction.bind(null, orderId)}>Issue invoice number</ActionButton>
              ) : null}
            </div>
            {!integrations.razorpay() && order.paymentMethod === "razorpay" ? <p className="mt-2 text-xs text-amber-700">Razorpay keys are not configured — online refunds will fail until they are added.</p> : null}
          </Panel>

          <Panel title="Internal notes">
            <ul className="mb-3 space-y-2 text-sm">
              {order.internalNotes.length === 0 ? <li className="text-muted-foreground">No notes yet.</li> : null}
              {[...order.internalNotes].reverse().map((n, i) => (
                <li key={i} className="rounded-lg bg-muted/60 p-2">
                  <p>{n.note}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.by?.name ?? "System"} · {formatDateTime(n.at)}
                  </p>
                </li>
              ))}
            </ul>
            <NoteForm action={addOrderNoteAction.bind(null, orderId)} />
          </Panel>
        </div>
      </div>
    </>
  );
}
