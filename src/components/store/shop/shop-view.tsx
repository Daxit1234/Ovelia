import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch, X } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/shared/breadcrumbs";
import { ProductGrid } from "@/components/store/product-card";
import { MobileFilters, ShopFilters, SortSelect } from "@/components/store/shop/filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategories, getShopFacets, searchProducts, SHOP_SORTS, type ShopQuery } from "@/lib/data/catalog";
import { buildShopHref, toggleValue, type ShopUrlState } from "@/lib/shop-url";
import { cn } from "@/lib/utils";

function Pagination({ basePath, state, pageCount }: { basePath: string; state: ShopUrlState; pageCount: number }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - state.page) <= 1,
  );
  const withGaps: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) withGaps.push("gap");
    withGaps.push(p);
  });
  const linkClass = "grid size-10 place-items-center rounded-full text-sm font-medium transition-colors hover:bg-brand-mint";
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1">
      {state.page > 1 ? (
        <Link href={buildShopHref(basePath, state, { page: state.page - 1 })} className={linkClass} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {withGaps.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildShopHref(basePath, state, { page: p })}
            aria-current={p === state.page ? "page" : undefined}
            className={cn(linkClass, p === state.page && "bg-brand-green text-white hover:bg-brand-green")}
          >
            {p}
          </Link>
        ),
      )}
      {state.page < pageCount ? (
        <Link href={buildShopHref(basePath, state, { page: state.page + 1 })} className={linkClass} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

function ActiveChips({ basePath, state, categoryName, showCategory }: { basePath: string; state: ShopUrlState; categoryName: string | null; showCategory: boolean }) {
  const chips: { label: string; href: string }[] = [];
  if (state.q) chips.push({ label: `“${state.q}”`, href: buildShopHref(basePath, state, { q: "" }) });
  if (showCategory && state.category && categoryName) chips.push({ label: categoryName, href: buildShopHref(basePath, state, { category: "" }) });
  if (state.minPrice !== null || state.maxPrice !== null) {
    chips.push({ label: `₹${state.minPrice ?? 0} – ${state.maxPrice !== null ? `₹${state.maxPrice}` : "any"}`, href: buildShopHref(basePath, state, { minPrice: null, maxPrice: null }) });
  }
  if (state.inStock) chips.push({ label: "In stock", href: buildShopHref(basePath, state, { inStock: false }) });
  for (const s of state.sizes) chips.push({ label: s, href: buildShopHref(basePath, state, { sizes: toggleValue(state.sizes, s) }) });
  for (const f of state.fragrances) chips.push({ label: f, href: buildShopHref(basePath, state, { fragrances: toggleValue(state.fragrances, f) }) });
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.label}>
          <Link href={chip.href} scroll={false} className="inline-flex items-center gap-1 rounded-full bg-brand-mint px-3 py-1 text-xs font-medium text-brand-green hover:bg-brand-mint/70">
            {chip.label} <X className="size-3" aria-label="Remove filter" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function ShopView({
  basePath,
  query,
  title,
  description,
  breadcrumbs,
}: {
  basePath: string;
  query: ShopQuery;
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
}) {
  const [result, facets, categories] = await Promise.all([searchProducts(query), getShopFacets(), getCategories()]);
  const state: ShopUrlState = query;
  const showCategories = basePath === "/shop";
  const filterProps = {
    basePath,
    state,
    categories: categories.filter((c) => c.productCount > 0).map((c) => ({ name: c.name, slug: c.slug, productCount: c.productCount })),
    facets,
    showCategories,
  };
  const heading = query.q ? `Results for “${query.q}”` : title;

  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={breadcrumbs} />
      <div className="mt-4 mb-8 space-y-2">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl">{heading}</h1>
        {description ? <p className="max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex gap-10">
        <ShopFilters {...filterProps} />
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {result.total} product{result.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <MobileFilters {...filterProps} />
              <SortSelect basePath={basePath} state={state} options={SHOP_SORTS} />
            </div>
          </div>
          <ActiveChips basePath={basePath} state={state} categoryName={result.category?.name ?? null} showCategory={showCategories} />
          {result.items.length ? (
            <>
              <ProductGrid products={result.items} priorityCount={4} />
              <Pagination basePath={basePath} state={state} pageCount={result.pageCount} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-16 text-center">
              <PackageSearch className="size-12 text-brand-teal" aria-hidden />
              <h2 className="font-heading text-xl font-bold">No products match your search</h2>
              <p className="max-w-md text-sm text-muted-foreground">Try a different word, remove a filter, or browse all products.</p>
              <Button asChild className="rounded-full">
                <Link href="/shop">Browse all products</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShopSkeleton() {
  return (
    <div className="container-page py-8 sm:py-10" aria-busy="true" aria-label="Loading products">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 mb-8 h-10 w-72" />
      <div className="flex gap-10">
        <div className="hidden w-60 shrink-0 space-y-4 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
