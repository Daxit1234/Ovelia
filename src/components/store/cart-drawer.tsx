"use client";

import Link from "next/link";
import { ShoppingBag, Trash2, Truck } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { ProductImage } from "@/components/shared/product-image";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatINR } from "@/lib/money";
import type { CartView } from "@/lib/types";

export function FreeShippingMeter({ cart }: { cart: CartView }) {
  const { threshold, remaining, qualified } = cart.freeShipping;
  if (threshold === null || cart.lines.length === 0) return null;
  const pct = qualified ? 100 : Math.min(100, Math.round(((threshold - remaining) / threshold) * 100));
  return (
    <div className="rounded-xl bg-brand-mint p-3">
      <p className="flex items-center gap-2 text-sm text-brand-ink">
        <Truck className="size-4 text-brand-teal" aria-hidden />
        {qualified ? (
          <span>
            You&apos;ve unlocked <strong>free standard delivery</strong>.
          </span>
        ) : (
          <span>
            Add <strong>{formatINR(remaining)}</strong> more for free standard delivery.
          </span>
        )}
      </p>
      <Progress value={pct} className="mt-2 h-1.5" aria-label="Progress towards free delivery" />
    </div>
  );
}

export function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen, update, remove, busy } = useCart();
  const empty = cart.lines.length === 0;
  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-heading text-lg">Your cart</SheetTitle>
          <SheetDescription>{empty ? "Your cart is empty" : `${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}</SheetDescription>
        </SheetHeader>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-brand-mint">
              <ShoppingBag className="size-7 text-brand-green" aria-hidden />
            </span>
            <p className="font-heading text-lg font-semibold">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">Discover dishwash, floor, bathroom and car care essentials.</p>
            <Button asChild size="lg" onClick={() => setDrawerOpen(false)}>
              <Link href="/shop">Start shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <FreeShippingMeter cart={cart} />
              <ul className="divide-y">
                {cart.lines.map((line) => (
                  <li key={line.variantId} className="flex gap-3 py-4">
                    <Link
                      href={line.slug ? `/products/${line.slug}` : "#"}
                      onClick={() => setDrawerOpen(false)}
                      className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-mint"
                    >
                      {line.image ? <ProductImage src={line.image.url} alt={line.image.alt} fill sizes="80px" className="object-contain" /> : null}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-brand-ink">{line.name}</p>
                          <p className="text-xs text-muted-foreground">{line.variantLabel}</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          onClick={() => remove(line.variantId)}
                          disabled={busy}
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      {line.issue ? <p className="text-xs font-medium text-destructive">{line.issue}</p> : null}
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          max={Math.max(line.quantity, line.maxQuantity)}
                          disabled={busy || !line.available}
                          onChange={(q) => update(line.variantId, q)}
                          label={`Quantity for ${line.name}`}
                        />
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatINR(line.lineTotal || line.unitPrice * line.quantity)}</p>
                          {line.discount > 0 ? <p className="text-xs text-emerald-700">−{formatINR(line.discount)} offer</p> : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <SheetFooter className="gap-3 border-t bg-muted/40 px-5 py-4">
              {cart.totals.discountTotal > 0 ? (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Offers applied</span>
                  <span>−{formatINR(cart.totals.discountTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-semibold">
                <span>Subtotal</span>
                <span>{formatINR(cart.totals.merchandiseTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Shipping and any COD fee are calculated at checkout. Prices include GST.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="lg" onClick={() => setDrawerOpen(false)}>
                  <Link href="/cart">View cart</Link>
                </Button>
                <Button asChild size="lg" onClick={() => setDrawerOpen(false)} disabled={!cart.canCheckout}>
                  <Link href={cart.canCheckout ? "/checkout" : "/cart"}>Checkout</Link>
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
