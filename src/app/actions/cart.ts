"use server";

import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { resolveCartIdentity as resolveIdentity } from "@/lib/services/cart-identity";
import { isObjectId } from "@/lib/db/model";
import {
  addToCart,
  getCartView,
  removeFromCart,
  setCartCoupon,
  updateCartQuantity,
  type CartIdentity,
} from "@/lib/services/cart";
import { rateLimitByIp } from "@/lib/services/rate-limit";
import { couponCodeSchema } from "@/lib/validation/checkout";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import type { CartView } from "@/lib/types";

const objectId = z.string().refine(isObjectId, "Invalid id");
const lineSchema = z.object({
  productId: objectId,
  variantId: objectId,
  quantity: z.number().int().min(1).max(99),
});

function customerOf(user: SessionUser | null) {
  return { userId: user?.id ?? null, email: user?.email ?? null, phone: user?.phone ?? null };
}

async function view(identity: CartIdentity, user: SessionUser | null): Promise<CartView> {
  return (await getCartView(identity, customerOf(user))).view;
}

export async function getCartAction(): Promise<CartView> {
  const { identity, user } = await resolveIdentity(false);
  return view(identity, user);
}

export async function addToCartAction(input: z.input<typeof lineSchema>): Promise<ActionResult<CartView>> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return fail("Please choose a valid product and quantity.");
  try {
    const { identity, user } = await resolveIdentity(true);
    await addToCart(identity, parsed.data);
    return ok(await view(identity, user));
  } catch (error) {
    return toActionError(error, "Could not add this item to your cart.");
  }
}

/** Adds several items at once (e.g. "Add combo to cart"). */
export async function addManyToCartAction(items: z.input<typeof lineSchema>[]): Promise<ActionResult<CartView>> {
  const parsed = z.array(lineSchema).min(1).max(10).safeParse(items);
  if (!parsed.success) return fail("Please choose valid products.");
  try {
    const { identity, user } = await resolveIdentity(true);
    for (const item of parsed.data) await addToCart(identity, item);
    return ok(await view(identity, user));
  } catch (error) {
    return toActionError(error, "Could not add these items to your cart.");
  }
}

export async function updateCartItemAction(input: { variantId: string; quantity: number }): Promise<ActionResult<CartView>> {
  const parsed = z.object({ variantId: objectId, quantity: z.number().int().min(0).max(99) }).safeParse(input);
  if (!parsed.success) return fail("Please choose a valid quantity.");
  try {
    const { identity, user } = await resolveIdentity(false);
    await updateCartQuantity(identity, parsed.data.variantId, parsed.data.quantity);
    return ok(await view(identity, user));
  } catch (error) {
    return toActionError(error, "Could not update your cart.");
  }
}

export async function removeCartItemAction(variantId: string): Promise<ActionResult<CartView>> {
  if (!isObjectId(variantId)) return fail("Invalid item.");
  try {
    const { identity, user } = await resolveIdentity(false);
    await removeFromCart(identity, variantId);
    return ok(await view(identity, user));
  } catch (error) {
    return toActionError(error, "Could not remove this item.");
  }
}

export async function applyCouponAction(code: string): Promise<ActionResult<CartView>> {
  const parsed = couponCodeSchema.safeParse(code);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid coupon code.");
  const limit = await rateLimitByIp("coupon", 15, 300);
  if (!limit.allowed) return fail("Too many coupon attempts. Please try again in a few minutes.");
  try {
    const { identity, user } = await resolveIdentity(true);
    await setCartCoupon(identity, parsed.data);
    const cart = await view(identity, user);
    if (cart.coupon?.status === "invalid") {
      await setCartCoupon(identity, null);
      return fail(cart.coupon.message);
    }
    return ok(cart, cart.coupon?.message);
  } catch (error) {
    return toActionError(error, "Could not apply this coupon.");
  }
}

export async function removeCouponAction(): Promise<ActionResult<CartView>> {
  try {
    const { identity, user } = await resolveIdentity(false);
    await setCartCoupon(identity, null);
    return ok(await view(identity, user));
  } catch (error) {
    return toActionError(error, "Could not remove the coupon.");
  }
}
