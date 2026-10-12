import "server-only";
import type { CategoryDoc, ProductDoc, VariantDoc } from "@/lib/db";
import type { CategoryView, ImageView, ProductCardData, ProductDetailData, VariantView } from "@/lib/types";

type CategoryLite = Pick<CategoryDoc, "_id" | "name" | "slug">;

export function toVariantView(v: VariantDoc): VariantView {
  return {
    id: v._id.toHexString(),
    label: v.label,
    sku: v.sku,
    sizeValue: v.sizeValue,
    sizeUnit: v.sizeUnit,
    mrp: Math.max(v.mrp, v.price),
    price: v.price,
    stock: Math.max(0, v.stock),
    lowStockThreshold: v.lowStockThreshold,
    inStock: v.stock > 0,
  };
}

function image(img: { url: string; alt: string } | undefined, fallbackAlt: string): ImageView | null {
  return img ? { url: img.url, alt: img.alt || fallbackAlt } : null;
}

export function toProductCard(doc: ProductDoc, categories: Map<string, CategoryLite>): ProductCardData {
  const variants = (doc.variants as VariantDoc[])
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price)
    .map(toVariantView);
  const category = categories.get(doc.category.toHexString());
  const defaultVariant = variants.find((v) => v.inStock) ?? variants[0];
  return {
    id: doc._id.toHexString(),
    slug: doc.slug,
    name: doc.name,
    shortDescription: doc.shortDescription,
    categoryName: category?.name ?? "",
    categorySlug: category?.slug ?? "",
    image: image(doc.images?.[0], doc.name),
    hoverImage: image(doc.images?.[1], doc.name),
    priceMin: variants.length ? Math.min(...variants.map((v) => v.price)) : doc.priceMin,
    mrpMax: variants.length ? Math.max(...variants.map((v) => v.mrp)) : doc.mrpMax,
    ratingAverage: doc.ratingAverage ?? 0,
    ratingCount: doc.ratingCount ?? 0,
    isBestSeller: doc.isBestSeller,
    isNewArrival: doc.isNewArrival,
    fragrance: doc.fragrance ?? "",
    variants,
    defaultVariantId: defaultVariant?.id ?? "",
    inStock: variants.some((v) => v.inStock),
  };
}

export function toProductDetail(
  doc: ProductDoc,
  categories: Map<string, CategoryLite>,
  path: CategoryLite[],
): ProductDetailData {
  const card = toProductCard(doc, categories);
  return {
    ...card,
    description: doc.description,
    images: (doc.images ?? []).map((img) => ({ url: img.url, alt: img.alt || doc.name })),
    highlights: doc.highlights ?? [],
    specifications: (doc.specifications ?? []).map((s) => ({ label: s.label, value: s.value })),
    usageInstructions: doc.usageInstructions ?? "",
    ingredients: doc.ingredients ?? "",
    safetyInformation: doc.safetyInformation ?? "",
    shippingInfo: doc.shippingInfo ?? "",
    returnInfo: doc.returnInfo ?? "",
    tags: doc.tags ?? [],
    reviewsEnabled: doc.reviewsEnabled,
    hsnCode: doc.hsnCode ?? "",
    categoryId: doc.category.toHexString(),
    categoryPath: path.map((c) => ({ id: c._id.toHexString(), name: c.name, slug: c.slug })),
    relatedIds: (doc.relatedProducts ?? []).map((id) => id.toHexString()),
    frequentlyBoughtTogetherIds: (doc.frequentlyBoughtTogether ?? []).map((id) => id.toHexString()),
    seo: { title: doc.seo?.title ?? "", description: doc.seo?.description ?? "" },
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export function toCategoryView(doc: CategoryDoc, productCount: number): CategoryView {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    image: doc.image?.url ? { url: doc.image.url, alt: doc.image.alt || doc.name } : null,
    parentId: doc.parent ? doc.parent.toHexString() : null,
    productCount,
  };
}
