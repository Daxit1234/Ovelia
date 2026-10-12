import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ProductImport } from "@/components/admin/products/product-import";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, PRODUCT_CSV_COLUMNS, PRODUCT_CSV_HELP } from "@/lib/admin/product-csv";

export const metadata: Metadata = { title: "Import products" };

export default async function ProductImportPage() {
  await requireStaffPage("products:import", "/admin/products/import");
  return (
    <>
      <AdminPageHeader
        title="Import products"
        description="Add or update products, variants, prices and stock in bulk from a spreadsheet."
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/api/admin/export/products">
                <Download className="size-4" /> Current catalog
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/admin/export/products?template=1">
                <Download className="size-4" /> Empty template
              </a>
            </Button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <ProductImport />
          <Panel title="Columns" description="Header names are not case-sensitive. Columns you leave out are not changed.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>Meaning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PRODUCT_CSV_COLUMNS.map((column) => (
                    <TableRow key={column}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{column}</TableCell>
                      <TableCell className="text-sm whitespace-normal">{PRODUCT_CSV_HELP[column]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </div>
        <Panel title="How it works">
          <ol className="list-decimal space-y-2.5 pl-5 text-sm">
            <li>Download the current catalog (or the empty template) and edit it in Excel or Google Sheets.</li>
            <li>Save it as CSV (UTF-8). One row per variant; rows with the same product_slug form one product.</li>
            <li>Upload it and preview. Nothing changes until you confirm the import.</li>
          </ol>
          <ul className="mt-4 space-y-2 border-t pt-4 text-sm text-muted-foreground">
            <li>Variants are matched by SKU. A blank cell keeps the current value.</li>
            <li>stock sets the exact number of units available. Each change is recorded in Inventory as a CSV import.</li>
            <li>Importing never deletes products or variants. Images, descriptions and SEO are edited in the product editor.</li>
            <li>
              Up to {MAX_IMPORT_ROWS.toLocaleString("en-IN")} rows or {Math.round(MAX_IMPORT_BYTES / 1024)} KB per file.
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
