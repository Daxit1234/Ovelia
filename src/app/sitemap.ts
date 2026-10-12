import type { MetadataRoute } from "next";
import { getCategories, getProductSitemapEntries } from "@/lib/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [products, categories] = await Promise.all([getProductSitemapEntries(), getCategories()]);
  const staticPages = ["", "/shop", "/offers", "/about", "/contact", "/faq", "/track-order", "/policies/shipping", "/policies/returns", "/policies/privacy", "/policies/terms"];
  return [
    ...staticPages.map((path) => ({
      url: `${base}${path}`,
      changeFrequency: path === "" || path === "/shop" ? ("daily" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/shop" ? 0.9 : 0.5,
    })),
    ...categories
      .filter((c) => c.productCount > 0)
      .map((c) => ({ url: `${base}/categories/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
