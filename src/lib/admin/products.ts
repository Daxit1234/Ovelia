import "server-only";
import type { QueryFilter, Types } from "mongoose";
import { Category, connectDB, Product, Review, Wishlist, type ProductDoc, type VariantDoc } from "@/lib/db";
import { isObjectId, ObjectId, toObjectId } from "@/lib/db/model";
import { invalidate, invalidateProducts, TAGS } from "@/lib/cache-tags";
import { escapeRegex, slugify } from "@/lib/format";
import { toPaise } from "@/lib/money";
import { AppError, NotFoundError } from "@/lib/result";
import { recordInitialStock, type InventoryActor } from "@/lib/services/inventory";
import { deleteStoredImage } from "@/lib/services/storage";
import { oneOf, pageParam, param, type SearchParams } from "@/lib/admin/list";
import type { ProductData, ProductInput } from "@/lib/validation/product";

export const PRODUCT_SORTS = { updated: "Recently updated", name: "Name A–Z", price_asc: "Price low–high", price_desc: "Price high–low", sales: "Best selling" } as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;

export interface ProductFilters {
  q: string;
  category: string;
  status: "" | "draft" | "published";
  stock: "" | "in" | "low" | "out";
  sort: ProductSort;
  page: number;
}

export function parseProductFilters(params: SearchParams): ProductFilters {
  return {
    q: param(params, "q").slice(0, 80),
    category: param(params, "category"),
    status: oneOf(param(params, "status"), ["", "draft", "published"] as const, ""),
    stock: oneOf(param(params, "stock"), ["", "in", "low", "out"] as const, ""),
    sort: oneOf(param(params, "sort"), Object.keys(PRODUCT_SORTS) as ProductSort[], "updated"),
    page: pageParam(params),
  };
}

export const PRODUCTS_PAGE_SIZE = 25;

export async function listProducts(filters: ProductFilters) {
  await connectDB();
  const query: QueryFilter<ProductDoc> = {};
  if (filters.status) query.status = filters.status;
  if (filters.category && isObjectId(filters.category)) query.categoryPath = toObjectId(filters.category);
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ name: rx }, { slug: rx }, { "variants.sku": rx }, { tags: rx }];
  }
  if (filters.stock === "out") query.variants = { $not: { $elemMatch: { isActive: true, stock: { $gt: 0 } } } };
  if (filters.stock === "in") query.variants = { $elemMatch: { isActive: true, stock: { $gt: 0 } } };
  if (filters.stock === "low") query.$expr = { $gt: [{ $size: { $filter: { input: "$variants", as: "v", cond: { $and: ["$$v.isActive", { $lte: ["$$v.stock", "$$v.lowStockThreshold"] }] } } } }, 0] };
  const sort: Record<string, 1 | -1> =
    filters.sort === "name" ? { name: 1 } : filters.sort === "price_asc" ? { priceMin: 1 } : filters.sort === "price_desc" ? { priceMin: -1 } : filters.sort === "sales" ? { salesCount: -1 } : { updatedAt: -1 };
  const [total, rows, categories] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query).sort(sort).skip((filters.page - 1) * PRODUCTS_PAGE_SIZE).limit(PRODUCTS_PAGE_SIZE).lean(),
    Category.find({}, { name: 1 }).lean(),
  ]);
  const names = new Map(categories.map((c) => [c._id.toHexString(), c.name]));
  return { total, pageCount: Math.ceil(total / PRODUCTS_PAGE_SIZE), rows, categoryName: (id: Types.ObjectId) => names.get(id.toHexString()) ?? "—" };
}

