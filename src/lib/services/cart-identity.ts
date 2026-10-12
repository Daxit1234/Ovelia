import "server-only";
import { cookies } from "next/headers";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { mergeGuestCart, newGuestToken, type CartIdentity } from "@/lib/services/cart";

export const GUEST_CART_COOKIE = "ovelia_cart";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Resolves the cart owner for this request: the signed-in customer or a
 * guest identified by an httpOnly cookie. A guest cart is merged into the
 * customer's cart as soon as they sign in. Must be called from a Server
 * Action or Route Handler (it may set or delete cookies).
 */
export async function resolveCartIdentity(createGuest: boolean): Promise<{ identity: CartIdentity; user: SessionUser | null }> {
  const user = await getSessionUser();
  const jar = await cookies();
  let guestToken = jar.get(GUEST_CART_COOKIE)?.value ?? null;

  if (user) {
    if (guestToken) {
      await mergeGuestCart(guestToken, user.id);
      jar.delete(GUEST_CART_COOKIE);
    }
    return { identity: { userId: user.id, guestToken: null }, user };
  }
  if (!guestToken && createGuest) {
    guestToken = newGuestToken();
    jar.set(GUEST_CART_COOKIE, guestToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }
  return { identity: { userId: null, guestToken }, user: null };
}

export function customerIdentity(user: SessionUser | null, overrides: { email?: string | null; phone?: string | null } = {}) {
  return {
    userId: user?.id ?? null,
    email: overrides.email ?? user?.email ?? null,
    phone: overrides.phone ?? user?.phone ?? null,
  };
}
