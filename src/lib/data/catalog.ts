import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Types } from "mongoose";
import { Category, connectDB, Product, type CategoryDoc, type ProductDoc } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { TAGS } from "@/lib/cache-tags";
import { escapeRegex, formatSize } from "@/lib/format";
import { toCategoryView, toProductCard, toProductDetail } from "@/lib/data/mappers";
import type { CategoryView, ProductCardData, ProductDetailData } from "@/lib/types";

const PUBLISHED = { status: "published" } as const;

async function categoryMap(): Promise<Map<string, CategoryDoc>> {
  const docs = await Category.find({}, { name: 1, slug: 1, parent: 1, isActive: 1 }).lean();
  return new Map(docs.map((c) => [c._id.toHexString(), c as CategoryDoc]));
}

/** Active categories with published product counts, ordered for navigation. */
export async function getCategories(): Promise<CategoryView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog, TAGS.categories);
  await connectDB();
  const [categories, counts] = await Promise.all([
    Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: PUBLISHED },
      { $unwind: "$categoryPath" },
      { $group: { _id: "$categoryPath", count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toHexString(), c.count]));
  return categories.map((c) => toCategoryView(c, countMap.get(c._id.toHexString()) ?? 0));
}

export async function getCategoryBySlug(slug: string): Promise<CategoryView | null> {
  const categories = await getCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

async function cardsFor(filter: Record<string, unknown>, sort: Record<string, 1 | -1>, limit: number): Promise<ProductCardData[]> {
  await connectDB();
  const [docs, categories] = await Promise.all([Product.find({ ...PUBLISHED, ...filter }).sort(sort).limit(limit).lean(), categoryMap()]);
  return docs.map((d) => toProductCard(d as ProductDoc, categories));
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  return cardsFor({ isFeatured: true }, { salesCount: -1, createdAt: -1 }, limit);
}

export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const flagged = await cardsFor({ isBestSeller: true }, { salesCount: -1 }, limit);
  if (flagged.length >= limit) return flagged;
  const fill = await cardsFor({ isBestSeller: { $ne: true } }, { salesCount: -1, ratingCount: -1, isFeatured: -1 }, limit - flagged.length);
  return [...flagged, ...fill];
}

export async function getNewArrivals(limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const flagged = await cardsFor({ isNewArrival: true }, { publishedAt: -1, createdAt: -1 }, limit);
  if (flagged.length >= limit) return flagged;
  const fill = await cardsFor({ isNewArrival: { $ne: true } }, { publishedAt: -1, createdAt: -1 }, limit - flagged.length);
  return [...flagged, ...fill];
}

export async function getProductsByIds(ids: string[]): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const valid = ids.filter(isObjectId);
  if (valid.length === 0) return [];
  const cards = await cardsFor({ _id: { $in: valid.map(toObjectId) } }, { salesCount: -1 }, valid.length);
  const order = new Map(valid.map((id, i) => [id, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog, `product-slug:${slug}`);
  await connectDB();
  const doc = await Product.findOne({ ...PUBLISHED, slug }).lean();
  if (!doc) return null;
  cacheTag(TAGS.product(doc._id.toHexString()));
  const categories = await categoryMap();
  const path: CategoryDoc[] = [];
  let current = categories.get(doc.category.toHexString());
  while (current && path.length < 5) {
    path.unshift(current);
    current = current.parent ? categories.get(current.parent.toHexString()) : undefined;
  }
  return toProductDetail(doc as ProductDoc, categories, path);
}

/** Related products: explicit links first, then others from the same category. */
export async function getRelatedProducts(productId: string, categoryId: string, relatedIds: string[], limit = 4): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const explicit = await getProductsByIds(relatedIds);
  if (explicit.length >= limit) return explicit.slice(0, limit);
  const more = await cardsFor(
    { categoryPath: toObjectId(categoryId), _id: { $nin: [productId, ...relatedIds].filter(isObjectId).map(toObjectId) } },
    { salesCount: -1 },
    limit - explicit.length,
  );
  const fill = more.length + explicit.length < limit ? await getBestSellers(limit * 2) : [];
  const seen = new Set([productId]);
  return [...explicit, ...more, ...fill].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Shop search                                                         */
/* ------------------------------------------------------------------ */

export const SHOP_SORTS = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  popular: "Most popular",
  best_selling: "Best selling",
} as const;
export type ShopSort = keyof typeof SHOP_SORTS;

export interface ShopQuery {
  q: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  fragrances: string[];
  sizes: string[];
  sort: ShopSort;
  page: number;
}

export const SHOP_PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? value.split(",") : [];
  return [...new Set(raw.map((v) => v.trim()).filter(Boolean))].slice(0, 20).sort();
}

