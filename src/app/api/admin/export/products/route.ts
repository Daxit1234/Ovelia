import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/session";
import { PRODUCT_CSV_COLUMNS, type ProductCsvColumn } from "@/lib/admin/product-csv";
import { csvResponse, rupeesCell, toCsv } from "@/lib/csv";
import { Category, connectDB, Product, type ProductDoc, type VariantDoc } from "@/lib/db";
import { AuthorizationError } from "@/lib/result";
import { audit } from "@/lib/services/audit";

type Row = { p: ProductDoc; v: VariantDoc; categorySlug: string };

const VALUES: Record<ProductCsvColumn, (r: Row) => unknown> = {
  product_slug: (r) => r.p.slug,
  product_name: (r) => r.p.name,
  category_slug: (r) => r.categorySlug,
  status: (r) => r.p.status,
  short_description: (r) => r.p.shortDescription,
  gst_rate: (r) => r.p.gstRate,
  hsn_code: (r) => r.p.hsnCode,
  tags: (r) => (r.p.tags ?? []).join("|"),
  sku: (r) => r.v.sku,
  variant_label: (r) => r.v.label,
  size_value: (r) => r.v.sizeValue,
  size_unit: (r) => r.v.sizeUnit,
  mrp: (r) => rupeesCell(r.v.mrp),
  price: (r) => rupeesCell(r.v.price),
  cost_price: (r) => rupeesCell(r.v.costPrice),
  stock: (r) => r.v.stock,
  low_stock_threshold: (r) => r.v.lowStockThreshold,
  weight_grams: (r) => r.v.weightGrams,
  variant_active: (r) => (r.v.isActive ? "yes" : "no"),
};

/** Catalog export in the same format the importer reads (?template=1 for headers only). */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await authorize("products:import");
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
  const template = request.nextUrl.searchParams.get("template") === "1";
  let rows: Row[] = [];
  if (!template) {
    await connectDB();
    const [products, categories] = await Promise.all([Product.find({}).sort({ name: 1 }).lean(), Category.find({}, { slug: 1 }).lean()]);
    const categorySlug = new Map(categories.map((c) => [c._id.toHexString(), c.slug]));
    rows = products.flatMap((p) =>
      [...(p.variants as VariantDoc[])].sort((a, b) => a.sortOrder - b.sortOrder).map((v) => ({ p: p as ProductDoc, v, categorySlug: categorySlug.get(p.category.toHexString()) ?? "" })),
    );
    await audit({
      actor: { id: user.id, name: user.name, email: user.email, role: user.role },
      action: "export.products",
      entityType: "export",
      summary: `Exported ${products.length} products (${rows.length} variants)`,
    });
  }
  const csv = toCsv(
    rows,
    PRODUCT_CSV_COLUMNS.map((column) => ({ header: column, value: VALUES[column] })),
  );
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, template ? "ovelia-products-template.csv" : `ovelia-products-${date}.csv`);
}
