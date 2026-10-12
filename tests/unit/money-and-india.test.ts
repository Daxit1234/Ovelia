import { describe, expect, it } from "vitest";
import { allocateProportionally, discountPercent, formatINR, rupeesInWords, toPaise } from "@/lib/money";
import { financialYear, gstStateCode, maskEmail, normalizeIndianMobile, PINCODE_REGEX } from "@/lib/india";
import { slugify, formatSize } from "@/lib/format";

describe("money", () => {
  it("converts rupees to integer paise without float drift", () => {
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it("formats INR in the Indian grouping style", () => {
    expect(formatINR(12345600)).toBe("₹1,23,456");
    expect(formatINR(129950)).toBe("₹1,299.50");
  });

  it("only reports a discount when MRP is higher", () => {
    expect(discountPercent(20000, 15000)).toBe(25);
    expect(discountPercent(15000, 15000)).toBe(0);
    expect(discountPercent(10000, 15000)).toBe(0);
  });

  it("allocates integer amounts that sum exactly", () => {
    const parts = allocateProportionally(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocateProportionally(50, [0, 0])).toEqual([0, 0]);
  });

  it("writes amounts in words using lakh and crore", () => {
    expect(rupeesInWords(1_25_00_000_00)).toBe("One Crore Twenty Five Lakh Rupees Only");
    expect(rupeesInWords(129_950)).toBe("One Thousand Two Hundred Ninety Nine Rupees and Fifty Paise Only");
  });
});

describe("india helpers", () => {
  it("validates PIN codes", () => {
    expect(PINCODE_REGEX.test("400001")).toBe(true);
    expect(PINCODE_REGEX.test("012345")).toBe(false);
    expect(PINCODE_REGEX.test("40001")).toBe(false);
  });

  it("normalises Indian mobile numbers", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("1234567890")).toBeNull();
  });

  it("maps states to GST codes", () => {
    expect(gstStateCode("Maharashtra")).toBe("27");
    expect(gstStateCode("Atlantis")).toBeNull();
  });

  it("computes the Indian financial year in IST", () => {
    expect(financialYear(new Date("2026-03-31T20:00:00Z"))).toBe("2026-27"); // 1 Apr 01:30 IST
    expect(financialYear(new Date("2026-03-31T10:00:00Z"))).toBe("2025-26");
  });

  it("masks personal data", () => {
    expect(maskEmail("customer@example.com")).toBe("cu••••••@example.com");
  });
});

describe("format", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Lemon Fresh Dishwash Liquid — 500 ml")).toBe("lemon-fresh-dishwash-liquid-500-ml");
    expect(slugify("Car Shampoo & Wax")).toBe("car-shampoo-and-wax");
  });

  it("formats volumes", () => {
    expect(formatSize(500, "ml")).toBe("500 ml");
    expect(formatSize(5000, "ml")).toBe("5 L");
  });
});