/** Normalises untrusted URL parameters into a canonical, cache-friendly query. */
export function parseShopQuery(params: SearchParams, fixedCategory?: string): ShopQuery {
  const num = (v: string) => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const sort = first(params.sort) as ShopSort;
  const page = Number(first(params.page));
  return {
    q: first(params.q).trim().slice(0, 80),
    category: fixedCategory ?? first(params.category).trim().slice(0, 80),
    minPrice: num(first(params.min)),
    maxPrice: num(first(params.max)),
    inStock: first(params.stock) === "1",
    fragrances: list(params.fragrance),
    sizes: list(params.size),
    sort: sort in SHOP_SORTS ? sort : "featured",
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

function sortSpec(sort: ShopSort): Record<string, 1 | -1> {
  switch (sort) {
    case "newest":
      return { publishedAt: -1, createdAt: -1, _id: -1 };
    case "price_asc":
      return { priceMin: 1, _id: 1 };
    case "price_desc":
      return { priceMin: -1, _id: 1 };
    case "popular":
      return { ratingCount: -1, ratingAverage: -1, salesCount: -1, _id: 1 };
    case "best_selling":
      return { salesCount: -1, _id: 1 };
    default:
      return { isFeatured: -1, isBestSeller: -1, salesCount: -1, createdAt: -1, _id: 1 };
  }
}

function parseSize(label: string): { value: number; unit: string } | null {
  const match = label.match(/^(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs)$/i);
  if (!match) return null;
  let value = Number(match[1]);
  let unit = match[2].toLowerCase();
  if (unit === "l") {
    value *= 1000;
    unit = "ml";
  }
  if (unit === "kg") {
    value *= 1000;
    unit = "g";
  }
  return { value, unit };
}

export interface ShopResult {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  category: CategoryView | null;
}

export async function searchProducts(query: ShopQuery): Promise<ShopResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.catalog);
  await connectDB();

  const and: Record<string, unknown>[] = [PUBLISHED];
  let category: CategoryView | null = null;
  if (query.category) {
    category = (await getCategories()).find((c) => c.slug === query.category) ?? null;
    if (!category) return { items: [], total: 0, page: 1, pageCount: 0, category: null };
    and.push({ categoryPath: toObjectId(category.id) });
  }
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    const matchingCategories = (await getCategories()).filter((c) => rx.test(c.name)).map((c) => toObjectId(c.id));
    and.push({
      $or: [
        { name: rx },
        { shortDescription: rx },
        { description: rx },
        { tags: rx },
        { fragrance: rx },
        { "variants.sku": rx },
        ...(matchingCategories.length ? [{ categoryPath: { $in: matchingCategories } }] : []),
      ],
    });
  }
  if (query.minPrice !== null || query.maxPrice !== null) {
    const price: Record<string, number> = {};
    if (query.minPrice !== null) price.$gte = query.minPrice * 100;
    if (query.maxPrice !== null) price.$lte = query.maxPrice * 100;
    and.push({ variants: { $elemMatch: { isActive: true, price } } });
  }
  if (query.inStock) and.push({ variants: { $elemMatch: { isActive: true, stock: { $gt: 0 } } } });
  if (query.fragrances.length) and.push({ fragrance: { $in: query.fragrances } });
  const sizes = query.sizes.map(parseSize).filter((s): s is { value: number; unit: string } => !!s);
  if (sizes.length) {
    and.push({
      $or: sizes.map((s) => ({
        variants: {
          $elemMatch: {
            isActive: true,
            $or: [
              { sizeValue: s.value, sizeUnit: s.unit },
              ...(s.unit === "ml" ? [{ sizeValue: s.value / 1000, sizeUnit: "l" }] : []),
              ...(s.unit === "g" ? [{ sizeValue: s.value / 1000, sizeUnit: "kg" }] : []),
            ],
          },
        },
      })),
    });
  }

  const filter = { $and: and };
  const [total, docs, categories] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort(sortSpec(query.sort))
      .skip((query.page - 1) * SHOP_PAGE_SIZE)
      .limit(SHOP_PAGE_SIZE)
      .lean(),
    categoryMap(),
  ]);
  return {
    items: docs.map((d) => toProductCard(d as ProductDoc, categories)),
    total,
    page: query.page,
    pageCount: Math.ceil(total / SHOP_PAGE_SIZE),
    category,
  };
}

export interface ShopFacets {
  fragrances: string[];
  sizes: string[];
  priceMin: number;
  priceMax: number;
}

export async function getShopFacets(): Promise<ShopFacets> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  await connectDB();
  const docs = await Product.find(PUBLISHED, { fragrance: 1, variants: 1 }).lean();
  const fragrances = new Set<string>();
  const sizes = new Map<string, number>();
  let min = Infinity;
  let max = 0;
  for (const doc of docs) {
    if (doc.fragrance) fragrances.add(doc.fragrance);
    for (const v of doc.variants) {
      if (!v.isActive) continue;
      min = Math.min(min, v.price);
      max = Math.max(max, v.price);
      if (v.sizeUnit !== "pcs") {
        const ml = v.sizeUnit === "l" || v.sizeUnit === "kg" ? v.sizeValue * 1000 : v.sizeValue;
        const unit = v.sizeUnit === "l" ? "ml" : v.sizeUnit === "kg" ? "g" : v.sizeUnit;
        sizes.set(formatSize(ml, unit), ml);
      }
    }
  }
  return {
    fragrances: [...fragrances].sort(),
    sizes: [...sizes.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label),
    priceMin: Number.isFinite(min) ? Math.floor(min / 100) : 0,
    priceMax: Math.ceil(max / 100),
  };
}

/** All published product slugs (sitemap). */
export async function getProductSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  await connectDB();
  const docs = await Product.find(PUBLISHED, { slug: 1, updatedAt: 1 }).lean();
  return docs.map((d) => ({ slug: d.slug, updatedAt: new Date(d.updatedAt).toISOString() }));
}