/** Product as editable form values (prices in rupees). */
export async function getProductForm(id: string): Promise<{ values: ProductInput; id: string; slug: string; reserved: number } | null> {
  if (!isObjectId(id)) return null;
  await connectDB();
  const p = await Product.findById(toObjectId(id)).lean();
  if (!p) return null;
  const variants = p.variants as VariantDoc[];
  return {
    id: p._id.toHexString(),
    slug: p.slug,
    reserved: variants.reduce((s, v) => s + (v.reserved ?? 0), 0),
    values: {
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      description: p.description,
      categoryId: p.category.toHexString(),
      images: (p.images ?? []).map((i) => ({ url: i.url, alt: i.alt, publicId: i.publicId ?? null })),
      variants: variants
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => ({
          id: v._id.toHexString(),
          label: v.label,
          sku: v.sku,
          sizeValue: v.sizeValue,
          sizeUnit: v.sizeUnit,
          mrp: v.mrp / 100,
          price: v.price / 100,
          costPrice: v.costPrice / 100,
          stock: v.stock,
          lowStockThreshold: v.lowStockThreshold,
          weightGrams: v.weightGrams,
          isActive: v.isActive,
        })),
      highlights: p.highlights ?? [],
      specifications: (p.specifications ?? []).map((s) => ({ label: s.label, value: s.value })),
      usageInstructions: p.usageInstructions ?? "",
      ingredients: p.ingredients ?? "",
      safetyInformation: p.safetyInformation ?? "",
      shippingInfo: p.shippingInfo ?? "",
      returnInfo: p.returnInfo ?? "",
      fragrance: p.fragrance ?? "",
      tags: p.tags ?? [],
      status: p.status,
      isFeatured: p.isFeatured,
      isBestSeller: p.isBestSeller,
      isNewArrival: p.isNewArrival,
      reviewsEnabled: p.reviewsEnabled,
      relatedProductIds: (p.relatedProducts ?? []).map((x) => x.toHexString()),
      fbtProductIds: (p.frequentlyBoughtTogether ?? []).map((x) => x.toHexString()),
      hsnCode: p.hsnCode ?? "",
      gstRate: p.gstRate ?? 18,
      seoTitle: p.seo?.title ?? "",
      seoDescription: p.seo?.description ?? "",
    },
  };
}

async function categoryPath(categoryId: string): Promise<Types.ObjectId[]> {
  const categories = await Category.find({}, { parent: 1 }).lean();
  const byId = new Map(categories.map((c) => [c._id.toHexString(), c]));
  const path: Types.ObjectId[] = [];
  let current = byId.get(categoryId);
  if (!current) throw new AppError("Choose a valid category.");
  while (current && path.length < 6) {
    path.push(current._id);
    current = current.parent ? byId.get(current.parent.toHexString()) : undefined;
  }
  return path;
}

async function uniqueSlug(base: string, excludeId?: Types.ObjectId): Promise<string> {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await Product.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }))) return candidate;
  }
  throw new AppError("Could not create a unique URL for this product.");
}

/**
 * Creates or updates a product. Stock of existing variants is managed from
 * Inventory (so every change is audited); opening stock is accepted for new
 * variants only.
 */
