"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Tag, TicketPercent, X } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";
import type { CartView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CouponBox() {
  const { cart, applyCoupon, removeCoupon, busy } = useCart();
  const [code, setCode] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    const applied = await applyCoupon(code.trim());
    if (applied) setCode("");
  };
  const coupon = cart.coupon;
  return (
    <div className="space-y-2">
      {cart.couponCode ? (
        <div
          className={cn(
            "flex items-start justify-between gap-2 rounded-xl border p-3 text-sm",
            coupon?.status === "applied" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
          )}
        >
          <div className="flex gap-2">
            <TicketPercent className={cn("mt-0.5 size-4 shrink-0", coupon?.status === "applied" ? "text-emerald-700" : "text-amber-700")} aria-hidden />
            <div>
              <p className="font-semibold">{cart.couponCode}</p>
              {coupon ? <p className={coupon.status === "applied" ? "text-emerald-800" : "text-amber-800"}>{coupon.message}</p> : null}
            </div>
          </div>
          <button type="button" onClick={() => removeCoupon()} disabled={busy} className="rounded p-1 hover:bg-black/5" aria-label="Remove coupon">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="coupon-code" className="sr-only">
            Coupon code
          </label>
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="coupon-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="h-10 pl-9 uppercase"
              maxLength={32}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10" disabled={busy || !code.trim()}>
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: ReactNode; value: ReactNode; tone?: "save" | "muted"; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "text-base font-bold text-brand-ink" : "text-sm", tone === "save" && "text-emerald-700", tone === "muted" && "text-muted-foreground")}>
      <dt>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

export function TotalsList({ cart, showShipping = true, shippingNote }: { cart: CartView; showShipping?: boolean; shippingNote?: string }) {
  const t = cart.totals;
  return (
    <dl className="space-y-2.5">
      <Row label={`Items (${cart.itemCount})`} value={formatINR(t.mrpTotal)} />
      {t.productSavings > 0 ? <Row label="Discount on MRP" value={`−${formatINR(t.productSavings)}`} tone="save" /> : null}
      {cart.appliedPromotions
        .filter((p) => p.amount > 0 && !p.freeShipping)
        .map((p) => (
          <Row key={p.id} label={p.code ? `Coupon ${p.code}` : p.name} value={`−${formatINR(p.amount)}`} tone="save" />
        ))}
      {showShipping ? (
        <Row
          label={
            <span>
              Shipping{shippingNote ? <span className="block text-xs text-muted-foreground">{shippingNote}</span> : null}
            </span>
          }
          value={t.shippingFee === 0 ? (t.shippingFeeBeforeDiscount > 0 ? <span className="text-emerald-700">Free</span> : "Free") : formatINR(t.shippingFee)}
        />
      ) : null}
      {t.codFee > 0 ? <Row label="Cash on Delivery fee" value={formatINR(t.codFee)} /> : null}
      <div className="border-t pt-3">
        <Row label="Total" value={formatINR(t.grandTotal)} strong />
        <p className="mt-1 text-xs text-muted-foreground">Inclusive of GST ({formatINR(t.taxTotal)})</p>
      </div>
      {t.totalSavings > 0 ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-800">You save {formatINR(t.totalSavings)} on this order</p>
      ) : null}
    </dl>
  );
}
