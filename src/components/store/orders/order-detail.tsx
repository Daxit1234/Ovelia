import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, FileText, PackageCheck, Truck } from "lucide-react";
import { CancelOrderButton, PaymentConfirmationPoller, RetryPaymentButton, ReturnRequestButton } from "@/components/store/orders/order-actions";
import { ProductImage } from "@/components/shared/product-image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CustomerOrderView } from "@/lib/data/orders";
import { TRACKING_STEPS, trackingStepIndex } from "@/lib/domain/order-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

function statusTone(status: CustomerOrderView["status"]): string {
  if (status === "delivered") return "bg-emerald-100 text-emerald-800";
  if (status === "cancelled" || status === "rto_delivered" || status === "returned") return "bg-rose-100 text-rose-800";
  if (status === "pending_payment" || status === "on_hold" || status === "delivery_failed") return "bg-amber-100 text-amber-900";
  return "bg-brand-mint text-brand-green";
}

function Address({ title, a }: { title: string; a: CustomerOrderView["shippingAddress"] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-brand-ink">{title}</h3>
      <address className="text-sm leading-6 text-muted-foreground not-italic">
        {a.fullName}
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
    </div>
  );
}

export function OrderDetail({ order, token, placed, storeName, invoiceHref }: { order: CustomerOrderView; token: string | null; placed: boolean; storeName: string; invoiceHref: string | null }) {
  const step = trackingStepIndex(order.status);
  const exceptional = ["cancelled", "returned", "rto_initiated", "rto_delivered", "on_hold", "delivery_failed"].includes(order.status);
  const awaitingConfirmation = placed && order.status === "pending_payment" && order.paymentStatus !== "failed";
  const returnable = order.items
    .map((i) => ({ id: i.id, productName: i.productName, variantLabel: i.variantLabel, maxQuantity: i.quantity - i.returnedQuantity }))
    .filter((i) => i.maxQuantity > 0);

  return (
    <div className="space-y-6">
      <PaymentConfirmationPoller active={awaitingConfirmation} />

      {placed && order.status !== "pending_payment" && order.status !== "cancelled" ? (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-gradient-to-br from-brand-green to-brand-teal p-6 text-white sm:flex-row sm:items-center">
          <CheckCircle2 className="size-10 shrink-0 text-brand-teal-light" aria-hidden />
          <div>
            <h2 className="font-heading text-2xl font-bold">Thank you! Your order is confirmed.</h2>
            <p className="mt-1 text-white/85">
              Order <strong>{order.orderNumber}</strong> — we&apos;ve emailed the details to {order.customer.email}.
              {order.paymentMethod === "cod" ? ` Please keep ${formatINR(order.pricing.grandTotal)} ready at delivery.` : ""}
            </p>
          </div>
        </div>
      ) : null}

      {awaitingConfirmation ? (
        <Alert>
          <PackageCheck className="size-4" />
          <AlertTitle>Confirming your payment…</AlertTitle>
          <AlertDescription>This usually takes a few seconds. This page will update automatically — please don&apos;t pay again.</AlertDescription>
        </Alert>
      ) : null}

      {order.status === "pending_payment" && !awaitingConfirmation ? (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="size-4 text-amber-700" />
          <AlertTitle>Payment pending</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {order.paymentStatus === "failed" ? "Your last payment attempt did not go through. " : "We haven't received payment for this order yet. "}
              {order.paymentWindowEndsAt ? `Items are reserved until ${formatDateTime(order.paymentWindowEndsAt)}.` : null}
            </p>
            {order.canRetryPayment ? <RetryPaymentButton orderNumber={order.orderNumber} token={token} storeName={storeName} /> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Order number</p>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-brand-ink">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Placed on {formatDateTime(order.placedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("h-7 rounded-full px-3 text-sm", statusTone(order.status))}>{order.statusLabel}</Badge>
            <Badge variant="outline" className="h-7 rounded-full px-3 text-sm">
              {order.paymentStatusLabel}
            </Badge>
          </div>
        </div>

        {!exceptional && step >= 0 ? (
          <ol className="mt-8 grid grid-cols-5 gap-1" aria-label="Order progress">
            {TRACKING_STEPS.map((s, i) => {
              const done = step >= i;
              return (
                <li key={s.status} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex w-full items-center">
                    <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : step >= i ? "bg-brand-green" : "bg-border")} />
                    {done ? <CheckCircle2 className="size-7 shrink-0 text-brand-green" aria-hidden /> : <Circle className="size-7 shrink-0 text-border" aria-hidden />}
                    <span className={cn("h-0.5 flex-1", i === TRACKING_STEPS.length - 1 ? "bg-transparent" : step > i ? "bg-brand-green" : "bg-border")} />
                  </div>
                  <span className={cn("text-xs sm:text-sm", done ? "font-semibold text-brand-ink" : "text-muted-foreground")}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        ) : null}

        {exceptional ? (
          <Alert className="mt-6">
            <AlertTriangle className="size-4" />
            <AlertTitle>{order.statusLabel}</AlertTitle>
            <AlertDescription>
              {order.status === "cancelled"
                ? `This order was cancelled${order.cancellation.reason ? `: ${order.cancellation.reason}` : "."}`
                : order.status === "delivery_failed"
                  ? "The courier couldn't deliver your order. They will usually try again — please keep your phone reachable."
                  : order.status === "on_hold"
                    ? "Your order is on hold while our team checks something. We'll contact you if we need anything."
                    : "Your order is on its way back to us. We'll contact you about next steps."}
            </AlertDescription>
          </Alert>
        ) : null}

        {order.cancellation.status === "requested" ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Your cancellation request is being reviewed.</p>
        ) : null}
        {order.cancellation.status === "rejected" ? (
          <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm">Cancellation request declined{order.cancellation.note ? `: ${order.cancellation.note}` : "."}</p>
        ) : null}

        {order.shipment.trackingNumber || order.shipment.courierName ? (
          <div className="mt-6 rounded-2xl bg-brand-mint/60 p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Truck className="size-4 text-brand-teal" aria-hidden />
              <span className="font-semibold">{order.shipment.courierName ?? "Courier"}</span>
              {order.shipment.trackingNumber ? <span className="text-muted-foreground">· Tracking no. {order.shipment.trackingNumber}</span> : null}
              {order.shipment.trackingUrl ? (
                <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-green underline">
                  Track with courier <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </p>
            {order.shipment.events.length ? (
              <ol className="mt-3 space-y-2 border-l-2 border-brand-teal/30 pl-4 text-sm">
                {order.shipment.events.slice(0, 8).map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <p className="font-medium">{e.description || e.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.at)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {order.cancelMode ? <CancelOrderButton orderNumber={order.orderNumber} token={token} mode={order.cancelMode} /> : null}
          {order.returnWindow.eligible && returnable.length ? <ReturnRequestButton orderNumber={order.orderNumber} token={token} items={returnable} /> : null}
          {invoiceHref && order.invoiceNumber ? (
            <Button variant="outline" asChild>
              <Link href={invoiceHref} target="_blank">
                <FileText className="size-4" /> Invoice
              </Link>
            </Button>
          ) : null}
          <Button variant="ghost" asChild>
            <Link href={`/contact?order=${encodeURIComponent(order.orderNumber)}`}>Need help?</Link>
          </Button>
        </div>
        {order.status === "delivered" && order.returnWindow.deadline && order.returnWindow.eligible ? (
          <p className="mt-2 text-xs text-muted-foreground">Return window open until {formatDate(order.returnWindow.deadline)}.</p>
        ) : null}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border bg-white p-5 sm:p-7" aria-labelledby="items-heading">
          <h2 id="items-heading" className="font-heading text-lg font-bold">
            Items
          </h2>
          <ul className="mt-4 divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                <Link href={`/products/${item.productSlug}`} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-brand-mint">
                  {item.image ? <ProductImage src={item.image} alt={item.productName} fill sizes="80px" className="object-cover" /> : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.productSlug}`} className="font-semibold text-brand-ink hover:text-brand-green">
                    {item.productName}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {item.variantLabel} · Qty {item.quantity} · {formatINR(item.unitPrice)} each
                  </p>
                  {item.returnedQuantity > 0 ? <p className="text-xs text-amber-800">{item.returnedQuantity} returned</p> : null}
                  {order.status === "delivered" && !item.reviewed ? (
                    <Link href={`/products/${item.productSlug}#reviews`} className="mt-1 inline-block text-sm font-semibold text-brand-green underline">
                      Write a review
                    </Link>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatINR(item.lineTotal)}</p>
                  {item.discount > 0 ? <p className="text-xs text-emerald-700">−{formatINR(item.discount)} offer</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-6 rounded-3xl border bg-white p-5 sm:p-7">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Items total (MRP)</dt>
              <dd>{formatINR(order.pricing.mrpTotal)}</dd>
            </div>
            {order.pricing.mrpTotal > order.pricing.subtotal ? (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount on MRP</dt>
                <dd>−{formatINR(order.pricing.mrpTotal - order.pricing.subtotal)}</dd>
              </div>
            ) : null}
            {order.appliedPromotions
              .filter((p) => !p.freeShipping && p.amount > 0)
              .map((p) => (
                <div key={p.name} className="flex justify-between text-emerald-700">
                  <dt>{p.code ? `Coupon ${p.code}` : p.name}</dt>
                  <dd>−{formatINR(p.amount)}</dd>
                </div>
              ))}
            <div className="flex justify-between">
              <dt>Shipping ({order.shippingMethod.label})</dt>
              <dd>{order.pricing.shippingFee === 0 ? "Free" : formatINR(order.pricing.shippingFee)}</dd>
            </div>
            {order.pricing.codFee > 0 ? (
              <div className="flex justify-between">
                <dt>COD fee</dt>
                <dd>{formatINR(order.pricing.codFee)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatINR(order.pricing.grandTotal)}</dd>
            </div>
            <p className="text-xs text-muted-foreground">Includes GST of {formatINR(order.pricing.taxTotal)}</p>
            {order.pricing.amountRefunded > 0 ? (
              <div className="flex justify-between text-sm text-brand-teal">
                <dt>Refunded</dt>
                <dd>{formatINR(order.pricing.amountRefunded)}</dd>
              </div>
            ) : null}
          </dl>
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">Payment</h3>
            <p className="text-sm text-muted-foreground">{order.paymentMethodLabel}</p>
          </div>
          <Address title="Delivery address" a={order.shippingAddress} />
          {JSON.stringify(order.billingAddress) !== JSON.stringify(order.shippingAddress) ? <Address title="Billing address" a={order.billingAddress} /> : null}
        </aside>
      </div>

      {order.returns.length || order.refunds.length ? (
        <section className="rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-lg font-bold">Returns &amp; refunds</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {order.returns.map((r) => (
              <li key={r.id} className="rounded-xl border p-3">
                <p className="font-semibold">
                  Return {r.statusLabel.toLowerCase()} · {formatDate(r.createdAt)}
                </p>
                <p className="text-muted-foreground">
                  {r.items.map((i) => `${i.productName} (${i.variantLabel}) × ${i.quantity}`).join(", ")} — {r.reason}
                </p>
              </li>
            ))}
            {order.refunds.map((r) => (
              <li key={r.id} className="rounded-xl border p-3">
                <p className="font-semibold">
                  Refund of {formatINR(r.amount)} · {r.status.replace(/_/g, " ")}
                </p>
                <p className="text-muted-foreground">{formatDate(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
