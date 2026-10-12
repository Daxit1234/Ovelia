"use server";

import { updateTag } from "next/cache";
import { authorize, type StaffUser } from "@/lib/auth/session";
import { TAGS } from "@/lib/cache-tags";
import { Category, connectDB, Product } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { slugify } from "@/lib/format";
import { MAX_IMPORT_BYTES, type CsvIssue } from "@/lib/admin/product-csv";
import { applyProductImport, planProductImport, type ImportSummary } from "@/lib/admin/product-import";
import { deleteProduct, saveProduct, setProductStatus } from "@/lib/admin/products";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import { categoryInputSchema, productInputSchema, type CategoryInput, type ProductInput } from "@/lib/validation/product";

function auditActor(user: StaffUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function refreshCatalog(productId?: string) {
  updateTag(TAGS.catalog);
  updateTag(TAGS.categories);
  if (productId) updateTag(TAGS.product(productId));
}

export async function saveProductAction(input: ProductInput, productId?: string): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  if (productId && !isObjectId(productId)) return fail("Product not found");
  try {
    const user = await authorize("products:write");
    const result = await saveProduct(parsed.data, { id: user.id, name: user.name, email: user.email, type: "admin" }, productId);
    refreshCatalog(result.id);
    await audit({
      actor: auditActor(user),
      action: productId ? "product.update" : "product.create",
      entityType: "product",
      entityId: result.id,
      summary: `${productId ? "Updated" : "Created"} product ${parsed.data.name}`,
      changes: {
        status: parsed.data.status,
        variants: parsed.data.variants.map((v) => ({ sku: v.sku, price: v.price, mrp: v.mrp, active: v.isActive })),
      },
    });
    return ok(result, productId ? "Product saved" : "Product created");
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail("That SKU or URL is already in use.");
    return toActionError(error, "Could not save the product.");
  }
}

