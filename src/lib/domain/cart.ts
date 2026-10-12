export interface CartLineRef {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * Merges a guest cart into a signed-in customer's cart. Lines for the same
 * variant are de-duplicated, keeping the larger quantity, so logging in never
 * doubles items that the customer added on both carts.
 */
export function mergeCartLines(userLines: CartLineRef[], guestLines: CartLineRef[], maxPerLine: number): CartLineRef[] {
  const merged = new Map<string, CartLineRef>();
  for (const line of userLines) {
    merged.set(line.variantId, { ...line, quantity: Math.min(maxPerLine, line.quantity) });
  }
  for (const line of guestLines) {
    const existing = merged.get(line.variantId);
    if (existing) {
      existing.quantity = Math.min(maxPerLine, Math.max(existing.quantity, line.quantity));
    } else {
      merged.set(line.variantId, { ...line, quantity: Math.min(maxPerLine, line.quantity) });
    }
  }
  return [...merged.values()].filter((line) => line.quantity > 0);
}

/** Removes purchased quantities from a cart after an order is confirmed. */
export function subtractPurchased(cartLines: CartLineRef[], purchased: CartLineRef[]): CartLineRef[] {
  const bought = new Map<string, number>();
  for (const p of purchased) bought.set(p.variantId, (bought.get(p.variantId) ?? 0) + p.quantity);
  return cartLines
    .map((line) => ({ ...line, quantity: line.quantity - (bought.get(line.variantId) ?? 0) }))
    .filter((line) => line.quantity > 0);
}
