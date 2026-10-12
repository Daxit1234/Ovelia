import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/product-form";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireStaffPage } from "@/lib/auth/session";
import { EMPTY_PRODUCT } from "@/lib/admin/product-defaults";
import { categoryOptions, productPickerOptions } from "@/lib/admin/products";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaffPage("products:write", "/admin/products/new");
  const [categories, products] = await Promise.all([categoryOptions(), productPickerOptions()]);
  return (
    <>
      <AdminPageHeader title="New product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm initial={EMPTY_PRODUCT} categories={categories} products={products} />
    </>
  );
}
