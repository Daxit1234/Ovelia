import { describe, expect, it } from "vitest";
import { parseProductCsv, PRODUCT_CSV_COLUMNS } from "@/lib/admin/product-csv";
import { csvCell, parseCsv, toCsv, unescapeCsvCell } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas and line breaks", () => {
    const rows = parseCsv('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\n');
    expect(rows).toEqual([
      { line: 1, cells: ["a", "b", "c"] },
      { line: 2, cells: ["x, y", 'say "hi"', "line1\nline2"] },
    ]);
  });

  it("strips the BOM, skips blank lines and reports source line numbers", () => {
    const rows = parseCsv("﻿sku\n\nA-1\n,\nB-2");
    expect(rows).toEqual([
      { line: 1, cells: ["sku"] },
      { line: 3, cells: ["A-1"] },
      { line: 5, cells: ["B-2"] },
    ]);
  });

  it("rejects an unterminated quoted value", () => {
    expect(() => parseCsv('a\n"open')).toThrow(/never closed/);
  });

  it("round-trips values written by toCsv, including guarded formulas", () => {
    const csv = toCsv([{ v: "=SUM(A1)" }, { v: 'He said "ok", then left' }], [{ header: "v", value: (r) => r.v }]);
    const [, ...body] = parseCsv(csv);
    expect(body.map((r) => unescapeCsvCell(r.cells[0]))).toEqual(["=SUM(A1)", 'He said "ok", then left']);
    expect(csvCell("-5")).toBe("'-5");
  });
});

describe("parseProductCsv", () => {
  const header = PRODUCT_CSV_COLUMNS.join(",");

  it("parses a full row in rupees with normalised values", () => {
    const row = "floor-cleaner,Floor Cleaner,floor-care,Published,Fresh floors,18%,3402,floor|lavender,ov-fl-500,500 ml,500,ML,\"₹1,199.00\",999.5,400,25,5,550,yes";
    const { rows, issues } = parseProductCsv(`${header}\n${row}`);
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({
      line: 2,
      productSlug: "floor-cleaner",
      status: "published",
      gstRate: 18,
      tags: ["floor", "lavender"],
      sku: "OV-FL-500",
      sizeUnit: "ml",
      mrp: 1199,
      price: 999.5,
      stock: 25,
      variantActive: true,
    });
  });

  it("treats blank cells as 'keep current value'", () => {
    const { rows, issues } = parseProductCsv("sku,price,stock\nOV-1,,\n");
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({ sku: "OV-1", price: null, stock: null, productName: null });
  });

  it("reports unknown and missing columns before reading rows", () => {
    expect(parseProductCsv("sku,price_inr\nA-1,10").issues).toEqual([{ line: 1, message: "Unknown column “price_inr”." }]);
    expect(parseProductCsv("price\n10").issues).toEqual([{ line: 1, message: "The sku column is required." }]);
  });

  it("flags invalid cells, duplicate SKUs and price above MRP with line numbers", () => {
    const { rows, issues } = parseProductCsv("sku,mrp,price,stock,variant_active\nAA-1,100,120,5,yes\nAA-2,abc,10,-1,maybe\nAA-3,10,5,1,no\nAA-3,10,5,1,no");
    expect(rows.map((r) => r.sku)).toEqual(["AA-3"]);
    expect(issues.map((i) => i.line)).toEqual([2, 3, 3, 3, 5]);
    expect(issues[0].message).toMatch(/price cannot be higher than mrp/);
    expect(issues[1].message).toMatch(/^mrp must be an amount in rupees/);
    expect(issues[4].message).toBe("SKU AA-3 also appears on line 4.");
  });

  it("rejects rows with more values than columns", () => {
    const { issues } = parseProductCsv("sku,price\nAA-1,10,extra");
    expect(issues[0]).toMatchObject({ line: 2 });
  });
});
