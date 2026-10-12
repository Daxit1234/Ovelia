import Link from "next/link";
import { Plus } from "lucide-react";
import { AddComboButton } from "@/components/store/add-combo-button";
import { ProductImage } from "@/components/shared/product-image";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/store/home/sections";
import { ProductCard } from "@/components/store/product-card";
import type { OfferView } from "@/lib/data/content";
import { formatINR } from "@/lib/money";
import type { ProductCardData } from "@/lib/types";

/** Combo offers (bundle promotions) plus pre-packed cleaning kits. */
export function CombosAndKits({ offers, kits }: { offers: OfferView[]; kits: ProductCardData[] }) {
  const bundles = offers.filter((o) => o.type === "bundle" && o.bundleProducts.length > 0 && o.bundlePrice);
  if (bundles.length === 0 && kits.length === 0) return null;
  return (
    <section className="bg-gradient-to-b from-brand-sky/70 to-white">
      <div className="container-page py-16">
        <Reveal>
          <SectionHeading eyebrow="Better together" title="Combos & cleaning kits" description="Bundle your essentials and save — combo prices apply automatically in your cart." href="/offers" linkLabel="See all offers" />
        </Reveal>
        <div className="grid gap-5 lg:grid-cols-2">
          {bundles.map((offer) => {
            const regular = offer.bundleProducts.reduce((sum, item) => {
              const variant = item.product.variants.find((v) => v.id === item.variantId) ?? item.product.variants[0];
              return sum + (variant?.price ?? 0) * item.quantity;
            }, 0);
            return (
              <Reveal key={offer.id} className="flex flex-col gap-5 rounded-3xl border bg-white p-6 shadow-[0_14px_40px_-30px_rgba(11,77,59,0.6)] sm:p-7">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {offer.bundleProducts.map((item, index) => {
                    const variant = item.product.variants.find((v) => v.id === item.variantId) ?? item.product.variants[0];
                    return (
                      <div key={`${item.product.id}-${index}`} className="flex items-center gap-2">
                        {index > 0 ? <Plus className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                        <Link href={`/products/${item.product.slug}`} className="flex w-32 shrink-0 flex-col items-center gap-2 text-center">
                          <span className="relative block size-28 overflow-hidden rounded-2xl bg-brand-mint">
                            {item.product.image ? <ProductImage src={item.product.image.url} alt={item.product.image.alt} fill sizes="112px" className="object-cover" /> : null}
                          </span>
                          <span className="line-clamp-2 text-xs font-semibold text-brand-ink">
                            {item.product.name} {variant ? `· ${variant.label}` : ""}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                          </span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-xl font-bold text-brand-ink">{offer.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{offer.description}</p>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="font-heading text-2xl font-extrabold text-brand-green">{formatINR(offer.bundlePrice!)}</span>
                      {regular > offer.bundlePrice! ? (
                        <>
                          <span className="text-sm text-muted-foreground line-through">{formatINR(regular)}</span>
                          <span className="text-sm font-semibold text-emerald-700">Save {formatINR(regular - offer.bundlePrice!)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <AddComboButton
                    items={offer.bundleProducts.map((item) => ({
                      productId: item.product.id,
                      variantId: item.variantId ?? item.product.defaultVariantId,
                      quantity: item.quantity,
                    }))}
                  />
                </div>
              </Reveal>
            );
          })}
        </div>
        {kits.length ? (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {kits.map((kit) => (
              <li key={kit.id}>
                <ProductCard product={kit} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
