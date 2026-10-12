import Link from "next/link";
import { ArrowRight, BadgeCheck, Droplet, Heart, Home, Leaf, MessageSquareQuote, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { ProductImage } from "@/components/shared/product-image";
import { RatingStars } from "@/components/shared/rating-stars";
import { Reveal } from "@/components/shared/reveal";
import { ProductGrid } from "@/components/store/product-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { BannerView, FaqView, PublicSettings, TestimonialView } from "@/lib/data/content";
import type { CategoryView, ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, description, href, linkLabel = "View all" }: { eyebrow?: string; title: string; description?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green hover:text-brand-teal">
          {linkLabel} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function CategoryShowcase({ categories }: { categories: CategoryView[] }) {
  const visible = categories.filter((c) => !c.parentId && c.productCount > 0);
  if (visible.length === 0) return null;
  return (
    <section className="container-page py-14 sm:py-16" aria-labelledby="categories-heading">
      <Reveal>
        <SectionHeading eyebrow="Shop by need" title="Care for every corner" description="From the kitchen sink to the car porch — find the right cleaner for the job." href="/shop" linkLabel="Browse all products" />
      </Reveal>
      <h2 id="categories-heading" className="sr-only">
        Product categories
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {visible.map((category, i) => (
          <Reveal as="li" key={category.id} delay={i * 50}>
            <Link
              href={`/categories/${category.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px_rgba(11,77,59,0.5)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-mint">
                {category.image ? (
                  <ProductImage src={category.image.url} alt={category.image.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-heading text-[15px] font-bold text-brand-ink sm:text-base">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.productCount} product{category.productCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-mint text-brand-green transition-colors group-hover:bg-brand-green group-hover:text-white">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export function ProductSection({
  eyebrow,
  title,
  description,
  products,
  href,
  tinted = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  products: ProductCardData[];
  href?: string;
  tinted?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className={cn(tinted && "bg-brand-mint/60")}>
      <div className="container-page py-14 sm:py-16">
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} description={description} href={href} />
        </Reveal>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}

const THEMES: Record<BannerView["theme"], string> = {
  green: "bg-gradient-to-br from-brand-green to-[#0d6a52] text-white",
  teal: "bg-gradient-to-br from-brand-teal to-[#0b6f63] text-white",
  blue: "bg-gradient-to-br from-[#1e4fd1] to-[#3b82f6] text-white",
  light: "bg-brand-sky text-brand-ink",
};

export function PromoBanners({ banners }: { banners: BannerView[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="container-page py-6" aria-label="Current offers">
      <div className="grid gap-5 lg:grid-cols-2">
        {banners.slice(0, 2).map((banner, i) => (
          <Reveal key={banner.id} delay={i * 80}>
            <div className={cn("relative grid h-full min-h-64 overflow-hidden rounded-3xl sm:grid-cols-[1.15fr_1fr]", THEMES[banner.theme])}>
              <div className="relative z-10 flex flex-col justify-center gap-3 p-7 sm:p-9">
                {banner.eyebrow ? <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-80">{banner.eyebrow}</p> : null}
                <h3 className="font-heading text-2xl leading-tight font-extrabold sm:text-[1.75rem]">{banner.title}</h3>
                {banner.subtitle ? <p className="text-sm leading-6 opacity-85">{banner.subtitle}</p> : null}
                <div>
                  <Button asChild size="lg" variant="secondary" className="mt-2 rounded-full bg-white text-brand-green hover:bg-white/90">
                    <Link href={banner.ctaHref}>
                      {banner.ctaLabel} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
              {banner.imageUrl ? (
                <div className="relative hidden min-h-56 sm:block">
                  <ProductImage src={banner.imageUrl} alt={banner.imageAlt} fill sizes="(min-width: 1024px) 25vw, 40vw" className="object-cover" />
                </div>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const ICONS = { sparkles: Sparkles, leaf: Leaf, shield: ShieldCheck, truck: Truck, badge: BadgeCheck, heart: Heart, droplet: Droplet, home: Home };

export function WhyChoose({ items }: { items: PublicSettings["homepage"]["whyChoose"] }) {
  if (items.length === 0) return null;
  return (
    <section className="relative overflow-hidden bg-brand-green text-white">
      <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-brand-teal/30 blur-3xl" aria-hidden />
      <div className="container-page relative py-16">
        <Reveal className="mb-10 max-w-2xl space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-teal-light uppercase">Why Ovelia</p>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Cleaning essentials you can count on</h2>
        </Reveal>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Sparkles;
            return (
              <Reveal as="li" key={item.title} delay={i * 70} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <span className="grid size-11 place-items-center rounded-xl bg-white/10">
                  <Icon className="size-5 text-brand-teal-light" aria-hidden />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/75">{item.description}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Testimonials({ items }: { items: TestimonialView[] }) {
  return (
    <section className="container-page py-16" aria-labelledby="reviews-heading">
      <Reveal>
        <div className="mb-8 max-w-2xl space-y-2">
          <p className="eyebrow">Customer voices</p>
          <h2 id="reviews-heading" className="section-title">
            What customers say
          </h2>
        </div>
      </Reveal>
      {items.length === 0 ? (
        <Reveal className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-brand-teal/40 bg-brand-mint/50 px-6 py-12 text-center">
          <MessageSquareQuote className="size-10 text-brand-teal" aria-hidden />
          <p className="font-heading text-xl font-bold text-brand-ink">Reviews from verified buyers will appear here</p>
          <p className="max-w-lg text-sm text-muted-foreground">
            We only show genuine reviews from customers who received their order. Tried an Ovelia product? Share your experience from your order page.
          </p>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href="/shop">Shop the range</Link>
          </Button>
        </Reveal>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <Reveal as="li" key={t.id} delay={i * 60} className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-[0_10px_30px_-24px_rgba(11,77,59,0.5)]">
              {t.rating ? <RatingStars value={t.rating} /> : null}
              <blockquote className="flex-1 text-[15px] leading-7 text-brand-ink/90">“{t.quote}”</blockquote>
              <footer className="text-sm">
                <p className="font-semibold text-brand-ink">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[t.location, t.productName, t.verified ? "Verified buyer" : null].filter(Boolean).join(" · ")}
                </p>
              </footer>
            </Reveal>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FaqSection({ faqs, title = "Frequently asked questions", showAllLink = true }: { faqs: FaqView[]; title?: string; showAllLink?: boolean }) {
  if (faqs.length === 0) return null;
  return (
    <section className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.6fr]" aria-labelledby="faq-heading">
      <Reveal className="space-y-3">
        <p className="eyebrow">Help centre</p>
        <h2 id="faq-heading" className="section-title">
          {title}
        </h2>
        <p className="text-muted-foreground">Can&apos;t find what you&apos;re looking for? Our team is happy to help.</p>
        <div className="flex flex-wrap gap-3 pt-2">
          {showAllLink ? (
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/faq">All FAQs</Link>
            </Button>
          ) : null}
          <Button asChild className="rounded-full">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </Reveal>
      <Accordion type="single" collapsible className="rounded-2xl border bg-white px-5">
        {faqs.map((faq) => (
          <AccordionItem key={faq.id} value={faq.id}>
            <AccordionTrigger className="text-left text-[15px] font-semibold">{faq.question}</AccordionTrigger>
            <AccordionContent className="text-[15px] leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
