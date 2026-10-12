import { revalidateTag } from "next/cache";

/** Cache tags used by the storefront's `use cache` data functions. */
export const TAGS = {
  catalog: "catalog",
  categories: "categories",
  settings: "settings",
  content: "content",
  promotions: "promotions",
  product: (id: string) => `product:${id}`,
  reviews: (productId: string) => `reviews:${productId}`,
} as const;

/**
 * Marks cached storefront data as stale (stale-while-revalidate). Safe to call
 * from services: outside a Next.js request (scripts, tests) it is a no-op.
 */
export function invalidate(...tags: string[]): void {
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, "max");
    } catch {
      // Not inside a Next.js request scope.
    }
  }
}

export function invalidateProducts(productIds: Iterable<string>): void {
  invalidate(TAGS.catalog, ...[...productIds].map((id) => TAGS.product(id)));
}
