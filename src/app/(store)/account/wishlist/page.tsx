import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Heart } from "lucide-react";
import { WishlistRemoveButton } from "@/components/store/account/wishlist-remove";
import { ProductCard } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getProductsByIds } from "@/lib/data/catalog";
import { connectDB, Wishlist } from "@/lib/db";
import { toObjectId } from "@/lib/db/model";

export const metadata: Metadata = { title: "Wishlist" };

async function WishlistItems() {
  const user = await requireUser("/account/wishlist");
  await connectDB();
  const list = await Wishlist.findOne({ userId: toObjectId(user.id) }).lean();
  const ids = (list?.items ?? []).slice().reverse().map((i) => i.productId.toHexString());
  const products = await getProductsByIds(ids);
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border bg-white px-6 py-16 text-center">
        <Heart className="size-12 text-rose-400" aria-hidden />
        <h2 className="font-heading text-xl font-bold">Your wishlist is empty</h2>
        <p className="text-muted-foreground">Tap the heart on any product to save it for later.</p>
        <Button asChild className="rounded-full">
          <Link href="/shop">Browse products</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
      {products.map((p) => (
        <li key={p.id} className="relative">
          <ProductCard product={p} />
          <WishlistRemoveButton productId={p.id} name={p.name} />
        </li>
      ))}
    </ul>
  );
}

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink">Wishlist</h1>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-3xl" />}>
        <WishlistItems />
      </Suspense>
    </div>
  );
}
