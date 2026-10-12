import "server-only";
import { Category, connectDB, Product, type VariantDoc } from "@/lib/db";
import { EMPTY_PRODUCT, NEW_VARIANT } from "@/lib/admin/product-defaults";
import { parseProductCsv, type CsvIssue, type ProductCsvRow } from "@/lib/admin/product-csv";
import { getProductForm, saveProduct } from "@/lib/admin/products";
import { slugify } from "@/lib/format";
import { formatINRPrecise, toPaise } from "@/lib/money";
import { AppError } from "@/lib/result";
import { adjustStock, type InventoryActor } from "@/lib/services/inventory";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";

type VariantInput = ProductInput["variants"][number];

export interface ImportPlanItem {
  kind: "create" | "update";
  productId: string | null;
  name: string;
  slug: string;
  lines: number[];
  /** Human-readable list of what will change. */
  changes: string[];
  newVariants: number;
  updatedVariants: number;
  /** Absolute stock to set on existing variants (logged as "CSV import"). */
  stockSets: { variantId: string; sku: string; from: number; to: number }[];
  /** Whether product fields or variants change (stock aside). */
  saveNeeded: boolean;
  values: ProductInput;
}

export interface ImportSummary {
  rows: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  stockChanges: number;
  unchangedProducts: number;
}

export interface ImportPlan {
  items: ImportPlanItem[];
  issues: CsvIssue[];
  summary: ImportSummary;
}

const rupees = (v: unknown) => formatINRPrecise(toPaise(Number(v)));
const plain = (v: unknown) => (Array.isArray(v) ? v.join(", ") || "none" : v === "" || v === null || v === undefined ? "blank" : String(v));

const VARIANT_FIELDS: { row: keyof ProductCsvRow; field: keyof VariantInput; label: string; show: (v: unknown) => string }[] = [
  { row: "variantLabel", field: "label", label: "label", show: plain },
  { row: "sizeValue", field: "sizeValue", label: "size", show: plain },
  { row: "sizeUnit", field: "sizeUnit", label: "unit", show: plain },
  { row: "mrp", field: "mrp", label: "MRP", show: rupees },
  { row: "price", field: "price", label: "price", show: rupees },
  { row: "costPrice", field: "costPrice", label: "cost", show: rupees },
  { row: "lowStockThreshold", field: "lowStockThreshold", label: "alert level", show: plain },
  { row: "weightGrams", field: "weightGrams", label: "weight (g)", show: plain },
  { row: "variantActive", field: "isActive", label: "active", show: (v) => (v ? "yes" : "no") },
];

const NEW_VARIANT_REQUIRED: { row: keyof ProductCsvRow; column: string }[] = [
  { row: "variantLabel", column: "variant_label" },
  { row: "sizeValue", column: "size_value" },
  { row: "sizeUnit", column: "size_unit" },
  { row: "mrp", column: "mrp" },
  { row: "price", column: "price" },
];

/**
 * Works out what an import would change without writing anything. The same
 * function runs again when the import is applied, so the result always
 * reflects the current catalog rather than what was previewed.
 */
