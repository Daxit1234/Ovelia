"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { FreeShippingMeter } from "@/components/store/cart-drawer";
import { useCart } from "@/components/store/cart-context";
import { CouponBox, TotalsList } from "@/components/store/cart/order-summary";
import { ProductImage } from "@/components/shared/product-image";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/money";

export function CartPageClient() {
  const { cart, ready, busy, update, remove } = useCart();

  if (!ready) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]" aria-busy="true">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-brand-mint/40 px-6 py-16 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-white shadow-sm">
          <ShoppingBag className="size-9 text-brand-green" aria-hidden />
        </span>
        <h2 className="font-heading text-2xl font-bold">Your cart is empty</h2>
        <p className="max-w-md text-muted-foreground">Looks like you haven&apos;t added anything yet. Explore our cleaning essentials and combo offers.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/shop">Start shopping</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link href="/offers">View offers</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {cart.issues.length ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Please review your cart</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {cart.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <FreeShippingMeter cart={cart} />
        <ul className="divide-y rounded-3xl border bg-white">
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex gap-4 p-4 sm:p-5">
              <Link href={line.slug ? `/products/${line.slug}` : "#"} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-brand-mint sm:size-28">
                {line.image ? <ProductImage src={line.image.url} alt={line.image.alt} fill sizes="112px" className="object-cover" /> : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={line.slug ? `/products/${line.slug}` : "#"} className="line-clamp-2 font-semibold text-brand-ink hover:text-brand-green">
                      {line.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {line.variantLabel}
                      {line.sku ? ` · ${line.sku}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {formatINR(line.unitPrice)}
                      {line.unitMrp > line.unitPrice ? <span className="ml-2 text-muted-foreground line-through">{formatINR(line.unitMrp)}</span> : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatINR(line.available ? line.lineTotal : 0)}</p>
                    {line.discount > 0 ? <p className="text-xs text-emerald-700">Offer −{formatINR(line.discount)}</p> : null}
                  </div>
                </div>
                {line.issue ? <p className="text-sm font-medium text-destructive">{line.issue}</p> : null}
                <div className="mt-auto flex items-center justify-between gap-2">
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    max={Math.max(line.quantity, line.maxQuantity)}
                    onChange={(q) => update(line.variantId, q)}
                    disabled={busy || !line.available}
                    label={`Quantity for ${line.name}`}
                  />
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => remove(line.variantId)} disabled={busy}>
                    <Trash2 className="size-4" aria-hidden /> Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline">
          ← Continue shopping
        </Link>
      </div>

      <aside className="space-y-4 rounded-3xl border bg-white p-6 lg:sticky lg:top-24" aria-label="Order summary">
        <h2 className="font-heading text-lg font-bold">Order summary</h2>
        <CouponBox />
        <TotalsList cart={cart} shippingNote="Standard delivery — change at checkout" />
        <Button asChild={cart.canCheckout} size="xl" className="w-full" disabled={!cart.canCheckout}>
          {cart.canCheckout ? (
            <Link href="/checkout">
              Proceed to checkout <ArrowRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <span>Resolve cart issues to continue</span>
          )}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-brand-teal" aria-hidden /> Secure checkout · UPI, cards, net banking, wallets
        </p>
      </aside>
    </div>
  );
}
