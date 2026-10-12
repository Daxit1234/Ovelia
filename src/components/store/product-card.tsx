"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { Price } from "@/components/shared/price";
import { ProductImage } from "@/components/shared/product-image";
import { RatingStars } from "@/components/shared/rating-stars";
import { Button } from "@/components/ui/button";
import { discountPercent } from "@/lib/money";
import type { ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const { add, busy } = useCart();
  const [variantId, setVariantId] = useState(product.defaultVariantId);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const percent = variant ? discountPercent(variant.mrp, variant.price) : 0;
  const href = `/products/${product.slug}`;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-teal/40 hover:shadow-[0_18px_40px_-24px_rgba(11,77,59,0.45)]">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-brand-mint" aria-label={product.name}>
        {product.image ? (
          <ProductImage
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
            className={cn("object-cover transition-all duration-500 group-hover:scale-[1.04]", product.hoverImage && "group-hover:opacity-0")}
            priority={priority}
          />
        ) : null}
        {product.hoverImage ? (
          <ProductImage
            src={product.hoverImage.url}
            alt=""
            fill
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        ) : null}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {percent > 0 ? <span className="rounded-full bg-brand-green px-2.5 py-1 text-[11px] font-bold text-white">{percent}% OFF</span> : null}
          {product.isBestSeller ? <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-green shadow-sm">Bestseller</span> : null}
          {product.isNewArrival ? <span className="rounded-full bg-brand-blue px-2.5 py-1 text-[11px] font-semibold text-white">New</span> : null}
        </div>
        {!product.inStock ? (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/95 py-1.5 text-center text-xs font-semibold text-destructive">Out of stock</span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.categoryName ? <p className="text-[11px] font-semibold tracking-[0.14em] text-brand-teal uppercase">{product.categoryName}</p> : null}
        <h3 className="line-clamp-2 min-h-10 text-[15px] leading-5 font-semibold text-brand-ink">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {product.ratingCount > 0 ? <RatingStars value={product.ratingAverage} count={product.ratingCount} /> : null}

        {product.variants.length > 1 ? (
          <div className="relative z-10 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Size for ${product.name}`}>
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variant?.id}
                onClick={() => setVariantId(v.id)}
                disabled={!v.inStock}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-50",
                  v.id === variant?.id ? "border-brand-green bg-brand-green text-white" : "border-border bg-white text-brand-ink hover:border-brand-teal",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : variant ? (
          <p className="text-xs text-muted-foreground">{variant.label}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          {variant ? <Price price={variant.price} mrp={variant.mrp} size="sm" /> : null}
          <Button
            size="icon-lg"
            className="relative z-10 shrink-0 rounded-full"
            disabled={busy || !variant?.inStock}
            onClick={() => variant && add({ productId: product.id, variantId: variant.id, quantity: 1 })}
            aria-label={variant?.inStock ? `Add ${product.name} ${variant.label} to cart` : `${product.name} is out of stock`}
          >
            <ShoppingBag className="size-5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard product={product} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
