"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { ProductImage } from "@/components/shared/product-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatINR } from "@/lib/money";
import type { ProductCardData } from "@/lib/types";

export function FrequentlyBoughtTogether({ current, others }: { current: ProductCardData; others: ProductCardData[] }) {
  const { addMany, busy } = useCart();
  const items = [current, ...others.filter((o) => o.inStock)].slice(0, 3);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  if (items.length < 2) return null;

  const chosen = items.filter((i) => selected.has(i.id));
  const variantOf = (p: ProductCardData) => p.variants.find((v) => v.id === p.defaultVariantId) ?? p.variants[0];
  const total = chosen.reduce((sum, p) => sum + (variantOf(p)?.price ?? 0), 0);

  return (
    <section aria-labelledby="fbt-heading" className="rounded-3xl border bg-white p-6 sm:p-8">
      <h2 id="fbt-heading" className="font-heading text-xl font-bold text-brand-ink">
        Frequently bought together
      </h2>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <ul className="flex flex-wrap items-center gap-3">
          {items.map((p, index) => (
            <li key={p.id} className="flex items-center gap-3">
              {index > 0 ? <Plus className="size-5 text-muted-foreground" aria-hidden /> : null}
              <Link href={`/products/${p.slug}`} className="relative block size-24 overflow-hidden rounded-2xl bg-brand-mint sm:size-28">
                {p.image ? <ProductImage src={p.image.url} alt={p.image.alt} fill sizes="112px" className="object-cover" /> : null}
              </Link>
            </li>
          ))}
        </ul>
        <div className="space-y-3 lg:w-80">
          <ul className="space-y-2">
            {items.map((p) => {
              const v = variantOf(p);
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      {p.id === current.id ? <strong>This item: </strong> : null}
                      {p.name} <span className="text-muted-foreground">({v?.label})</span>
                    </span>
                    <span className="font-semibold">{v ? formatINR(v.price) : ""}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Total for {chosen.length} item{chosen.length === 1 ? "" : "s"}</span>
            <span className="font-heading text-lg font-bold">{formatINR(total)}</span>
          </div>
          <Button
            className="w-full rounded-full"
            size="lg"
            disabled={busy || chosen.length === 0}
            onClick={() => addMany(chosen.map((p) => ({ productId: p.id, variantId: variantOf(p)!.id, quantity: 1 })))}
          >
            <ShoppingBag className="size-4" aria-hidden /> Add selected to cart
          </Button>
          <p className="text-xs text-muted-foreground">Any combo or multi-buy offers apply automatically in your cart.</p>
        </div>
      </div>
    </section>
  );
}
