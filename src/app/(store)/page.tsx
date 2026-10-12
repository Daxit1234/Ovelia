import { JsonLd } from "@/components/shared/json-ld";
import { CombosAndKits } from "@/components/store/home/combos";
import { Hero } from "@/components/store/home/hero";
import { CategoryShowcase, FaqSection, ProductSection, PromoBanners, Testimonials, WhyChoose } from "@/components/store/home/sections";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { Reveal } from "@/components/shared/reveal";
import { getBestSellers, getCategories, getFeaturedProducts, getNewArrivals, parseShopQuery, searchProducts } from "@/lib/data/catalog";
import { getBanners, getFaqs, getPublicSettings, getStorefrontOffers, getTestimonials } from "@/lib/data/content";
import { siteUrl } from "@/lib/env";

export default async function HomePage() {
  const [settings, categories, featured, bestSellers, newArrivals, heroBanners, promoBanners, offers, kits, testimonials, faqs] = await Promise.all([
    getPublicSettings(),
    getCategories(),
    getFeaturedProducts(8),
    getBestSellers(4),
    getNewArrivals(4),
    getBanners("hero"),
    getBanners("promo"),
    getStorefrontOffers(),
    searchProducts(parseShopQuery({}, "kits-combos")),
    getTestimonials(6),
    getFaqs(true),
  ]);
  const h = settings.homepage;
  const store = settings.store;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: store.legalName || store.name,
            url: siteUrl("/"),
            logo: siteUrl("/icon.svg"),
            ...(store.supportEmail ? { email: store.supportEmail } : {}),
            ...(store.supportPhone ? { telephone: store.supportPhone } : {}),
            sameAs: Object.values(store.social).filter(Boolean),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: store.name,
            url: siteUrl("/"),
            potentialAction: {
              "@type": "SearchAction",
              target: `${siteUrl("/shop")}?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
        ]}
      />
      <Hero settings={settings} banner={heroBanners[0] ?? null} />
      <CategoryShowcase categories={categories} />
      <ProductSection eyebrow="Customer favourites" title="Featured products" description="Our most-loved everyday essentials." products={featured} href="/shop" tinted />
      <PromoBanners banners={promoBanners} />
      {h.showBestSellers ? <ProductSection eyebrow="Top picks" title="Best sellers" products={bestSellers} href="/shop?sort=best_selling" /> : null}
      {h.showBundles ? <CombosAndKits offers={offers} kits={kits.items} /> : null}
      <WhyChoose items={h.whyChoose} />
      {h.showNewArrivals ? <ProductSection eyebrow="Just landed" title="New arrivals" products={newArrivals} href="/shop?sort=newest" /> : null}
      {h.showTestimonials ? <Testimonials items={testimonials} /> : null}
      {h.showFaq ? <FaqSection faqs={faqs} /> : null}
      {h.showNewsletter ? (
        <section className="container-page pb-16">
          <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-teal to-brand-green px-6 py-12 text-white sm:px-12">
            <div className="pointer-events-none absolute -right-20 -bottom-24 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative grid items-center gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-bold sm:text-3xl">Get offers before anyone else</h2>
                <p className="text-white/80">Join the Ovelia newsletter for combo deals, new launches and practical cleaning tips.</p>
              </div>
              <NewsletterForm tone="dark" source="home" />
            </div>
          </Reveal>
        </section>
      ) : null}
    </>
  );
}
