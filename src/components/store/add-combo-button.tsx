"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { Button } from "@/components/ui/button";

export function AddComboButton({ items, label = "Add combo to cart" }: { items: { productId: string; variantId: string; quantity: number }[]; label?: string }) {
  const { addMany, busy } = useCart();
  return (
    <Button size="lg" className="rounded-full" disabled={busy || items.length === 0} onClick={() => addMany(items)}>
      <ShoppingBag className="size-4" aria-hidden /> {label}
    </Button>
  );
}
