export interface ShopUrlState {
  q: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  fragrances: string[];
  sizes: string[];
  sort: string;
  page: number;
}

/**
 * Builds a canonical shop URL. Any change other than an explicit page change
 * resets pagination to page 1.
 */
export function buildShopHref(basePath: string, state: ShopUrlState, overrides: Partial<ShopUrlState> = {}): string {
  const next = { ...state, ...overrides };
  if (!("page" in overrides)) next.page = 1;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category && basePath === "/shop") params.set("category", next.category);
  if (next.minPrice !== null) params.set("min", String(next.minPrice));
  if (next.maxPrice !== null) params.set("max", String(next.maxPrice));
  if (next.inStock) params.set("stock", "1");
  if (next.fragrances.length) params.set("fragrance", [...next.fragrances].sort().join(","));
  if (next.sizes.length) params.set("size", [...next.sizes].sort().join(","));
  if (next.sort && next.sort !== "featured") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function activeFilterCount(state: ShopUrlState): number {
  return (
    (state.minPrice !== null || state.maxPrice !== null ? 1 : 0) +
    (state.inStock ? 1 : 0) +
    state.fragrances.length +
    state.sizes.length +
    (state.category ? 1 : 0)
  );
}
