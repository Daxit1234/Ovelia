import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ProductForm } from "@/components/admin/products/product-form";
import { AdminPageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireStaffPage } from "@/lib/auth/session";
import { categoryOptions, getProductForm, productPickerOptions } from "@/lib/admin/products";
import { hasPermission } from "@/lib/domain/roles";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("products:read", `/admin/products/${id}`);
  const [product, categories, products] = await Promise.all([getProductForm(id), categoryOptions(), productPickerOptions()]);
  if (!product) notFound();
  return (
    <>
      <AdminPageHeader
        title={product.values.name}
        description={product.reserved ? `${product.reserved} unit(s) currently reserved for unpaid orders.` : undefined}
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          product.values.status === "published" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/products/${product.slug}`} target="_blank">
                <ExternalLink className="size-4" /> View on store
              </Link>
            </Button>
          ) : null
        }
      />
      {hasPermission(user.role, "products:write") ? (
        <ProductForm productId={product.id} initial={product.values} categories={categories} products={products} canDelete={hasPermission(user.role, "products:delete")} />
      ) : (
        <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">You have read-only access to products.</p>
      )}
    </>
  );
}
