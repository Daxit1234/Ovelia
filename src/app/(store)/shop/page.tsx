import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopSkeleton, ShopView } from "@/components/store/shop/shop-view";
import { parseShopQuery } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Shop all cleaning products",
  description:
    "Browse Ovelia dishwash liquid, floor cleaner, kitchen cleaner, toilet cleaner, glass cleaner, laundry detergent, car shampoo, car polish and cleaning kits.",
  alternates: { canonical: "/shop" },
};

async function ShopResults({ searchParams }: Pick<PageProps<"/shop">, "searchParams">) {
  const query = parseShopQuery(await searchParams);
  return (
    <ShopView
      basePath="/shop"
      query={query}
      title="All products"
      description="Everyday cleaning essentials for every room in your home — and your car."
      breadcrumbs={[{ label: "Shop", href: "/shop" }]}
    />
  );
}

export default function ShopPage(props: PageProps<"/shop">) {
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopResults searchParams={props.searchParams} />
    </Suspense>
  );
}