export async function saveProduct(
  data: ProductData,
  actor: InventoryActor & { id: string },
  productId?: string,
  options: { stockMovementType?: "initial" | "import" } = {},
): Promise<{ id: string; slug: string }> {
  await connectDB();
  const existing = productId ? await Product.findById(toObjectId(productId)).lean() : null;
  if (productId && !existing) throw new NotFoundError("Product not found");

  const skus = data.variants.map((v) => v.sku);
  const clash = await Product.findOne({ "variants.sku": { $in: skus }, ...(existing ? { _id: { $ne: existing._id } } : {}) }, { name: 1, variants: 1 }).lean();
  if (clash) {
    const sku = (clash.variants as VariantDoc[]).find((v) => skus.includes(v.sku))?.sku;
    throw new AppError(`SKU ${sku} is already used by "${clash.name}".`);
  }

  const slug = data.slug ? (existing && existing.slug === data.slug ? data.slug : await uniqueSlug(data.slug, existing?._id)) : existing ? existing.slug : await uniqueSlug(data.name);
  const path = await categoryPath(data.categoryId);
  const existingVariants = new Map(((existing?.variants ?? []) as VariantDoc[]).map((v) => [v._id.toHexString(), v]));

  for (const [id, variant] of existingVariants) {
    if (!data.variants.some((v) => v.id === id) && variant.reserved > 0) {
      throw new AppError(`Variant ${variant.sku} has stock reserved for unpaid orders and can't be removed yet. Deactivate it instead.`);
    }
  }

  const newVariants: VariantDoc[] = [];
  const variants = data.variants.map((v, index) => {
    const previous = v.id ? existingVariants.get(v.id) : undefined;
    const doc = {
      _id: previous?._id ?? new ObjectId(),
      label: v.label,
      sku: v.sku,
      sizeValue: v.sizeValue,
      sizeUnit: v.sizeUnit,
      mrp: toPaise(v.mrp),
      price: toPaise(v.price),
      costPrice: toPaise(v.costPrice),
      stock: previous ? previous.stock : v.stock,
      reserved: previous ? previous.reserved : 0,
      lowStockThreshold: v.lowStockThreshold,
      weightGrams: v.weightGrams,
      barcode: previous?.barcode ?? null,
      isActive: v.isActive,
      sortOrder: index,
    } as VariantDoc;
    if (!previous) newVariants.push(doc);
    return doc;
  });

  const fields = {
    name: data.name,
    slug,
    shortDescription: data.shortDescription,
    description: data.description,
    category: toObjectId(data.categoryId),
    categoryPath: path,
    images: data.images.map((i) => ({ url: i.url, alt: i.alt, publicId: i.publicId ?? null })),
    variants,
    highlights: data.highlights,
    specifications: data.specifications,
    usageInstructions: data.usageInstructions,
    ingredients: data.ingredients,
    safetyInformation: data.safetyInformation,
    shippingInfo: data.shippingInfo,
    returnInfo: data.returnInfo,
    fragrance: data.fragrance,
    tags: data.tags,
    status: data.status,
    isFeatured: data.isFeatured,
    isBestSeller: data.isBestSeller,
    isNewArrival: data.isNewArrival,
    reviewsEnabled: data.reviewsEnabled,
    relatedProducts: data.relatedProductIds.filter((id) => id !== productId).map(toObjectId),
    frequentlyBoughtTogether: data.fbtProductIds.filter((id) => id !== productId).map(toObjectId),
    hsnCode: data.hsnCode,
    gstRate: data.gstRate,
    seo: { title: data.seoTitle, description: data.seoDescription },
    updatedBy: toObjectId(actor.id),
  };

  let saved: ProductDoc;
  if (existing) {
    // Targeted updates: stock/reserved are never written here, so orders
    // placed while an admin edits the product can't be overwritten.
    const removed = [...existingVariants.values()].filter((v) => !data.variants.some((x) => x.id === v._id.toHexString()));
    for (const v of removed) {
      if (v.stock > 0 || v.reserved > 0) {
        throw new AppError(`Variant ${v.sku} still has stock. Mark it inactive, or set its stock to 0 in Inventory before removing it.`);
      }
    }
    const active = variants.filter((v) => v.isActive);
    const pool = active.length ? active : variants;
    const { variants: _omit, ...topLevel } = fields;
    void _omit;
    const ops: Parameters<typeof Product.bulkWrite>[0] = [
      {
        updateOne: {
          filter: { _id: existing._id },
          update: {
            $set: {
              ...topLevel,
              priceMin: Math.min(...pool.map((v) => v.price)),
              priceMax: Math.max(...pool.map((v) => v.price)),
              mrpMax: Math.max(...pool.map((v) => v.mrp)),
              ...(data.status === "published" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
            },
          },
        },
      },
    ];
    if (removed.length) {
      ops.push({ updateOne: { filter: { _id: existing._id }, update: { $pull: { variants: { _id: { $in: removed.map((v) => v._id) }, stock: 0, reserved: 0 } } } } });
    }
    for (const v of variants) {
      if (!existingVariants.has(v._id.toHexString())) continue;
      ops.push({
        updateOne: {
          filter: { _id: existing._id, "variants._id": v._id },
          update: {
            $set: {
              "variants.$.label": v.label,
              "variants.$.sku": v.sku,
              "variants.$.sizeValue": v.sizeValue,
              "variants.$.sizeUnit": v.sizeUnit,
              "variants.$.mrp": v.mrp,
              "variants.$.price": v.price,
              "variants.$.costPrice": v.costPrice,
              "variants.$.lowStockThreshold": v.lowStockThreshold,
              "variants.$.weightGrams": v.weightGrams,
              "variants.$.isActive": v.isActive,
              "variants.$.sortOrder": v.sortOrder,
            },
          },
        },
      });
    }
    if (newVariants.length) {
      ops.push({ updateOne: { filter: { _id: existing._id }, update: { $push: { variants: { $each: newVariants } } } } });
    }
    await Product.bulkWrite(ops, { ordered: true });
    saved = (await Product.findById(existing._id).lean()) as ProductDoc;
    const removedImages = (existing.images ?? []).filter((img) => img.publicId && !data.images.some((i) => i.publicId === img.publicId));
    for (const img of removedImages) await deleteStoredImage(img.publicId);
  } else {
    const doc = await Product.create({ ...fields, createdBy: toObjectId(actor.id) });
    saved = doc.toObject() as ProductDoc;
  }

  if (newVariants.length) {
    await recordInitialStock({ _id: saved._id, name: saved.name, variants: newVariants }, actor, options.stockMovementType ?? "initial");
  }

  invalidateProducts([saved._id.toHexString()]);
  invalidate(`product-slug:${saved.slug}`, ...(existing && existing.slug !== saved.slug ? [`product-slug:${existing.slug}`] : []), TAGS.categories);
  return { id: saved._id.toHexString(), slug: saved.slug };
}

export async function setProductStatus(productId: string, status: "draft" | "published"): Promise<ProductDoc> {
  await connectDB();
  const product = await Product.findById(toObjectId(productId));
  if (!product) throw new NotFoundError("Product not found");
  product.status = status;
  await product.save();
  invalidateProducts([productId]);
  invalidate(`product-slug:${product.slug}`, TAGS.categories);
  return product.toObject();
}

/** Permanently deletes a product. Past orders keep their own snapshot of it. */
export async function deleteProduct(productId: string): Promise<ProductDoc> {
  await connectDB();
  const product = await Product.findById(toObjectId(productId)).lean();
  if (!product) throw new NotFoundError("Product not found");
  if ((product.variants as VariantDoc[]).some((v) => v.reserved > 0)) {
    throw new AppError("This product has stock reserved for unpaid orders. Try again after they are paid or expire, or unpublish it now.");
  }
  await Product.deleteOne({ _id: product._id });
  await Promise.all([
    Review.deleteMany({ productId: product._id }),
    Wishlist.updateMany({}, { $pull: { items: { productId: product._id } } }),
    Product.updateMany({}, { $pull: { relatedProducts: product._id, frequentlyBoughtTogether: product._id } }),
  ]);
  for (const img of product.images ?? []) await deleteStoredImage(img.publicId);
  invalidateProducts([productId]);
  invalidate(`product-slug:${product.slug}`, TAGS.categories);
  return product;
}

export async function productPickerOptions(): Promise<{ id: string; name: string }[]> {
  await connectDB();
  const docs = await Product.find({}, { name: 1 }).sort({ name: 1 }).lean();
  return docs.map((d) => ({ id: d._id.toHexString(), name: d.name }));
}

export async function categoryOptions(): Promise<{ id: string; name: string; depth: number }[]> {
  await connectDB();
  const docs = await Category.find({}, { name: 1, parent: 1, sortOrder: 1 }).sort({ sortOrder: 1, name: 1 }).lean();
  const children = new Map<string, typeof docs>();
  for (const d of docs) {
    const key = d.parent ? d.parent.toHexString() : "root";
    children.set(key, [...(children.get(key) ?? []), d]);
  }
  const out: { id: string; name: string; depth: number }[] = [];
  const walk = (key: string, depth: number) => {
    for (const d of children.get(key) ?? []) {
      out.push({ id: d._id.toHexString(), name: d.name, depth });
      if (depth < 4) walk(d._id.toHexString(), depth + 1);
    }
  };
  walk("root", 0);
  return out;
}
