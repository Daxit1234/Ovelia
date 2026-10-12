import { CsvParseError, parseCsv, unescapeCsvCell } from "@/lib/csv";
import { GST_RATES, SIZE_UNIT_OPTIONS } from "@/lib/validation/product";

/**
 * Product CSV format (one row per variant). Export and import use the same
 * columns, so an exported file can be edited and imported back. Variants are
 * matched by SKU; a blank cell leaves the current value unchanged.
 */
export const PRODUCT_CSV_COLUMNS = [
  "product_slug",
  "product_name",
  "category_slug",
  "status",
  "short_description",
  "gst_rate",
  "hsn_code",
  "tags",
  "sku",
  "variant_label",
  "size_value",
  "size_unit",
  "mrp",
  "price",
  "cost_price",
  "stock",
  "low_stock_threshold",
  "weight_grams",
  "variant_active",
] as const;

export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number];

export const PRODUCT_CSV_HELP: Record<ProductCsvColumn, string> = {
  product_slug: "Product URL handle. Rows with the same slug belong to one product. Blank for a new product: made from the name.",
  product_name: "Required for new products.",
  category_slug: "Required for new products, e.g. kitchen-care.",
  status: "draft or published. New products default to draft.",
  short_description: "One or two sentences shown near the price.",
  gst_rate: `One of ${GST_RATES.join(", ")}.`,
  hsn_code: "4–8 digits.",
  tags: "Separate tags with a vertical bar, e.g. floor|lavender",
  sku: "Required. Variants are matched by SKU.",
  variant_label: "e.g. 500 ml. Required for new variants.",
  size_value: "Number, e.g. 500. Required for new variants.",
  size_unit: `One of ${SIZE_UNIT_OPTIONS.join(", ")}. Required for new variants.`,
  mrp: "Rupees, e.g. 199 or 199.50. Required for new variants.",
  price: "Selling price in rupees (not above MRP). Required for new variants.",
  cost_price: "Rupees. Used for stock value only, never shown to customers.",
  stock: "Units available. Blank keeps the current stock; changes are logged as stock movements.",
  low_stock_threshold: "Alert when stock falls to this level.",
  weight_grams: "Packed weight in grams, for shipping.",
  variant_active: "yes or no.",
};

export const MAX_IMPORT_BYTES = 800 * 1024; // stays under the 1 MB Server Action body limit after encoding
export const MAX_IMPORT_ROWS = 5000;

export type SizeUnit = (typeof SIZE_UNIT_OPTIONS)[number];

export interface ProductCsvRow {
  line: number;
  productSlug: string | null;
  productName: string | null;
  categorySlug: string | null;
  status: "draft" | "published" | null;
  shortDescription: string | null;
  gstRate: number | null;
  hsnCode: string | null;
  tags: string[] | null;
  sku: string;
  variantLabel: string | null;
  sizeValue: number | null;
  sizeUnit: SizeUnit | null;
  /** Rupees. */
  mrp: number | null;
  price: number | null;
  costPrice: number | null;
  stock: number | null;
  lowStockThreshold: number | null;
  weightGrams: number | null;
  variantActive: boolean | null;
}

export interface CsvIssue {
  line: number;
  message: string;
}

const SKU_RX = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;
const SLUG_RX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

class CellError extends Error {}

