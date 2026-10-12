"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Heart, MapPin, PackageCheck, ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";
import { checkDeliveryAction, getWishlistIdsAction, toggleWishlistAction, type DeliveryCheck } from "@/app/actions/catalog";
import { useCart } from "@/components/store/cart-context";
import { Price } from "@/components/shared/price";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth/client";
import { formatINR } from "@/lib/money";
import type { ProductDetailData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PurchasePanel({ product, maxPerOrder }: { product: ProductDetailData; maxPerOrder: number }) {
  const router = useRouter();
  const { add, busy } = useCart();
  const { data: session } = useSession();
  const [variantId, setVariantId] = useState(product.defaultVariantId);
  const [requestedQuantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [buying, setBuying] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const maxQuantity = Math.max(1, Math.min(maxPerOrder, variant?.stock ?? 1));
  // Clamped during render so switching to a size with less stock never exceeds it.
  const quantity = Math.min(requestedQuantity, maxQuantity);

  useEffect(() => {
    if (!session) return;
    let active = true;
    getWishlistIdsAction().then((ids) => active && setWishlisted(ids.includes(product.id)));
    return () => {
      active = false;
    };
  }, [product.id, session]);


  if (!variant) return <p className="text-muted-foreground">This product is currently unavailable.</p>;

  const lowStock = variant.inStock && variant.stock <= variant.lowStockThreshold;

  const addToCart = () => add({ productId: product.id, variantId: variant.id, quantity });
  const buyNow = async () => {
    setBuying(true);
    const ok = await add({ productId: product.id, variantId: variant.id, quantity }, { openDrawer: false, silent: true });
    if (ok) router.push("/checkout");
    else setBuying(false);
  };
  const toggleWishlist = async () => {
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`);
      return;
    }
    const result = await toggleWishlistAction(product.id);
    if (result.ok) {
      setWishlisted(result.data.inWishlist);
      toast.success(result.message);
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Price price={variant.price} mrp={variant.mrp} size="lg" showSavings />
        <p className="text-xs text-muted-foreground">MRP inclusive of all taxes</p>
      </div>

      {product.variants.length > 1 ? (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-brand-ink">
            Size: <span className="font-normal text-muted-foreground">{variant.label}</span>
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a size">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variant.id}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  "flex min-w-24 flex-col items-start rounded-xl border-2 px-3.5 py-2 text-left transition-all",
                  v.id === variant.id ? "border-brand-green bg-brand-mint/60" : "border-border hover:border-brand-teal/60",
                  !v.inStock && "opacity-55",
                )}
              >
                <span className="text-sm font-semibold text-brand-ink">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.inStock ? formatINR(v.price) : "Out of stock"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {variant.inStock ? (
          <span className={cn("inline-flex items-center gap-1.5 font-semibold", lowStock ? "text-amber-700" : "text-emerald-700")}>
            <PackageCheck className="size-4" aria-hidden />
            {lowStock ? `Only ${variant.stock} left in stock` : "In stock"}
          </span>
        ) : (
          <span className="font-semibold text-destructive">Out of stock</span>
        )}
        <span className="text-muted-foreground">SKU: {variant.sku}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} disabled={!variant.inStock} />
        <Button size="xl" className="flex-1 sm:flex-none" onClick={addToCart} disabled={busy || !variant.inStock}>
          <ShoppingBag className="size-5" aria-hidden /> Add to cart
        </Button>
        <Button size="xl" variant="outline" className="flex-1 border-brand-green text-brand-green sm:flex-none" onClick={buyNow} disabled={busy || buying || !variant.inStock}>
          <Zap className="size-5" aria-hidden /> {buying ? "Please wait…" : "Buy now"}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-12 rounded-full border"
          onClick={toggleWishlist}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={cn("size-5", wishlisted && "fill-rose-500 text-rose-500")} />
        </Button>
      </div>

      <DeliveryChecker />
    </div>
  );
}

function DeliveryChecker() {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<DeliveryCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await checkDeliveryAction(pincode);
      if (res.ok) {
        setResult(res.data);
        setError(null);
      } else {
        setError(res.error);
        setResult(null);
      }
    });
  };
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <form onSubmit={submit} className="flex items-center gap-2">
        <MapPin className="size-5 shrink-0 text-brand-teal" aria-hidden />
        <label htmlFor="delivery-pincode" className="sr-only">
          Delivery PIN code
        </label>
        <Input
          id="delivery-pincode"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter PIN code to check delivery"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          className="h-10 bg-white"
        />
        <Button type="submit" variant="outline" disabled={pending || pincode.length !== 6}>
          {pending ? "Checking…" : "Check"}
        </Button>
      </form>
      <div aria-live="polite" className="text-sm">
        {error ? <p className="mt-2 text-destructive">{error}</p> : null}
        {result ? (
          <div className="mt-2 space-y-1">
            <p className={result.serviceable ? "text-emerald-700" : "text-destructive"}>{result.message}</p>
            {result.serviceable ? <p className="text-muted-foreground">{result.codAvailable ? "Cash on Delivery available." : "Prepaid orders only for this PIN code."}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
