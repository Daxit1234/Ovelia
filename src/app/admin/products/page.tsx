import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { deleteProductAction, setProductStatusAction } from "@/app/admin/products/actions";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, AdminPagination, EmptyState } from "@/components/admin/ui";
import { ProductImage } from "@/components/shared/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { compact } from "@/lib/admin/list";
import { categoryOptions, listProducts, parseProductFilters, PRODUCT_SORTS } from "@/lib/admin/products";
import { hasPermission } from "@/lib/domain/roles";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Products" };
const selectClass = "h-9 rounded-lg border border-input bg-white px-2.5 text-sm";

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const user = await requireStaffPage("products:read", "/admin/products");
  const filters = parseProductFilters(await searchParams);
  const [{ rows, total, pageCount, categoryName }, categories] = await Promise.all([listProducts(filters), categoryOptions()]);
  const canWrite = hasPermission(user.role, "products:write");
  const canDelete = hasPermission(user.role, "products:delete");
  const canImport = hasPermission(user.role, "products:import");
  const params = compact({ q: filters.q, category: filters.category, status: filters.status, stock: filters.stock, sort: filters.sort === "updated" ? "" : filters.sort });

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Manage your catalog, variants, pricing and visibility."
        actions={
          <>
            {canImport ? (
              <>
                <Button variant="outline" asChild>
                  <a href="/api/admin/export/products">
                    <Download className="size-4" /> Export CSV
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/admin/products/import">
                    <Upload className="size-4" /> Import CSV
                  </Link>
                </Button>
              </>
            ) : null}
            {canWrite ? (
              <Button asChild>
                <Link href="/admin/products/new">
                  <Plus className="size-4" /> New product
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-3">
        <Input name="q" defaultValue={filters.q} placeholder="Name, SKU or tag…" className="h-9 w-60" aria-label="Search products" />
        <select name="category" defaultValue={filters.category} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status} className={selectClass} aria-label="Status">
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select name="stock" defaultValue={filters.stock} className={selectClass} aria-label="Stock">
          <option value="">Any stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select name="sort" defaultValue={filters.sort} className={selectClass} aria-label="Sort">
          {Object.entries(PRODUCT_SORTS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="h-9">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href="/admin/products">Reset</Link>
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Create your first product or adjust the filters."
          action={
            canWrite ? (
              <Button asChild className="mt-2">
                <Link href="/admin/products/new">New product</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const id = p._id.toHexString();
                const active = p.variants.filter((v) => v.isActive);
                const stock = active.reduce((s, v) => s + v.stock, 0);
                const low = active.some((v) => v.stock > 0 && v.stock <= v.lowStockThreshold);
                const out = active.some((v) => v.stock === 0);
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                          {p.images[0] ? <ProductImage src={p.images[0].url} alt="" fill sizes="44px" className="object-cover" /> : null}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/admin/products/${id}`} className="font-medium text-brand-ink hover:text-brand-green hover:underline">
                            {p.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.variants.length} variant{p.variants.length === 1 ? "" : "s"} · {p.variants.map((v) => v.sku).join(", ")}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{categoryName(p.category)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap tabular-nums">
                      {p.priceMin === p.priceMax ? formatINR(p.priceMin) : `${formatINR(p.priceMin)} – ${formatINR(p.priceMax)}`}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {stock}
                      {out ? <Badge variant="destructive" className="ml-2">Out</Badge> : low ? <Badge className="ml-2 bg-amber-100 text-amber-900">Low</Badge> : null}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{p.salesCount}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status === "published" ? "Published" : "Draft"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/products/${id}`}>Edit</Link>
                        </Button>
                        {canWrite ? (
                          <ActionButton action={setProductStatusAction.bind(null, id, p.status === "published" ? "draft" : "published")} variant="ghost">
                            {p.status === "published" ? "Unpublish" : "Publish"}
                          </ActionButton>
                        ) : null}
                        {canDelete ? (
                          <ActionButton
                            action={deleteProductAction.bind(null, id)}
                            variant="ghost"
                            className="text-destructive"
                            confirm={{ title: `Delete ${p.name}?`, description: "This permanently removes the product, its reviews and wishlist entries. Past orders keep their details. Consider unpublishing instead." }}
                            confirmLabel="Delete"
                          >
                            Delete
                          </ActionButton>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <AdminPagination basePath="/admin/products" params={params} page={filters.page} pageCount={pageCount} total={total} />
    </>
  );
}
