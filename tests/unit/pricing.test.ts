import { describe, expect, it } from "vitest";
import {
  calculatePricing,
  createPromotion,
  type PricingInput,
  type PricingLine,
} from "@/lib/domain/pricing";

const NOW = new Date("2026-10-12T10:00:00+05:30");

function line(partial: Partial<PricingLine> & Pick<PricingLine, "key">): PricingLine {
  return {
    productId: `p-${partial.key}`,
    variantId: partial.key,
    categoryIds: ["c-home"],
    quantity: 1,
    unitPrice: 10_000,
    unitMrp: 12_000,
    taxRate: 18,
    ...partial,
  };
}

function input(partial: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [line({ key: "a" })],
    promotions: [],
    coupon: null,
    shippingMethod: "standard",
    paymentMethod: null,
    destinationState: "Maharashtra",
    isFirstOrder: null,
    shipping: {
      standardFee: 4_900,
      expressEnabled: true,
      expressFee: 9_900,
      freeShippingThreshold: 49_900,
      codEnabled: true,
      codFee: 3_000,
      codMinOrderValue: null,
      codMaxOrderValue: 500_000,
    },
    tax: { pricesIncludeTax: true, shippingTaxRate: 18, storeState: "Maharashtra" },
    now: NOW,
    ...partial,
  };
}

describe("calculatePricing — basics", () => {
  it("computes subtotal, MRP savings and shipping for a simple cart", () => {
    const result = calculatePricing(input({ lines: [line({ key: "a", quantity: 2 })] }));
    expect(result.subtotal).toBe(20_000);
    expect(result.mrpTotal).toBe(24_000);
    expect(result.productSavings).toBe(4_000);
    expect(result.shippingFee).toBe(4_900);
    expect(result.grandTotal).toBe(24_900);
    expect(result.freeShipping).toEqual({ threshold: 49_900, remaining: 29_900, qualified: false });
  });

  it("returns zero totals for an empty cart", () => {
    const result = calculatePricing(input({ lines: [] }));
    expect(result.grandTotal).toBe(0);
    expect(result.shippingFee).toBe(0);
    expect(result.codAvailable).toBe(false);
  });

  it("gives free standard shipping at the threshold but still charges express", () => {
    const lines = [line({ key: "a", unitPrice: 49_900, unitMrp: 49_900 })];
    expect(calculatePricing(input({ lines })).shippingFee).toBe(0);
    const express = calculatePricing(input({ lines, shippingMethod: "express" }));
    expect(express.shippingFee).toBe(9_900);
    expect(express.grandTotal).toBe(59_800);
  });

  it("falls back to standard shipping when express is disabled", () => {
    const result = calculatePricing(
      input({ shippingMethod: "express", shipping: { ...input().shipping, expressEnabled: false } }),
    );
    expect(result.shippingMethod).toBe("standard");
    expect(result.shippingFee).toBe(4_900);
  });

  it("adds the COD fee and enforces COD limits", () => {
    const cod = calculatePricing(input({ paymentMethod: "cod" }));
    expect(cod.codFee).toBe(3_000);
    expect(cod.grandTotal).toBe(10_000 + 4_900 + 3_000);

    const limited = calculatePricing(
      input({ shipping: { ...input().shipping, codMaxOrderValue: 5_000 }, paymentMethod: "cod" }),
    );
    expect(limited.codAvailable).toBe(false);
    expect(limited.codUnavailableReason).toMatch(/up to/);
  });

  it("rejects invalid quantities and prices", () => {
    expect(() => calculatePricing(input({ lines: [line({ key: "a", quantity: 0 })] }))).toThrow();
    expect(() => calculatePricing(input({ lines: [line({ key: "a", quantity: 1.5 })] }))).toThrow();
    expect(() => calculatePricing(input({ lines: [line({ key: "a", unitPrice: -1 })] }))).toThrow();
  });

  it("never reports MRP savings when MRP is below the selling price", () => {
    const result = calculatePricing(input({ lines: [line({ key: "a", unitPrice: 10_000, unitMrp: 9_000 })] }));
    expect(result.productSavings).toBe(0);
  });
});

describe("calculatePricing — taxes", () => {
  it("extracts inclusive GST and splits CGST/SGST for intra-state supply", () => {
    const result = calculatePricing(input({ lines: [line({ key: "a", unitPrice: 11_800 })] }));
    const priced = result.lines[0];
    expect(priced.taxableValue).toBe(10_000);
    expect(priced.taxAmount).toBe(1_800);
    expect(result.tax.interState).toBe(false);
    expect(result.tax.cgst + result.tax.sgst).toBe(result.taxTotal);
    expect(result.tax.igst).toBe(0);
    // inclusive prices: tax does not change the grand total
    expect(result.grandTotal).toBe(11_800 + 4_900);
  });

  it("uses IGST for inter-state supply", () => {
    const result = calculatePricing(input({ destinationState: "Karnataka" }));
    expect(result.tax.interState).toBe(true);
    expect(result.tax.igst).toBe(result.taxTotal);
  });

  it("adds tax on top when prices exclude tax", () => {
    const result = calculatePricing(
      input({
        lines: [line({ key: "a", unitPrice: 10_000 })],
        tax: { pricesIncludeTax: false, shippingTaxRate: 18, storeState: "Maharashtra" },
      }),
    );
    expect(result.lines[0].taxAmount).toBe(1_800);
    expect(result.grandTotal).toBe(10_000 + 4_900 + result.taxTotal);
  });
});

