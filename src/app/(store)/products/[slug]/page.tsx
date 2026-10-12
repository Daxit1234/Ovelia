import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, CheckCircle2, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { JsonLd } from "@/components/shared/json-ld";
import { RatingStars } from "@/components/shared/rating-stars";
import { RichText } from "@/components/shared/rich-text";
import { FrequentlyBoughtTogether } from "@/components/store/product/fbt";
import { ProductGallery } from "@/components/store/product/gallery";
import { PurchasePanel } from "@/components/store/product/purchase-panel";
import { ProductReviews } from "@/components/store/product/reviews";
import { ProductGrid } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/home/sections";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProductBySlug, getProductSitemapEntries, getProductsByIds, getRelatedProducts } from "@/lib/data/catalog";
import { getPublicSettings } from "@/lib/data/content";
import { siteUrl } from "@/lib/env";
import { formatINR } from "@/lib/money";

export async function generateStaticParams() {
  const products = await getProductSitemapEntries();
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const title = product.seo.title || product.name;
  const description = product.seo.description || product.shortDescription;
  const image = product.images[0];
  return {
    title: { absolute: title.includes("Ovelia") ? title : `${title} | Ovelia` },
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/products/${product.slug}`,
      images: image ? [{ url: image.url, alt: image.alt }] : undefined,
    },
  };
}

function DetailTabs({ product, shippingSummary, returnsSummary }: { product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>; shippingSummary: string; returnsSummary: string }) {
  const tabs = [
    { id: "description", label: "Description", show: Boolean(product.description) },
    { id: "usage", label: "How to use", show: Boolean(product.usageInstructions) },
    { id: "specs", label: "Specifications", show: true },
    { id: "safety", label: "Safety & ingredients", show: Boolean(product.safetyInformation || product.ingredients) },
    { id: "shipping", label: "Shipping & returns", show: true },
  ].filter((t) => t.show);
  const variantList = product.variants.map((v) => v.label).join(", ");
  return (
    <Tabs defaultValue={tabs[0].id} className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-muted/70 p-1">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="rounded-xl px-4 py-2 data-[state=active]:bg-white">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="rounded-3xl border bg-white p-6 sm:p-8">
        <TabsContent value="description">
          <RichText text={product.description} />
        </TabsContent>
        <TabsContent value="usage">
          <RichText text={product.usageInstructions} />
        </TabsContent>
        <TabsContent value="specs">
          <table className="w-full max-w-2xl text-sm">
            <tbody className="divide-y">
              {[
                ...product.specifications,
                { label: "Available sizes", value: variantList },
                { label: "Brand", value: "Ovelia" },
                ...(product.hsnCode ? [{ label: "HSN code", value: product.hsnCode }] : []),
              ].map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="w-48 py-3 pr-4 text-left font-medium text-muted-foreground">
                    {row.label}
                  </th>
                  <td className="py-3 text-brand-ink">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
        <TabsContent value="safety" className="space-y-6">
          {product.safetyInformation ? (
            <div>
              <h3 className="mb-2 font-heading font-semibold">Safety information</h3>
              <RichText text={product.safetyInformation} />
            </div>
          ) : null}
          {product.ingredients ? (
            <div>
              <h3 className="mb-2 font-heading font-semibold">Ingredients</h3>
              <RichText text={product.ingredients} />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Always read the label before use. Keep cleaning products out of reach of children and pets.</p>
        </TabsContent>
        <TabsContent value="shipping" className="space-y-5">
          <div>
            <h3 className="mb-2 font-heading font-semibold">Shipping</h3>
            <RichText text={product.shippingInfo || shippingSummary} />
          </div>
          <div>
            <h3 className="mb-2 font-heading font-semibold">Returns</h3>
            <RichText text={product.returnInfo || returnsSummary} />
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}

async function ProductContent({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [settings, related, together] = await Promise.all([
    getPublicSettings(),
    getRelatedProducts(product.id, product.categoryId, product.relatedIds, 4),
    getProductsByIds(product.frequentlyBoughtTogetherIds),
  ]);
  const threshold = settings.shipping.freeShippingThreshold;
  const shippingSummary = [
    settings.shipping.processingTime,
    `${settings.shipping.standardLabel}: ${settings.shipping.standardFee === 0 ? "free" : formatINR(settings.shipping.standardFee)} (${settings.shipping.standardEta.toLowerCase()}).`,
    threshold !== null ? `Free standard delivery on orders of ${formatINR(threshold)} or more.` : "",
    "See our [Shipping Policy](/policies/shipping) for details.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const returnsSummary = settings.orders.returnsEnabled
    ? `Damaged, leaking or incorrect items can be reported within ${settings.orders.returnWindowDays} days of delivery for a replacement or refund. Opened products can't be returned unless defective. See our [Return & Refund Policy](/policies/returns).`
    : "Please see our [Return & Refund Policy](/policies/returns).";

  const prices = product.variants.map((v) => v.price);
  const category = product.categoryPath.at(-1);
  const absoluteImages = product.images.map((img) => (img.url.startsWith("http") ? img.url : siteUrl(img.url)));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.shortDescription || product.description.slice(0, 300),
          image: absoluteImages,
          sku: product.variants[0]?.sku,
          brand: { "@type": "Brand", name: "Ovelia" },
          category: category?.name,
          offers:
            product.variants.length > 1
              ? {
                  "@type": "AggregateOffer",
                  priceCurrency: "INR",
                  lowPrice: (Math.min(...prices) / 100).toFixed(2),
                  highPrice: (Math.max(...prices) / 100).toFixed(2),
                  offerCount: product.variants.length,
                  availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  url: siteUrl(`/products/${product.slug}`),
                }
              : {
                  "@type": "Offer",
                  priceCurrency: "INR",
                  price: ((product.variants[0]?.price ?? 0) / 100).toFixed(2),
                  availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  url: siteUrl(`/products/${product.slug}`),
                  itemCondition: "https://schema.org/NewCondition",
                },
          ...(product.ratingCount > 0
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAverage, reviewCount: product.ratingCount } }
            : {}),
        }}
      />
      <div className="container-page py-6 sm:py-8">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
            { label: product.name },
          ]}
        />
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <ProductGallery images={product.images} name={product.name} />
          <div className="space-y-6">
            <div className="space-y-3">
              {category ? (
                <Link href={`/categories/${category.slug}`} className="eyebrow hover:underline">
                  {category.name}
                </Link>
              ) : null}
              <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-tight text-brand-ink sm:text-4xl">{product.name}</h1>
              {product.ratingCount > 0 ? (
                <a href="#reviews" className="inline-flex items-center gap-2 text-sm hover:underline">
                  <RatingStars value={product.ratingAverage} />
                  <span className="text-muted-foreground">
                    {product.ratingAverage.toFixed(1)} · {product.ratingCount} review{product.ratingCount === 1 ? "" : "s"}
                  </span>
                </a>
              ) : null}
              {product.shortDescription ? <p className="text-[15px] leading-7 text-muted-foreground">{product.shortDescription}</p> : null}
            </div>
            <PurchasePanel product={product} maxPerOrder={settings.orders.maxQuantityPerItem} />
            {product.highlights.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-brand-ink/85">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="grid grid-cols-2 gap-3 border-t pt-5 text-xs sm:grid-cols-4">
              {[
                { icon: ShieldCheck, label: "Secure payments" },
                { icon: Truck, label: threshold !== null ? `Free delivery over ${formatINR(threshold)}` : "Tracked delivery" },
                { icon: BadgeCheck, label: settings.payments.codEnabled ? "COD available" : "UPI & cards" },
                { icon: RotateCcw, label: "Easy help on damaged items" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-brand-mint/60 p-3 text-center font-medium text-brand-ink/80">
                  <Icon className="size-5 text-brand-teal" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 space-y-14">
          <DetailTabs product={product} shippingSummary={shippingSummary} returnsSummary={returnsSummary} />
          <FrequentlyBoughtTogether current={product} others={together} />
          <ProductReviews
            productId={product.id}
            productName={product.name}
            slug={product.slug}
            ratingAverage={product.ratingAverage}
            ratingCount={product.ratingCount}
            reviewsEnabled={product.reviewsEnabled}
          />
          {related.length ? (
            <section>
              <SectionHeading eyebrow="You may also like" title="Related products" href={category ? `/categories/${category.slug}` : "/shop"} />
              <ProductGrid products={related} />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading product">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage(props: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={props.params} />
    </Suspense>
  );
}
