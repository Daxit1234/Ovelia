import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShopSkeleton, ShopView } from "@/components/store/shop/shop-view";
import { getCategories, getCategoryBySlug, parseShopQuery } from "@/lib/data/catalog";

export async function generateStaticParams() {
  const categories = await getCategories();
  const slugs = categories.map((c) => ({ slug: c.slug }));
  return slugs.length ? slugs : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.name} — cleaning products`,
    description: category.description || `Shop Ovelia ${category.name.toLowerCase()} products online.`,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: category.image ? { images: [{ url: category.image.url, alt: category.image.alt }] } : undefined,
  };
}

async function CategoryResults({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const query = parseShopQuery(await searchParams, category.slug);
  return (
    <ShopView
      basePath={`/categories/${category.slug}`}
      query={query}
      title={category.name}
      description={category.description}
      breadcrumbs={[
        { label: "Shop", href: "/shop" },
        { label: category.name, href: `/categories/${category.slug}` },
      ]}
    />
  );
}

export default function CategoryPage(props: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <CategoryResults {...props} />
    </Suspense>
  );
}
