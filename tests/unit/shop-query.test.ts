import { describe, expect, it } from "vitest";
import { buildShopHref, toggleValue } from "@/lib/shop-url";

// parseShopQuery lives in a server module; the URL helpers are shared with it.
describe("shop URLs", () => {
  const base = { q: "", category: "", minPrice: null, maxPrice: null, inStock: false, fragrances: [], sizes: [], sort: "featured", page: 1 };

  it("omits defaults and resets the page on filter changes", () => {
    expect(buildShopHref("/shop", base)).toBe("/shop");
    expect(buildShopHref("/shop", { ...base, page: 3 }, { inStock: true })).toBe("/shop?stock=1");
    expect(buildShopHref("/shop", base, { page: 2 })).toBe("/shop?page=2");
  });

  it("keeps the category out of category-page URLs", () => {
    expect(buildShopHref("/categories/car-care", { ...base, category: "car-care" }, { sort: "price_asc" })).toBe("/categories/car-care?sort=price_asc");
  });

  it("serialises multi-value filters canonically", () => {
    expect(buildShopHref("/shop", base, { sizes: ["5 L", "1 L"], fragrances: ["Lemon"] })).toBe("/shop?fragrance=Lemon&size=1+L%2C5+L");
    expect(toggleValue(["a"], "a")).toEqual([]);
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
  });
});