describe("calculatePricing — promotions", () => {
  it("applies a capped percentage coupon", () => {
    const promo = createPromotion({ id: "welcome", type: "percentage", value: 50, maxDiscount: 3_000, code: "WELCOME" });
    const result = calculatePricing(input({ coupon: { code: "WELCOME", promotion: promo } }));
    expect(result.discountTotal).toBe(3_000);
    expect(result.coupon?.status).toBe("applied");
  });

  it("applies a fixed discount but never below zero", () => {
    const promo = createPromotion({ id: "flat", type: "fixed", value: 50_000, code: "FLAT" });
    const result = calculatePricing(input({ coupon: { code: "FLAT", promotion: promo } }));
    expect(result.discountTotal).toBe(10_000);
    expect(result.merchandiseTotal).toBe(0);
    expect(result.grandTotal).toBeGreaterThanOrEqual(0);
  });

  it("restricts discounts to the configured products and categories", () => {
    const lines = [
      line({ key: "a", productId: "dish", categoryIds: ["kitchen"] }),
      line({ key: "b", productId: "car", categoryIds: ["car-care"] }),
    ];
    const byCategory = createPromotion({ id: "k", type: "percentage", value: 10, appliesTo: "categories", categoryIds: ["kitchen"], isAutomatic: true });
    const result = calculatePricing(input({ lines, promotions: [byCategory] }));
    expect(result.lines.find((l) => l.key === "a")!.discount).toBe(1_000);
    expect(result.lines.find((l) => l.key === "b")!.discount).toBe(0);
  });

  it("enforces minimum cart value and explains what is missing", () => {
    const promo = createPromotion({ id: "min", type: "percentage", value: 10, minSubtotal: 50_000, code: "SAVE10" });
    const result = calculatePricing(input({ coupon: { code: "SAVE10", promotion: promo } }));
    expect(result.coupon?.status).toBe("not_eligible");
    expect(result.coupon?.message).toContain("₹400");
    expect(result.discountTotal).toBe(0);
  });

  it("implements 'buy 2 products and save 10%' with a minimum quantity", () => {
    const promo = createPromotion({ id: "buy2", type: "percentage", value: 10, minQuantity: 2, isAutomatic: true });
    const one = calculatePricing(input({ promotions: [promo] }));
    expect(one.discountTotal).toBe(0);
    const two = calculatePricing(input({ promotions: [promo], lines: [line({ key: "a", quantity: 2 })] }));
    expect(two.discountTotal).toBe(2_000);
  });

  it("rejects expired and not-yet-started offers", () => {
    const expired = createPromotion({ id: "old", type: "percentage", value: 10, code: "OLD", endsAt: new Date("2026-01-01") });
    const future = createPromotion({ id: "new", type: "percentage", value: 10, code: "NEW", startsAt: new Date("2027-01-01") });
    expect(calculatePricing(input({ coupon: { code: "OLD", promotion: expired } })).coupon?.message).toMatch(/expired/);
    expect(calculatePricing(input({ coupon: { code: "NEW", promotion: future } })).coupon?.message).toMatch(/not started/);
  });

  it("restricts first-order coupons to first orders", () => {
    const promo = createPromotion({ id: "first", type: "percentage", value: 10, firstOrderOnly: true, code: "FIRST" });
    const repeat = calculatePricing(input({ isFirstOrder: false, coupon: { code: "FIRST", promotion: promo } }));
    expect(repeat.coupon?.status).toBe("not_eligible");
    const first = calculatePricing(input({ isFirstOrder: true, coupon: { code: "FIRST", promotion: promo } }));
    expect(first.coupon?.status).toBe("applied");
  });

  it("surfaces service-level blocks such as usage limits", () => {
    const promo = createPromotion({ id: "used", type: "percentage", value: 10, code: "USED" });
    const result = calculatePricing(
      input({ coupon: { code: "USED", promotion: promo, blockedReason: "You have already used this coupon." } }),
    );
    expect(result.coupon).toMatchObject({ status: "not_eligible", message: "You have already used this coupon." });
    expect(result.discountTotal).toBe(0);
  });

  it("reports unknown coupon codes as invalid", () => {
    const result = calculatePricing(input({ coupon: { code: "NOPE", promotion: null } }));
    expect(result.coupon?.status).toBe("invalid");
  });

  it("gives the cheapest units free in buy X get Y offers", () => {
    const promo = createPromotion({ id: "b2g1", type: "buy_x_get_y", buyQuantity: 2, getQuantity: 1, getDiscountPercent: 100, isAutomatic: true });
    const lines = [
      line({ key: "exp", unitPrice: 30_000, unitMrp: 30_000, quantity: 2 }),
      line({ key: "cheap", unitPrice: 10_000, unitMrp: 10_000, quantity: 1 }),
    ];
    const result = calculatePricing(input({ lines, promotions: [promo] }));
    expect(result.discountTotal).toBe(10_000);
    expect(result.lines.find((l) => l.key === "cheap")!.discount).toBe(10_000);
  });

  it("prices a combo bundle at the bundle price, once per complete set", () => {
    const promo = createPromotion({
      id: "combo",
      type: "bundle",
      isAutomatic: true,
      bundlePrice: 15_000,
      bundleItems: [
        { productId: "dish", variantId: null, quantity: 1 },
        { productId: "floor", variantId: null, quantity: 1 },
      ],
    });
    const lines = [
      line({ key: "d", productId: "dish", unitPrice: 9_900, unitMrp: 9_900, quantity: 2 }),
      line({ key: "f", productId: "floor", unitPrice: 11_900, unitMrp: 11_900, quantity: 1 }),
    ];
    const result = calculatePricing(input({ lines, promotions: [promo] }));
    // one complete set: 9,900 + 11,900 = 21,800 -> 15,000 => 6,800 off
    expect(result.discountTotal).toBe(6_800);
    expect(result.lines.reduce((s, l) => s + l.discount, 0)).toBe(6_800);
  });

  it("does not apply a bundle when a component is missing", () => {
    const promo = createPromotion({
      id: "combo",
      type: "bundle",
      isAutomatic: true,
      bundlePrice: 15_000,
      bundleItems: [
        { productId: "dish", variantId: null, quantity: 1 },
        { productId: "floor", variantId: null, quantity: 1 },
      ],
    });
    const lines = [line({ key: "d", productId: "dish" })];
    expect(calculatePricing(input({ lines, promotions: [promo] })).discountTotal).toBe(0);
  });

  it("applies free-shipping coupons only when they save money", () => {
    const promo = createPromotion({ id: "ship", type: "free_shipping", code: "SHIPFREE" });
    const result = calculatePricing(input({ coupon: { code: "SHIPFREE", promotion: promo } }));
    expect(result.shippingFee).toBe(0);
    expect(result.coupon?.status).toBe("applied");
    expect(result.appliedPromotions[0]).toMatchObject({ freeShipping: true, amount: 4_900 });
  });

  it("stacks stackable offers and picks the best non-stackable alternative", () => {
    const autoA = createPromotion({ id: "auto5", type: "percentage", value: 5, isAutomatic: true, stackable: true, priority: 10 });
    const autoB = createPromotion({ id: "auto100", type: "fixed", value: 100, isAutomatic: true, stackable: true });
    const coupon = createPromotion({ id: "big", type: "percentage", value: 20, code: "BIG" });
    const lines = [line({ key: "a", unitPrice: 50_000, unitMrp: 50_000 })];

    const stacked = calculatePricing(input({ lines, promotions: [autoA, autoB] }));
    expect(stacked.discountTotal).toBe(2_500 + 100);

    const withCoupon = calculatePricing(input({ lines, promotions: [autoA, autoB], coupon: { code: "BIG", promotion: coupon } }));
    expect(withCoupon.discountTotal).toBe(10_000);
    expect(withCoupon.coupon?.status).toBe("applied");
    expect(withCoupon.appliedPromotions.map((p) => p.id)).toEqual(["big"]);
  });

  it("tells the customer when a weaker non-stackable coupon loses to automatic offers", () => {
    const auto = createPromotion({ id: "auto", type: "percentage", value: 15, isAutomatic: true, stackable: true });
    const weak = createPromotion({ id: "weak", type: "percentage", value: 5, code: "WEAK" });
    const result = calculatePricing(input({ promotions: [auto], coupon: { code: "WEAK", promotion: weak } }));
    expect(result.coupon?.status).toBe("not_combinable");
    expect(result.discountTotal).toBe(1_500);
  });

  it("keeps discounts allocated across lines consistent with the total", () => {
    const promo = createPromotion({ id: "p", type: "fixed", value: 1_001, isAutomatic: true });
    const lines = [
      line({ key: "a", unitPrice: 3_333, unitMrp: 3_333 }),
      line({ key: "b", unitPrice: 3_333, unitMrp: 3_333 }),
      line({ key: "c", unitPrice: 3_334, unitMrp: 3_334 }),
    ];
    const result = calculatePricing(input({ lines, promotions: [promo] }));
    expect(result.discountTotal).toBe(1_001);
    expect(result.lines.reduce((s, l) => s + l.discount, 0)).toBe(1_001);
    for (const l of result.lines) expect(l.lineTotal).toBeGreaterThanOrEqual(0);
  });
});