export async function planProductImport(text: string): Promise<ImportPlan> {
  const { rows, issues } = parseProductCsv(text);
  const summary: ImportSummary = { rows: rows.length, productsCreated: 0, productsUpdated: 0, variantsCreated: 0, variantsUpdated: 0, stockChanges: 0, unchangedProducts: 0 };
  if (rows.length === 0) return { items: [], issues, summary };

  await connectDB();
  const candidateSlug = (r: ProductCsvRow) => r.productSlug ?? slugify(r.productName ?? "");
  const skus = rows.map((r) => r.sku);
  const slugs = [...new Set(rows.map(candidateSlug).filter(Boolean))];
  const [skuDocs, slugDocs, categories] = await Promise.all([
    Product.find({ "variants.sku": { $in: skus } }, { slug: 1, name: 1, variants: 1 }).lean(),
    Product.find({ slug: { $in: slugs } }, { slug: 1, name: 1 }).lean(),
    Category.find({}, { slug: 1, name: 1 }).lean(),
  ]);
  const skuOwner = new Map<string, { id: string; slug: string }>();
  for (const p of skuDocs) {
    for (const v of p.variants as VariantDoc[]) if (skus.includes(v.sku)) skuOwner.set(v.sku, { id: p._id.toHexString(), slug: p.slug });
  }
  const slugOwner = new Map(slugDocs.map((p) => [p.slug, p._id.toHexString()]));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c._id.toHexString()]));
  const categorySlugById = new Map(categories.map((c) => [c._id.toHexString(), c.slug]));

  // 1. Decide which product each row belongs to.
  const groups = new Map<string, { productId: string | null; slug: string; rows: ProductCsvRow[] }>();
  for (const row of rows) {
    let productId: string | null = null;
    let slug: string;
    const owner = skuOwner.get(row.sku);
    if (owner) {
      if (row.productSlug && row.productSlug !== owner.slug) {
        issues.push({ line: row.line, message: `SKU ${row.sku} belongs to the product “${owner.slug}”, not “${row.productSlug}”.` });
        continue;
      }
      productId = owner.id;
      slug = owner.slug;
    } else if (row.productSlug && slugOwner.has(row.productSlug)) {
      productId = slugOwner.get(row.productSlug)!;
      slug = row.productSlug;
    } else {
      slug = candidateSlug(row);
      if (!slug) {
        issues.push({ line: row.line, message: `SKU ${row.sku} is new: add product_slug or product_name so it can be placed in a product.` });
        continue;
      }
      if (!row.productSlug && slugOwner.has(slug)) {
        issues.push({ line: row.line, message: `A product with the URL “${slug}” already exists. Set product_slug to ${slug} to add this variant to it, or use a different product_name.` });
        continue;
      }
    }
    const key = productId ?? `new:${slug}`;
    const group = groups.get(key) ?? { productId, slug, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  // 2. Build the full product values for each group and validate them.
  const items: ImportPlanItem[] = [];
  for (const group of groups.values()) {
    const lines = group.rows.map((r) => r.line);
    const first = lines[0];
    const issueCount = issues.length;

    const pick = <K extends keyof ProductCsvRow>(field: K, column: string): ProductCsvRow[K] | null => {
      let value: ProductCsvRow[K] | null = null;
      let from = 0;
      for (const r of group.rows) {
        if (r[field] === null) continue;
        if (value === null) {
          value = r[field];
          from = r.line;
        } else if (JSON.stringify(r[field]) !== JSON.stringify(value)) {
          issues.push({ line: r.line, message: `${column} differs from line ${from} for the same product.` });
        }
      }
      return value;
    };
    const name = pick("productName", "product_name");
    const categorySlug = pick("categorySlug", "category_slug");
    const status = pick("status", "status");
    const shortDescription = pick("shortDescription", "short_description");
    const gstRate = pick("gstRate", "gst_rate");
    const hsnCode = pick("hsnCode", "hsn_code");
    const tags = pick("tags", "tags");
    const categoryId = categorySlug ? (categoryBySlug.get(categorySlug) ?? null) : null;
    if (categorySlug && !categoryId) issues.push({ line: first, message: `No category with the URL “${categorySlug}”. Create it under Categories first.` });

    const changes: string[] = [];
    const stockSets: ImportPlanItem["stockSets"] = [];
    let saveNeeded = false;
    let newVariants = 0;
    let updatedVariants = 0;
    let values: ProductInput;

    if (group.productId) {
      const form = await getProductForm(group.productId);
      if (!form) {
        issues.push({ line: first, message: `Product “${group.slug}” was not found.` });
        continue;
      }
      values = form.values;
      const set = <K extends keyof ProductInput>(field: K, next: ProductInput[K] | null, label: string, show: (v: unknown) => string = plain) => {
        if (next === null || JSON.stringify(values[field]) === JSON.stringify(next)) return;
        changes.push(field === "shortDescription" ? `${label} updated` : `${label}: ${show(values[field])} → ${show(next)}`);
        values[field] = next;
        saveNeeded = true;
      };
      set("name", name, "Name");
      if (categoryId && categoryId !== values.categoryId) {
        changes.push(`Category: ${categorySlugById.get(values.categoryId) ?? "none"} → ${categorySlug}`);
        values.categoryId = categoryId;
        saveNeeded = true;
      }
      set("status", status, "Status");
      set("shortDescription", shortDescription, "Short description");
      set("gstRate", gstRate, "GST", (v) => `${v}%`);
      set("hsnCode", hsnCode, "HSN code");
      set("tags", tags, "Tags");
    } else {
      const missing = [!name ? "product_name" : null, !categorySlug ? "category_slug" : null].filter(Boolean);
      if (missing.length) issues.push({ line: first, message: `New product “${group.slug}” needs ${missing.join(" and ")}.` });
      values = {
        ...structuredClone(EMPTY_PRODUCT),
        variants: [],
        name: name ?? "",
        slug: group.slug,
        categoryId: categoryId ?? "",
        status: status ?? "draft",
        shortDescription: shortDescription ?? "",
        gstRate: gstRate ?? EMPTY_PRODUCT.gstRate,
        hsnCode: hsnCode ?? EMPTY_PRODUCT.hsnCode,
        tags: tags ?? [],
      };
      saveNeeded = true;
      changes.push(`New ${values.status} product in ${categorySlug ?? "?"}`);
    }

    for (const row of group.rows) {
      const existing = values.variants.find((v) => v.sku === row.sku);
      if (existing?.id) {
        const diffs: string[] = [];
        for (const f of VARIANT_FIELDS) {
          const next = row[f.row];
          if (next === null || next === existing[f.field]) continue;
          diffs.push(`${f.label} ${f.show(existing[f.field])} → ${f.show(next)}`);
          (existing as Record<string, unknown>)[f.field] = next;
        }
        if (diffs.length) {
          updatedVariants++;
          saveNeeded = true;
          changes.push(`${row.sku}: ${diffs.join(", ")}`);
        }
        if (row.stock !== null && row.stock !== existing.stock) {
          stockSets.push({ variantId: existing.id, sku: row.sku, from: existing.stock, to: row.stock });
          changes.push(`${row.sku}: stock ${existing.stock} → ${row.stock}`);
        }
        continue;
      }
      const missing = NEW_VARIANT_REQUIRED.filter((f) => row[f.row] === null).map((f) => f.column);
      if (missing.length) {
        issues.push({ line: row.line, message: `New variant ${row.sku} needs ${missing.join(", ")}.` });
        continue;
      }
      values.variants.push({
        ...NEW_VARIANT,
        label: row.variantLabel!,
        sku: row.sku,
        sizeValue: row.sizeValue!,
        sizeUnit: row.sizeUnit!,
        mrp: row.mrp!,
        price: row.price!,
        costPrice: row.costPrice ?? 0,
        stock: row.stock ?? 0,
        lowStockThreshold: row.lowStockThreshold ?? NEW_VARIANT.lowStockThreshold,
        weightGrams: row.weightGrams ?? NEW_VARIANT.weightGrams,
        isActive: row.variantActive ?? true,
      });
      newVariants++;
      saveNeeded = true;
      changes.push(`${row.sku}: new variant ${row.variantLabel} at ${rupees(row.price)}${row.stock ? `, ${row.stock} in stock` : ""}`);
    }

    if (issues.length > issueCount) continue;
    if (saveNeeded) {
      const parsed = productInputSchema.safeParse(values);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const [head, index, field] = issue.path;
          const sku = head === "variants" && typeof index === "number" ? values.variants[index]?.sku : undefined;
          const line = group.rows.find((r) => r.sku === sku)?.line ?? first;
          const where = sku ? `${sku} ${String(field ?? "")}`.trim() : String(head ?? "product");
          issues.push({ line, message: `${where}: ${issue.message}` });
        }
        continue;
      }
    }
    if (!saveNeeded && stockSets.length === 0) {
      summary.unchangedProducts++;
      continue;
    }
    items.push({ kind: group.productId ? "update" : "create", productId: group.productId, name: values.name, slug: values.slug || group.slug, lines, changes, newVariants, updatedVariants, stockSets, saveNeeded, values });
    if (group.productId) summary.productsUpdated++;
    else summary.productsCreated++;
    summary.variantsCreated += newVariants;
    summary.variantsUpdated += updatedVariants;
    summary.stockChanges += stockSets.length;
  }

  issues.sort((a, b) => a.line - b.line);
  return { items, issues, summary };
}

/** Applies a plan with no issues. Each product is saved independently. */
export async function applyProductImport(plan: ImportPlan, actor: InventoryActor & { id: string }): Promise<{ productIds: string[]; failures: CsvIssue[] }> {
  if (plan.issues.length) throw new AppError("Fix the problems in the file before importing.");
  const productIds: string[] = [];
  const failures: CsvIssue[] = [];
  for (const item of plan.items) {
    try {
      let productId = item.productId;
      if (item.saveNeeded) {
        const data = productInputSchema.parse(item.values);
        productId = (await saveProduct(data, actor, item.productId ?? undefined, { stockMovementType: "import" })).id;
      }
      for (const s of item.stockSets) {
        await adjustStock({ productId: productId!, variantId: s.variantId, mode: "set", quantity: s.to, reason: "CSV import", actor, movementType: "import" });
      }
      productIds.push(productId!);
    } catch (error) {
      if (!(error instanceof AppError)) console.error("Product import failed", error);
      failures.push({ line: item.lines[0], message: `${item.name}: ${error instanceof AppError ? error.message : "could not be saved."}` });
    }
  }
  return { productIds, failures };
}
