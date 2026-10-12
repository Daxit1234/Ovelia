import { allocateProportionally, formatINR, type Paise } from "@/lib/money";

/**
 * Pure pricing engine. Given cart lines, candidate promotions and store rules
 * it returns the authoritative totals. The browser never supplies totals: the
 * server always recomputes them with this function before accepting an order.
 */

export const PROMOTION_TYPES = ["percentage", "fixed", "free_shipping", "buy_x_get_y", "bundle"] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];
export const PROMOTION_SCOPES = ["all", "products", "categories"] as const;
export type PromotionScope = (typeof PROMOTION_SCOPES)[number];
export type ShippingMethod = "standard" | "express";
export type CheckoutPaymentMethod = "razorpay" | "cod";

export interface PricingLine {
  key: string;
  productId: string;
  variantId: string;
  categoryIds: string[];
  quantity: number;
  unitPrice: Paise;
  unitMrp: Paise;
  taxRate: number;
}

export interface PricingPromotion {
  id: string;
  name: string;
  code: string | null;
  isAutomatic: boolean;
  type: PromotionType;
  /** Percent (0-100) for percentage offers, paise for fixed offers. */
  value: number;
  maxDiscount: Paise | null;
  appliesTo: PromotionScope;
  productIds: string[];
  categoryIds: string[];
  buyQuantity: number;
  getQuantity: number;
  getDiscountPercent: number;
  bundleItems: { productId: string; variantId: string | null; quantity: number }[];
  bundlePrice: Paise | null;
  minSubtotal: Paise;
  minQuantity: number;
  firstOrderOnly: boolean;
  stackable: boolean;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface ShippingRules {
  standardFee: Paise;
  expressEnabled: boolean;
  expressFee: Paise;
  freeShippingThreshold: Paise | null;
  codEnabled: boolean;
  codFee: Paise;
  codMinOrderValue: Paise | null;
  codMaxOrderValue: Paise | null;
}

export interface TaxRules {
  pricesIncludeTax: boolean;
  shippingTaxRate: number;
  storeState: string | null;
}

export interface CouponInput {
  code: string;
  /** null when no promotion matches the code. */
  promotion: PricingPromotion | null;
  /** Reason from service-level checks (usage limits, inactive, etc.). */
  blockedReason?: string | null;
}

export interface PricingInput {
  lines: PricingLine[];
  /** Automatic promotions that already passed service-level checks. */
  promotions: PricingPromotion[];
  coupon: CouponInput | null;
  shippingMethod: ShippingMethod;
  paymentMethod: CheckoutPaymentMethod | null;
  destinationState: string | null;
  /** null when unknown (e.g. guest cart before the email is entered). */
  isFirstOrder: boolean | null;
  shipping: ShippingRules;
  tax: TaxRules;
  now: Date;
}

export interface PricedLine extends PricingLine {
  lineSubtotal: Paise;
  lineMrpTotal: Paise;
  discount: Paise;
  lineTotal: Paise;
  taxableValue: Paise;
  taxAmount: Paise;
}

export interface AppliedPromotion {
  id: string;
  name: string;
  code: string | null;
  type: PromotionType;
  amount: Paise;
  freeShipping: boolean;
}

export type CouponStatus = "applied" | "invalid" | "not_eligible" | "not_combinable";

export interface PricingResult {
  lines: PricedLine[];
  itemCount: number;
  mrpTotal: Paise;
  subtotal: Paise;
  productSavings: Paise;
  discountTotal: Paise;
  merchandiseTotal: Paise;
  shippingMethod: ShippingMethod;
  shippingFeeBeforeDiscount: Paise;
  shippingFee: Paise;
  codFee: Paise;
  codAvailable: boolean;
  codUnavailableReason: string | null;
  expressAvailable: boolean;
  taxTotal: Paise;
  tax: { cgst: Paise; sgst: Paise; igst: Paise; interState: boolean; shippingTax: Paise };
  grandTotal: Paise;
  totalSavings: Paise;
  appliedPromotions: AppliedPromotion[];
  coupon: { code: string; status: CouponStatus; message: string } | null;
  freeShipping: { threshold: Paise | null; remaining: Paise; qualified: boolean };
}

type Eligibility = { eligible: true } | { eligible: false; reason: string };

export function validateLines(lines: PricingLine[]): void {
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Invalid quantity for ${line.key}`);
    }
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error(`Invalid price for ${line.key}`);
    }
    if (!Number.isInteger(line.unitMrp) || line.unitMrp < 0) {
      throw new Error(`Invalid MRP for ${line.key}`);
    }
    if (!(line.taxRate >= 0 && line.taxRate <= 100)) {
      throw new Error(`Invalid tax rate for ${line.key}`);
    }
  }
}

function lineMatchesScope(promo: PricingPromotion, line: PricingLine): boolean {
  switch (promo.appliesTo) {
    case "all":
      return true;
    case "products":
      return promo.productIds.includes(line.productId);
    case "categories":
      return line.categoryIds.some((c) => promo.categoryIds.includes(c));
  }
}

function eligibleLines(promo: PricingPromotion, lines: PricingLine[]): PricingLine[] {
  return lines.filter((line) => lineMatchesScope(promo, line));
}

function bundleCount(promo: PricingPromotion, lines: PricingLine[]): number {
  if (promo.bundleItems.length === 0) return 0;
  // Each bundle component consumes units independently; components that point
  // to the same product share the same pool, so count demand per pool.
  const demand = new Map<string, { quantity: number; available: number }>();
  for (const item of promo.bundleItems) {
    const poolKey = item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
    const available = lines
      .filter((l) => (item.variantId ? l.variantId === item.variantId : l.productId === item.productId))
      .reduce((sum, l) => sum + l.quantity, 0);
    const entry = demand.get(poolKey) ?? { quantity: 0, available };
    entry.quantity += Math.max(1, item.quantity);
    demand.set(poolKey, entry);
  }
  let count = Infinity;
  for (const { quantity, available } of demand.values()) {
    count = Math.min(count, Math.floor(available / quantity));
  }
  return Number.isFinite(count) ? count : 0;
}

export function checkEligibility(
  promo: PricingPromotion,
  lines: PricingLine[],
  context: { now: Date; isFirstOrder: boolean | null },
): Eligibility {
  if (lines.length === 0) return { eligible: false, reason: "Your cart is empty." };
  if (promo.startsAt && promo.startsAt.getTime() > context.now.getTime()) {
    return { eligible: false, reason: "This offer has not started yet." };
  }
  if (promo.endsAt && promo.endsAt.getTime() < context.now.getTime()) {
    return { eligible: false, reason: "This offer has expired." };
  }
  if (promo.firstOrderOnly && context.isFirstOrder === false) {
    return { eligible: false, reason: "This offer is valid on your first order only." };
  }

  const cartSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  if (promo.minSubtotal > 0 && cartSubtotal < promo.minSubtotal) {
    return {
      eligible: false,
      reason: `Add ${formatINR(promo.minSubtotal - cartSubtotal)} more to use this offer.`,
    };
  }

  if (promo.type === "bundle") {
    if (!promo.bundlePrice || bundleCount(promo, lines) < 1) {
      return { eligible: false, reason: "Add every item in this combo to your cart to unlock the combo price." };
    }
    return { eligible: true };
  }

  const scoped = eligibleLines(promo, lines);
  if (promo.type !== "free_shipping" && scoped.length === 0) {
    return { eligible: false, reason: "This offer does not apply to the items in your cart." };
  }
  const scopedUnits = (promo.type === "free_shipping" ? lines : scoped).reduce((sum, l) => sum + l.quantity, 0);

  if (promo.minQuantity > 0 && scopedUnits < promo.minQuantity) {
    const missing = promo.minQuantity - scopedUnits;
    return { eligible: false, reason: `Add ${missing} more eligible item${missing === 1 ? "" : "s"} to use this offer.` };
  }

  if (promo.type === "buy_x_get_y") {
    const groupSize = Math.max(1, promo.buyQuantity) + Math.max(1, promo.getQuantity);
    if (scopedUnits < groupSize) {
      const missing = groupSize - scopedUnits;
      return { eligible: false, reason: `Add ${missing} more eligible item${missing === 1 ? "" : "s"} to unlock this offer.` };
    }
  }
  return { eligible: true };
}

interface PromotionApplication {
  allocations: Map<string, Paise>;
  amount: Paise;
  freeShipping: boolean;
}

function allocateAcross(lines: PricingLine[], remaining: Map<string, Paise>, amount: Paise): Map<string, Paise> {
  const weights = lines.map((l) => remaining.get(l.key) ?? 0);
  const parts = allocateProportionally(amount, weights);
  const result = new Map<string, Paise>();
  lines.forEach((line, index) => {
    if (parts[index] > 0) result.set(line.key, parts[index]);
  });
  return result;
}

type Unit = { key: string; price: number };

function expandUnits(lines: PricingLine[], remaining: Map<string, Paise>): Unit[] {
  const units: Unit[] = [];
  for (const line of lines) {
    const perUnit = (remaining.get(line.key) ?? 0) / line.quantity;
    for (let i = 0; i < line.quantity; i++) units.push({ key: line.key, price: perUnit });
  }
  return units;
}

function sumUnitsByKey(units: Unit[], factor = 1): Map<string, Paise> {
  const result = new Map<string, Paise>();
  for (const unit of units) result.set(unit.key, (result.get(unit.key) ?? 0) + unit.price * factor);
  return result;
}

function applyPromotion(
  promo: PricingPromotion,
  lines: PricingLine[],
  remaining: Map<string, Paise>,
): PromotionApplication {
  const none: PromotionApplication = { allocations: new Map(), amount: 0, freeShipping: false };

  switch (promo.type) {
    case "free_shipping":
      return { ...none, freeShipping: true };

    case "percentage":
    case "fixed": {
      const scoped = eligibleLines(promo, lines);
      const base = scoped.reduce((sum, l) => sum + (remaining.get(l.key) ?? 0), 0);
      if (base <= 0) return none;
      let amount =
        promo.type === "percentage"
          ? Math.floor((base * Math.min(100, Math.max(0, promo.value))) / 100)
          : Math.max(0, Math.round(promo.value));
      if (promo.type === "percentage" && promo.maxDiscount !== null && promo.maxDiscount >= 0) {
        amount = Math.min(amount, promo.maxDiscount);
      }
      amount = Math.min(amount, base);
      return { allocations: allocateAcross(scoped, remaining, amount), amount, freeShipping: false };
    }

    case "buy_x_get_y": {
      const scoped = eligibleLines(promo, lines);
      const units = expandUnits(scoped, remaining).sort((a, b) => a.price - b.price || a.key.localeCompare(b.key));
      const groupSize = Math.max(1, promo.buyQuantity) + Math.max(1, promo.getQuantity);
      const discountedUnits = Math.floor(units.length / groupSize) * Math.max(1, promo.getQuantity);
      if (discountedUnits === 0) return none;
      const percent = Math.min(100, Math.max(0, promo.getDiscountPercent)) / 100;
      const raw = sumUnitsByKey(units.slice(0, discountedUnits), percent);
      const allocations = new Map<string, Paise>();
      let amount = 0;
      for (const [key, value] of raw) {
        const discount = Math.min(Math.floor(value), remaining.get(key) ?? 0);
        if (discount > 0) {
          allocations.set(key, discount);
          amount += discount;
        }
      }
      if (promo.maxDiscount !== null && amount > promo.maxDiscount) {
        const capped = allocateAcross(
          lines.filter((l) => allocations.has(l.key)),
          allocations,
          promo.maxDiscount,
        );
        return { allocations: capped, amount: promo.maxDiscount, freeShipping: false };
      }
      return { allocations, amount, freeShipping: false };
    }

    case "bundle": {
      const count = bundleCount(promo, lines);
      if (count < 1 || promo.bundlePrice === null) return none;
      const consumed: Unit[] = [];
      const usedPerLine = new Map<string, number>();
      for (const item of promo.bundleItems) {
        const needed = Math.max(1, item.quantity) * count;
        const candidates = lines
          .filter((l) => (item.variantId ? l.variantId === item.variantId : l.productId === item.productId))
          .flatMap((l) => {
            const free = l.quantity - (usedPerLine.get(l.key) ?? 0);
            const perUnit = (remaining.get(l.key) ?? 0) / l.quantity;
            return Array.from({ length: Math.max(0, free) }, () => ({ key: l.key, price: perUnit }));
          })
          .sort((a, b) => a.price - b.price || a.key.localeCompare(b.key))
          .slice(0, needed);
        for (const unit of candidates) {
          usedPerLine.set(unit.key, (usedPerLine.get(unit.key) ?? 0) + 1);
          consumed.push(unit);
        }
      }
      const regular = Math.round(consumed.reduce((sum, u) => sum + u.price, 0));
      const amount = Math.max(0, regular - promo.bundlePrice * count);
      if (amount === 0) return none;
      const consumedValue = sumUnitsByKey(consumed);
      const involved = lines.filter((l) => consumedValue.has(l.key));
      const parts = allocateProportionally(
        amount,
        involved.map((l) => consumedValue.get(l.key) ?? 0),
      );
      const allocations = new Map<string, Paise>();
      involved.forEach((line, i) => {
        const capped = Math.min(parts[i], remaining.get(line.key) ?? 0);
        if (capped > 0) allocations.set(line.key, capped);
      });
      const total = [...allocations.values()].reduce((a, b) => a + b, 0);
      return { allocations, amount: total, freeShipping: false };
    }
  }
}

/** Item-level offers first, then scoped offers, then cart-wide offers. */
function applicationTier(promo: PricingPromotion): number {
  if (promo.type === "bundle" || promo.type === "buy_x_get_y") return 0;
  if (promo.type === "free_shipping") return 3;
  return promo.appliesTo === "all" ? 2 : 1;
}

function orderForApplication(promos: PricingPromotion[]): PricingPromotion[] {
  return [...promos].sort(
    (a, b) => applicationTier(a) - applicationTier(b) || b.priority - a.priority || a.id.localeCompare(b.id),
  );
}

function splitTax(amount: Paise, rate: number, inclusive: boolean): { taxable: Paise; tax: Paise } {
  if (amount <= 0 || rate <= 0) return { taxable: Math.max(0, amount), tax: 0 };
  if (inclusive) {
    const taxable = Math.round((amount * 100) / (100 + rate));
    return { taxable, tax: amount - taxable };
  }
  return { taxable: amount, tax: Math.round((amount * rate) / 100) };
}

function priceWithPromotions(input: PricingInput, promos: PricingPromotion[]) {
  const remaining = new Map<string, Paise>(input.lines.map((l) => [l.key, l.unitPrice * l.quantity]));
  const discounts = new Map<string, Paise>();
  const applied: AppliedPromotion[] = [];
  let freeShipping = false;

  for (const promo of orderForApplication(promos)) {
    const result = applyPromotion(promo, input.lines, remaining);
    if (result.amount <= 0 && !result.freeShipping) continue;
    for (const [key, value] of result.allocations) {
      remaining.set(key, (remaining.get(key) ?? 0) - value);
      discounts.set(key, (discounts.get(key) ?? 0) + value);
    }
    if (result.freeShipping) freeShipping = true;
    applied.push({
      id: promo.id,
      name: promo.name,
      code: promo.code,
      type: promo.type,
      amount: result.amount,
      freeShipping: result.freeShipping,
    });
  }

  const pricesIncludeTax = input.tax.pricesIncludeTax;
  const lines: PricedLine[] = input.lines.map((line) => {
    const lineSubtotal = line.unitPrice * line.quantity;
    const lineMrpTotal = Math.max(line.unitMrp, line.unitPrice) * line.quantity;
    const discount = Math.min(discounts.get(line.key) ?? 0, lineSubtotal);
    const lineTotal = lineSubtotal - discount;
    const { taxable, tax } = splitTax(lineTotal, line.taxRate, pricesIncludeTax);
    return { ...line, lineSubtotal, lineMrpTotal, discount, lineTotal, taxableValue: taxable, taxAmount: tax };
  });

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
  const mrpTotal = lines.reduce((sum, l) => sum + l.lineMrpTotal, 0);
  const discountTotal = lines.reduce((sum, l) => sum + l.discount, 0);
  const merchandiseTotal = subtotal - discountTotal;

  const rules = input.shipping;
  const expressAvailable = rules.expressEnabled;
  const method: ShippingMethod = input.shippingMethod === "express" && expressAvailable ? "express" : "standard";
  const shippingFeeBeforeDiscount = lines.length === 0 ? 0 : method === "express" ? rules.expressFee : rules.standardFee;
  const threshold = rules.freeShippingThreshold;
  const qualifiesByThreshold = threshold !== null && merchandiseTotal >= threshold;
  const shippingFee =
    method === "standard" && (qualifiesByThreshold || freeShipping) ? 0 : shippingFeeBeforeDiscount;

  // Free-shipping promotions only count as "applied" when they saved money.
  const appliedPromotions = applied.filter(
    (p) => p.amount > 0 || (p.freeShipping && method === "standard" && !qualifiesByThreshold && shippingFeeBeforeDiscount > 0),
  );
  for (const p of appliedPromotions) {
    if (p.freeShipping) p.amount = shippingFeeBeforeDiscount;
  }

  const preCodTotal = merchandiseTotal + shippingFee;
  let codAvailable = rules.codEnabled && lines.length > 0;
  let codUnavailableReason: string | null = rules.codEnabled ? null : "Cash on Delivery is currently unavailable.";
  if (codAvailable && rules.codMinOrderValue !== null && preCodTotal < rules.codMinOrderValue) {
    codAvailable = false;
    codUnavailableReason = `Cash on Delivery is available on orders of ${formatINR(rules.codMinOrderValue)} or more.`;
  }
  if (codAvailable && rules.codMaxOrderValue !== null && preCodTotal > rules.codMaxOrderValue) {
    codAvailable = false;
    codUnavailableReason = `Cash on Delivery is available on orders up to ${formatINR(rules.codMaxOrderValue)}.`;
  }
  const codFee = input.paymentMethod === "cod" && lines.length > 0 ? rules.codFee : 0;

  const lineTax = lines.reduce((sum, l) => sum + l.taxAmount, 0);
  const shippingTax = splitTax(shippingFee + codFee, input.tax.shippingTaxRate, pricesIncludeTax).tax;
  const taxTotal = lineTax + shippingTax;
  const interState =
    !!input.destinationState && !!input.tax.storeState && input.destinationState !== input.tax.storeState;
  const cgst = interState ? 0 : Math.floor(taxTotal / 2);
  const sgst = interState ? 0 : taxTotal - cgst;
  const igst = interState ? taxTotal : 0;

  const grandTotal = Math.max(0, merchandiseTotal + shippingFee + codFee + (pricesIncludeTax ? 0 : taxTotal));
  const productSavings = mrpTotal - subtotal;
  const shippingSavings = shippingFeeBeforeDiscount - shippingFee;

  return {
    lines,
    itemCount,
    mrpTotal,
    subtotal,
    productSavings,
    discountTotal,
    merchandiseTotal,
    shippingMethod: method,
    shippingFeeBeforeDiscount,
    shippingFee,
    codFee,
    codAvailable,
    codUnavailableReason,
    expressAvailable,
    taxTotal,
    tax: { cgst, sgst, igst, interState, shippingTax },
    grandTotal,
    totalSavings: productSavings + discountTotal + shippingSavings,
    appliedPromotions,
    freeShipping: {
      threshold,
      remaining: threshold === null ? 0 : Math.max(0, threshold - merchandiseTotal),
      qualified: qualifiesByThreshold || (freeShipping && method === "standard"),
    },
  };
}

export function calculatePricing(input: PricingInput): PricingResult {
  validateLines(input.lines);
  const context = { now: input.now, isFirstOrder: input.isFirstOrder };

  const candidates: PricingPromotion[] = [];
  for (const promo of input.promotions) {
    if (checkEligibility(promo, input.lines, context).eligible) candidates.push(promo);
  }

  let couponResult: PricingResult["coupon"] = null;
  let couponPromo: PricingPromotion | null = null;
  if (input.coupon) {
    const { code, promotion, blockedReason } = input.coupon;
    if (!promotion) {
      couponResult = { code, status: "invalid", message: blockedReason || "This coupon code is not valid." };
    } else if (blockedReason) {
      couponResult = { code, status: "not_eligible", message: blockedReason };
    } else {
      const eligibility = checkEligibility(promotion, input.lines, context);
      if (eligibility.eligible) {
        couponPromo = promotion;
        if (!candidates.some((c) => c.id === promotion.id)) candidates.push(promotion);
      } else {
        couponResult = { code, status: "not_eligible", message: eligibility.reason };
      }
    }
  }

  // Candidate combinations: all stackable offers together, or any single
  // non-stackable offer alone. The customer gets whichever is cheapest.
  const combos: PricingPromotion[][] = [];
  const stackable = candidates.filter((p) => p.stackable);
  combos.push(stackable);
  for (const promo of candidates.filter((p) => !p.stackable)) combos.push([promo]);

  let best: { result: ReturnType<typeof priceWithPromotions>; combo: PricingPromotion[] } | null = null;
  for (const combo of combos) {
    const result = priceWithPromotions(input, combo);
    if (!best) {
      best = { result, combo };
      continue;
    }
    const better = result.grandTotal < best.result.grandTotal;
    const tieWithCoupon =
      result.grandTotal === best.result.grandTotal &&
      couponPromo !== null &&
      combo.some((p) => p.id === couponPromo!.id) &&
      !best.combo.some((p) => p.id === couponPromo!.id);
    if (better || tieWithCoupon) best = { result, combo };
  }

  const final = best!.result;
  if (couponPromo && input.coupon) {
    const applied = final.appliedPromotions.find((p) => p.id === couponPromo!.id);
    if (applied) {
      couponResult = {
        code: input.coupon.code,
        status: "applied",
        message: applied.amount > 0 ? `Coupon applied. You save ${formatINR(applied.amount)}.` : "Coupon applied.",
      };
    } else if (best!.combo.some((p) => p.id === couponPromo!.id)) {
      couponResult = {
        code: input.coupon.code,
        status: "not_eligible",
        message: "This coupon does not reduce your current order total.",
      };
    } else {
      couponResult = {
        code: input.coupon.code,
        status: "not_combinable",
        message: "A better offer is already applied to your cart. This coupon cannot be combined with it.",
      };
    }
  }

  return { ...final, coupon: couponResult };
}

/** Convenience factory used by services and tests. */
export function createPromotion(partial: Partial<PricingPromotion> & Pick<PricingPromotion, "id" | "type">): PricingPromotion {
  return {
    name: partial.name ?? partial.id,
    code: null,
    isAutomatic: false,
    value: 0,
    maxDiscount: null,
    appliesTo: "all",
    productIds: [],
    categoryIds: [],
    buyQuantity: 1,
    getQuantity: 1,
    getDiscountPercent: 100,
    bundleItems: [],
    bundlePrice: null,
    minSubtotal: 0,
    minQuantity: 0,
    firstOrderOnly: false,
    stackable: false,
    priority: 0,
    startsAt: null,
    endsAt: null,
    ...partial,
  };
}