export async function setProductStatusAction(productId: string, status: "draft" | "published"): Promise<ActionResult<null>> {
  if (!isObjectId(productId) || !["draft", "published"].includes(status)) return fail("Invalid request");
  try {
    const user = await authorize("products:write");
    const product = await setProductStatus(productId, status);
    refreshCatalog(productId);
    await audit({ actor: auditActor(user), action: `product.${status === "published" ? "publish" : "unpublish"}`, entityType: "product", entityId: productId, summary: `${status === "published" ? "Published" : "Unpublished"} ${product.name}` });
    return ok(null, status === "published" ? "Product published" : "Product unpublished");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResult<null>> {
  if (!isObjectId(productId)) return fail("Product not found");
  try {
    const user = await authorize("products:delete");
    const product = await deleteProduct(productId);
    refreshCatalog(productId);
    await audit({
      actor: auditActor(user),
      action: "product.delete",
      entityType: "product",
      entityId: productId,
      summary: `Deleted product ${product.name}`,
      changes: { skus: product.variants.map((v) => v.sku) },
    });
    return ok(null, "Product deleted");
  } catch (error) {
    return toActionError(error, "Could not delete the product.");
  }
}

/* ---------------- CSV import ---------------- */

export interface ImportPreview {
  summary: ImportSummary;
  issues: CsvIssue[];
  items: { kind: "create" | "update"; name: string; slug: string; lines: number[]; changes: string[] }[];
}

function importText(text: unknown): string | null {
  return typeof text === "string" && text.length > 0 && text.length <= MAX_IMPORT_BYTES ? text : null;
}

/** Dry run: reports what the file would change. Writes nothing. */
export async function previewProductImportAction(text: string): Promise<ActionResult<ImportPreview>> {
  const csv = importText(text);
  if (!csv) return fail(`Choose a CSV file up to ${Math.round(MAX_IMPORT_BYTES / 1024)} KB.`);
  try {
    await authorize("products:import");
    const plan = await planProductImport(csv);
    return ok({
      summary: plan.summary,
      issues: plan.issues.slice(0, 300),
      items: plan.items.slice(0, 500).map(({ kind, name, slug, lines, changes }) => ({ kind, name, slug, lines, changes })),
    });
  } catch (error) {
    return toActionError(error, "Could not read the file.");
  }
}

/** Re-plans the import against the current catalog, then applies it. */
export async function applyProductImportAction(text: string): Promise<ActionResult<{ summary: ImportSummary; failures: CsvIssue[] }>> {
  const csv = importText(text);
  if (!csv) return fail(`Choose a CSV file up to ${Math.round(MAX_IMPORT_BYTES / 1024)} KB.`);
  try {
    const user = await authorize("products:import");
    const plan = await planProductImport(csv);
    if (plan.issues.length) return fail(`The file has ${plan.issues.length} problem${plan.issues.length === 1 ? "" : "s"}. Preview it again to see them.`);
    if (plan.items.length === 0) return ok({ summary: plan.summary, failures: [] }, "Nothing to change: the catalog already matches this file.");
    const { productIds, failures } = await applyProductImport(plan, { id: user.id, name: user.name, email: user.email, type: "admin" });
    updateTag(TAGS.catalog);
    updateTag(TAGS.categories);
    for (const id of productIds) updateTag(TAGS.product(id));
    const s = plan.summary;
    await audit({
      actor: auditActor(user),
      action: "product.import",
      entityType: "product",
      summary: `CSV import: ${s.productsCreated} created, ${s.productsUpdated} updated, ${s.stockChanges} stock changes${failures.length ? `, ${failures.length} failed` : ""}`,
      changes: { summary: s, failures },
    });
    return ok({ summary: s, failures }, failures.length ? `Imported with ${failures.length} problem${failures.length === 1 ? "" : "s"}` : "Import complete");
  } catch (error) {
    return toActionError(error, "Could not import the file.");
  }
}

/* ---------------- Categories ---------------- */

export async function saveCategoryAction(input: CategoryInput, categoryId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  if (categoryId && !isObjectId(categoryId)) return fail("Category not found");
  try {
    const user = await authorize("categories:write");
    await connectDB();
    const data = parsed.data;
    const slug = slugify(data.slug || data.name);
    if (!slug) return fail("Enter a valid name or URL slug.");
    if (await Category.exists({ slug, ...(categoryId ? { _id: { $ne: toObjectId(categoryId) } } : {}) })) return fail(`The URL “${slug}” is already used by another category.`);

    if (data.parentId) {
      if (data.parentId === categoryId) return fail("A category can't be its own parent.");
      // Prevent cycles: walk up from the proposed parent.
      let cursor = await Category.findById(toObjectId(data.parentId), { parent: 1 }).lean();
      if (!cursor) return fail("Parent category not found.");
      for (let depth = 0; cursor && depth < 10; depth++) {
        if (categoryId && cursor._id.toHexString() === categoryId) return fail("That parent would create a loop.");
        cursor = cursor.parent ? await Category.findById(cursor.parent, { parent: 1 }).lean() : null;
      }
    }

    const doc = {
      name: data.name,
      slug,
      description: data.description,
      parent: data.parentId ? toObjectId(data.parentId) : null,
      image: data.imageUrl ? { url: data.imageUrl, alt: data.imageAlt || data.name } : null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      showOnHome: data.showOnHome,
      seo: { title: data.seoTitle, description: data.seoDescription },
    };
    let id: string;
    if (categoryId) {
      const updated = await Category.findByIdAndUpdate(toObjectId(categoryId), { $set: doc }, { returnDocument: "after" }).lean();
      if (!updated) return fail("Category not found");
      id = updated._id.toHexString();
      // Keep product category paths in sync when the hierarchy changes.
      const products = await Product.find({ categoryPath: updated._id }, { category: 1 }).lean();
      const all = await Category.find({}, { parent: 1 }).lean();
      const byId = new Map(all.map((c) => [c._id.toHexString(), c]));
      for (const p of products) {
        const path = [];
        let current = byId.get(p.category.toHexString());
        while (current && path.length < 6) {
          path.push(current._id);
          current = current.parent ? byId.get(current.parent.toHexString()) : undefined;
        }
        await Product.updateOne({ _id: p._id }, { $set: { categoryPath: path } });
      }
    } else {
      id = (await Category.create(doc))._id.toHexString();
    }
    updateTag(TAGS.categories);
    updateTag(TAGS.catalog);
    await audit({ actor: auditActor(user), action: categoryId ? "category.update" : "category.create", entityType: "category", entityId: id, summary: `${categoryId ? "Updated" : "Created"} category ${data.name}` });
    return ok({ id }, "Category saved");
  } catch (error) {
    return toActionError(error, "Could not save the category.");
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult<null>> {
  if (!isObjectId(categoryId)) return fail("Category not found");
  try {
    const user = await authorize("categories:write");
    await connectDB();
    const id = toObjectId(categoryId);
    const [products, children] = await Promise.all([Product.countDocuments({ category: id }), Category.countDocuments({ parent: id })]);
    if (products) return fail(`Move or delete the ${products} product(s) in this category first.`);
    if (children) return fail("Delete or move its sub-categories first.");
    const category = await Category.findByIdAndDelete(id).lean();
    updateTag(TAGS.categories);
    updateTag(TAGS.catalog);
    await audit({ actor: auditActor(user), action: "category.delete", entityType: "category", entityId: categoryId, summary: `Deleted category ${category?.name ?? categoryId}` });
    return ok(null, "Category deleted");
  } catch (error) {
    return toActionError(error);
  }
}
