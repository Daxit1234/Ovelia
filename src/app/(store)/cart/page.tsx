import type { Metadata } from "next";
import { CartPageClient } from "@/components/store/cart/cart-page-client";
import { ProductSection } from "@/components/store/home/sections";
import { getBestSellers } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const recommendations = await getBestSellers(4);
  return (
    <>
      <div className="container-page py-8 sm:py-10">
        <h1 className="mb-6 font-heading text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl">Your cart</h1>
        <CartPageClient />
      </div>
      <ProductSection eyebrow="Popular right now" title="You might also like" products={recommendations} href="/shop" tinted />
    </>
  );
}