const parsers = {
  text(max: number) {
    return (v: string) => {
      if (v.length > max) throw new CellError(`must be at most ${max} characters`);
      return v;
    };
  },
  slug(v: string) {
    const s = v.toLowerCase();
    if (!SLUG_RX.test(s) || s.length > 100) throw new CellError("use lowercase letters, numbers and hyphens");
    return s;
  },
  rupees(v: string) {
    const cleaned = v.replace(/[₹,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new CellError("must be an amount in rupees, e.g. 199 or 199.50");
    const n = Number(cleaned);
    if (n > 1_000_000) throw new CellError("is too large");
    return n;
  },
  int(max: number) {
    return (v: string) => {
      if (!/^\d+$/.test(v.replace(/,/g, ""))) throw new CellError("must be a whole number of 0 or more");
      const n = Number(v.replace(/,/g, ""));
      if (n > max) throw new CellError(`must be at most ${max}`);
      return n;
    };
  },
  positive(v: string) {
    if (!/^\d+(\.\d+)?$/.test(v)) throw new CellError("must be a positive number");
    const n = Number(v);
    if (n <= 0 || n > 100_000) throw new CellError("must be between 0 and 100000");
    return n;
  },
  bool(v: string) {
    const s = v.toLowerCase();
    if (["yes", "y", "true", "1", "active"].includes(s)) return true;
    if (["no", "n", "false", "0", "inactive"].includes(s)) return false;
    throw new CellError("must be yes or no");
  },
  status(v: string) {
    const s = v.toLowerCase();
    if (s !== "draft" && s !== "published") throw new CellError("must be draft or published");
    return s as "draft" | "published";
  },
  gst(v: string) {
    const n = Number(v.replace(/%/g, "").trim());
    if (!(GST_RATES as readonly number[]).includes(n)) throw new CellError(`must be one of ${GST_RATES.join(", ")}`);
    return n;
  },
  hsn(v: string) {
    if (!/^\d{4,8}$/.test(v)) throw new CellError("must be 4–8 digits");
    return v;
  },
  unit(v: string) {
    const s = v.toLowerCase();
    if (!(SIZE_UNIT_OPTIONS as readonly string[]).includes(s)) throw new CellError(`must be one of ${SIZE_UNIT_OPTIONS.join(", ")}`);
    return s as SizeUnit;
  },
  tags(v: string) {
    const tags = [...new Set(v.split("|").map((t) => t.trim()).filter(Boolean))];
    if (tags.length > 20 || tags.some((t) => t.length > 40)) throw new CellError("allows up to 20 tags of 40 characters");
    return tags;
  },
  sku(v: string) {
    const s = v.toUpperCase();
    if (!SKU_RX.test(s)) throw new CellError("must be 3–64 letters, numbers, - or _");
    return s;
  },
};

/** Parses and validates the cells of a product CSV. No database access. */
export function parseProductCsv(text: string): { rows: ProductCsvRow[]; issues: CsvIssue[] } {
  const issues: CsvIssue[] = [];
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { rows: [], issues: [{ line: 0, message: `The file is larger than ${Math.round(MAX_IMPORT_BYTES / 1024)} KB. Split it into smaller files.` }] };
  }
  let table: { line: number; cells: string[] }[];
  try {
    table = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvParseError) return { rows: [], issues: [{ line: 0, message: error.message }] };
    throw error;
  }
  if (table.length === 0) return { rows: [], issues: [{ line: 0, message: "The file is empty." }] };

  const [header, ...body] = table;
  const columns = header.cells.map(normaliseHeader);
  const index = new Map<string, number>();
  columns.forEach((name, i) => {
    if (!name) return;
    if (!(PRODUCT_CSV_COLUMNS as readonly string[]).includes(name)) issues.push({ line: header.line, message: `Unknown column “${header.cells[i].trim()}”.` });
    else if (index.has(name)) issues.push({ line: header.line, message: `Column “${name}” appears more than once.` });
    else index.set(name, i);
  });
  if (!index.has("sku")) issues.push({ line: header.line, message: "The sku column is required." });
  if (issues.length) return { rows: [], issues };
  if (body.length === 0) return { rows: [], issues: [{ line: header.line, message: "The file has no product rows." }] };
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], issues: [{ line: 0, message: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` }] };

  const rows: ProductCsvRow[] = [];
  const seenSkus = new Map<string, number>();
  for (const { line, cells } of body) {
    if (cells.length > columns.length && cells.slice(columns.length).some((c) => c.trim() !== "")) {
      issues.push({ line, message: "This row has more values than there are columns. Check for unquoted commas." });
      continue;
    }
    let rowOk = true;
    const cell = <T>(column: ProductCsvColumn, parse: (v: string) => T): T | null => {
      const i = index.get(column);
      if (i === undefined) return null;
      const raw = unescapeCsvCell((cells[i] ?? "").trim());
      if (raw === "") return null;
      try {
        return parse(raw);
      } catch (error) {
        if (!(error instanceof CellError)) throw error;
        issues.push({ line, message: `${column} ${error.message} (got “${raw.slice(0, 40)}”).` });
        rowOk = false;
        return null;
      }
    };
    const row: ProductCsvRow = {
      line,
      productSlug: cell("product_slug", parsers.slug),
      productName: cell("product_name", parsers.text(140)),
      categorySlug: cell("category_slug", parsers.slug),
      status: cell("status", parsers.status),
      shortDescription: cell("short_description", parsers.text(300)),
      gstRate: cell("gst_rate", parsers.gst),
      hsnCode: cell("hsn_code", parsers.hsn),
      tags: cell("tags", parsers.tags),
      sku: cell("sku", parsers.sku) ?? "",
      variantLabel: cell("variant_label", parsers.text(40)),
      sizeValue: cell("size_value", parsers.positive),
      sizeUnit: cell("size_unit", parsers.unit),
      mrp: cell("mrp", parsers.rupees),
      price: cell("price", parsers.rupees),
      costPrice: cell("cost_price", parsers.rupees),
      stock: cell("stock", parsers.int(1_000_000)),
      lowStockThreshold: cell("low_stock_threshold", parsers.int(100_000)),
      weightGrams: cell("weight_grams", parsers.int(100_000)),
      variantActive: cell("variant_active", parsers.bool),
    };
    if (!row.sku) {
      if (rowOk) issues.push({ line, message: "sku is required on every row." });
      continue;
    }
    const firstLine = seenSkus.get(row.sku);
    if (firstLine !== undefined) {
      issues.push({ line, message: `SKU ${row.sku} also appears on line ${firstLine}.` });
      continue;
    }
    seenSkus.set(row.sku, line);
    if (row.mrp !== null && row.price !== null && row.price > row.mrp) {
      issues.push({ line, message: "price cannot be higher than mrp." });
      rowOk = false;
    }
    if (rowOk) rows.push(row);
  }
  return { rows, issues };
}
