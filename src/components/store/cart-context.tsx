"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  addManyToCartAction,
  addToCartAction,
  applyCouponAction,
  getCartAction,
  removeCartItemAction,
  removeCouponAction,
  updateCartItemAction,
} from "@/app/actions/cart";
import { useSession } from "@/lib/auth/client";
import type { ActionResult } from "@/lib/result";
import { EMPTY_CART, type CartView } from "@/lib/types";

interface AddInput {
  productId: string;
  variantId: string;
  quantity: number;
}

interface CartContextValue {
  cart: CartView;
  ready: boolean;
  busy: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  add: (input: AddInput, options?: { openDrawer?: boolean; silent?: boolean }) => Promise<boolean>;
  addMany: (items: AddInput[]) => Promise<boolean>;
  update: (variantId: string, quantity: number) => Promise<boolean>;
  remove: (variantId: string) => Promise<boolean>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<boolean>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const session = useSession();
  const userId = session.data?.user.id ?? null;
  const sessionPending = session.isPending;
  const loadedFor = useRef<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setCart(await getCartAction());
    } catch (error) {
      console.error("Failed to load cart", error);
    } finally {
      setReady(true);
    }
  }, []);

  // Load on mount and whenever the signed-in user changes (merges guest carts).
  useEffect(() => {
    if (sessionPending || loadedFor.current === userId) return;
    loadedFor.current = userId;
    void refresh();
  }, [refresh, sessionPending, userId]);

  const run = useCallback(async (operation: () => Promise<ActionResult<CartView>>, successMessage?: string) => {
    setBusy(true);
    try {
      const result = await operation();
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setCart(result.data);
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      ready,
      busy,
      drawerOpen,
      setDrawerOpen,
      refresh,
      add: async (input, options) => {
        const ok = await run(() => addToCartAction(input), options?.silent ? undefined : "Added to your cart");
        if (ok && options?.openDrawer !== false) setDrawerOpen(true);
        return ok;
      },
      addMany: async (items) => {
        const ok = await run(() => addManyToCartAction(items), "Added to your cart");
        if (ok) setDrawerOpen(true);
        return ok;
      },
      update: (variantId, quantity) => run(() => updateCartItemAction({ variantId, quantity })),
      remove: (variantId) => run(() => removeCartItemAction(variantId), "Removed from cart"),
      applyCoupon: async (code) => {
        setBusy(true);
        try {
          const result = await applyCouponAction(code);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          setCart(result.data);
          const status = result.data.coupon?.status;
          if (status === "applied") toast.success(result.data.coupon!.message);
          else if (result.data.coupon) toast.warning(result.data.coupon.message);
          return status === "applied";
        } finally {
          setBusy(false);
        }
      },
      removeCoupon: () => run(() => removeCouponAction(), "Coupon removed"),
    }),
    [busy, cart, drawerOpen, ready, refresh, run],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
