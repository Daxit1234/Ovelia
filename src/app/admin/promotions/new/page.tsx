import type { Metadata } from "next";
import { PromotionForm } from "@/components/admin/promotions/promotion-form";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireStaffPage } from "@/lib/auth/session";
import { categoryOptions } from "@/lib/admin/products";
import { productVariantOptions } from "@/lib/admin/promotions";
import { EMPTY_PROMOTION } from "@/lib/validation/promotion";

export const metadata: Metadata = { title: "New promotion" };

export default async function NewPromotionPage() {
  await requireStaffPage("promotions:write", "/admin/promotions/new");
  const [products, categories] = await Promise.all([productVariantOptions(), categoryOptions()]);
  return (
    <>
      <AdminPageHeader title="New promotion" back={{ href: "/admin/promotions", label: "Promotions" }} />
      <PromotionForm initial={EMPTY_PROMOTION} products={products} categories={categories} />
    </>
  );
}
