import Link from "next/link";
import { ArrowRight, BadgeCheck, ShieldCheck, Truck } from "lucide-react";
import { ProductImage } from "@/components/shared/product-image";
import { Button } from "@/components/ui/button";
import type { BannerView, PublicSettings } from "@/lib/data/content";
import { formatINR } from "@/lib/money";

export function Hero({ settings, banner }: { settings: PublicSettings; banner: BannerView | null }) {
  const h = settings.homepage;
  const title = banner?.title || h.heroTitle;
  const subtitle = banner?.subtitle || h.heroSubtitle;
  const eyebrow = banner?.eyebrow || h.heroEyebrow;
  const ctaLabel = banner?.ctaLabel || h.heroCtaLabel;
  const ctaHref = banner?.ctaHref || h.heroCtaHref;
  const image = banner?.imageUrl || "/images/hero/hero-products.svg";
  const threshold = settings.shipping.freeShippingThreshold;

  const trust = [
    { icon: ShieldCheck, label: "Secure checkout with Razorpay" },
    ...(settings.payments.codEnabled ? [{ icon: BadgeCheck, label: "Cash on Delivery available" }] : []),
    ...(threshold !== null ? [{ icon: Truck, label: `Free delivery above ${formatINR(threshold)}` }] : []),
  ];

  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="container-page grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div className="animate-rise space-y-6">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-brand-ink sm:text-5xl lg:text-[3.6rem]">
            {title}
          </h1>
          {subtitle ? <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">{subtitle}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="xl">
              <Link href={ctaHref}>
                {ctaLabel} <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="border-brand-green/25 bg-white/70">
              <Link href="/offers">View offers</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-brand-ink/80">
                <Icon className="size-4 text-brand-teal" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute inset-[8%] -z-0 rounded-full bg-brand-teal-light/25 blur-3xl" aria-hidden />
          <div className="animate-float relative aspect-[900/760]">
            <ProductImage src={image} alt={banner?.imageAlt || "Ovelia dishwash, floor cleaner, kitchen cleaner, toilet cleaner and car shampoo"} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
          </div>
        </div>
      </div>
    </section>
  );
}
