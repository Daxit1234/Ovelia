import { LogoMark } from "@/components/brand/logo";
import { PrintButton } from "@/components/shared/print-button";
import type { InvoiceData } from "@/lib/data/invoice";
import { formatDate } from "@/lib/format";
import { formatINRPrecise } from "@/lib/money";

function Addr({ a }: { a: InvoiceData["buyer"]["billing"] }) {
  return (
    <>
      {a.fullName}
      <br />
      {a.line1}
      {a.line2 ? `, ${a.line2}` : ""}
      <br />
      {a.city}, {a.state} {a.pincode}
      <br />
      Ph: {a.phone}
    </>
  );
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const placeholders = /\[[^\]]+\]/;
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-[12px] leading-5 text-black print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div className="flex items-start gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="text-lg font-bold">{data.seller.legalName}</p>
            <p>{data.seller.address}</p>
            <p>GSTIN: {data.seller.gstin}</p>
            {data.seller.email || data.seller.phone ? <p>{[data.seller.email, data.seller.phone].filter(Boolean).join(" · ")}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-wide">TAX INVOICE</p>
          <p>Invoice no: {data.invoiceNumber ?? "—"}</p>
          <p>Invoice date: {data.invoiceDate ? formatDate(data.invoiceDate) : "—"}</p>
          <p>Order no: {data.orderNumber}</p>
          <p>Order date: {formatDate(data.orderDate)}</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4 border-b py-4">
        <div>
          <p className="font-bold">Bill to</p>
          <p>
            <Addr a={data.buyer.billing} />
          </p>
          <p>{data.buyer.email}</p>
        </div>
        <div>
          <p className="font-bold">Ship to</p>
          <p>
            <Addr a={data.buyer.shipping} />
          </p>
        </div>
        <div>
          <p className="font-bold">Details</p>
          <p>Place of supply: {data.placeOfSupply}</p>
          <p>Supply type: {data.interState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}</p>
          <p>Payment: {data.paymentMethod}</p>
          <p>Shipping: {data.shippingMethod}</p>
        </div>
      </section>

      <table className="mt-4 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Description</th>
            <th className="py-1.5 pr-2">HSN/SAC</th>
            <th className="py-1.5 pr-2 text-right">Qty</th>
            <th className="py-1.5 pr-2 text-right">Rate</th>
            <th className="py-1.5 pr-2 text-right">Discount</th>
            <th className="py-1.5 pr-2 text-right">Taxable</th>
            <th className="py-1.5 pr-2 text-right">GST %</th>
            {data.interState ? (
              <th className="py-1.5 pr-2 text-right">IGST</th>
            ) : (
              <>
                <th className="py-1.5 pr-2 text-right">CGST</th>
                <th className="py-1.5 pr-2 text-right">SGST</th>
              </>
            )}
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.description}-${i}`} className="border-b align-top">
              <td className="py-1.5 pr-2">{i + 1}</td>
              <td className="py-1.5 pr-2">
                {line.description}
                {line.sku ? <span className="block text-[10px] text-neutral-600">SKU {line.sku}</span> : null}
              </td>
              <td className="py-1.5 pr-2">{line.hsn}</td>
              <td className="py-1.5 pr-2 text-right">{line.quantity}</td>
              <td className="py-1.5 pr-2 text-right">{formatINRPrecise(line.unitPrice)}</td>
              <td className="py-1.5 pr-2 text-right">{line.discount ? formatINRPrecise(line.discount) : "—"}</td>
              <td className="py-1.5 pr-2 text-right">{formatINRPrecise(line.taxableValue)}</td>
              <td className="py-1.5 pr-2 text-right">{line.taxRate}%</td>
              {data.interState ? (
                <td className="py-1.5 pr-2 text-right">{formatINRPrecise(line.igst)}</td>
              ) : (
                <>
                  <td className="py-1.5 pr-2 text-right">{formatINRPrecise(line.cgst)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatINRPrecise(line.sgst)}</td>
                </>
              )}
              <td className="py-1.5 text-right">{formatINRPrecise(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-between gap-8">
        <div className="max-w-[55%] space-y-2">
          <p>
            <span className="font-bold">Amount in words:</span> {data.amountInWords}
          </p>
          {data.pricesIncludeTax ? <p className="text-neutral-600">Prices are inclusive of GST.</p> : null}
          {placeholders.test(`${data.seller.legalName}${data.seller.gstin}${data.seller.address}`) ? (
            <p className="no-print rounded bg-amber-100 p-2 text-amber-900">Complete the business name, address and GSTIN in Admin → Settings before issuing invoices.</p>
          ) : null}
        </div>
        <table className="w-64 text-right">
          <tbody>
            <tr>
              <td className="py-0.5">Taxable value</td>
              <td className="py-0.5">{formatINRPrecise(data.totals.taxable)}</td>
            </tr>
            {data.interState ? (
              <tr>
                <td className="py-0.5">IGST</td>
                <td className="py-0.5">{formatINRPrecise(data.totals.igst)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td className="py-0.5">CGST</td>
                  <td className="py-0.5">{formatINRPrecise(data.totals.cgst)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">SGST</td>
                  <td className="py-0.5">{formatINRPrecise(data.totals.sgst)}</td>
                </tr>
              </>
            )}
            <tr className="border-t border-black text-[13px] font-bold">
              <td className="pt-1">Grand total</td>
              <td className="pt-1">{formatINRPrecise(data.totals.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-10 flex items-end justify-between border-t pt-4 text-[11px] text-neutral-600">
        <p>This is a computer-generated invoice and does not require a physical signature.</p>
        <p className="text-right">
          For {data.seller.legalName}
          <br />
          <span className="mt-6 inline-block">Authorised signatory</span>
        </p>
      </footer>
    </div>
  );
}

export function PackingSlip({ data }: { data: InvoiceData }) {
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-[13px] leading-6 text-black print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <LogoMark className="size-9" />
          <p className="text-xl font-bold">{data.seller.name}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">PACKING SLIP</p>
          <p>Order: {data.orderNumber}</p>
          <p>Date: {formatDate(data.orderDate)}</p>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 py-4">
        <div>
          <p className="font-bold">Ship to</p>
          <p>
            <Addr a={data.buyer.shipping} />
          </p>
        </div>
        <div>
          <p className="font-bold">Shipping</p>
          <p>{data.shippingMethod}</p>
          <p>Payment: {data.paymentMethod}</p>
          {data.paymentStatus !== "paid" && data.paymentMethod.startsWith("Cash") ? <p className="font-bold">COLLECT {formatINRPrecise(data.totals.grandTotal)} ON DELIVERY</p> : null}
        </div>
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-2">✓</th>
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={`${item.sku}-${i}`} className="border-b">
              <td className="py-2">
                <span className="inline-block size-4 border border-black" />
              </td>
              <td className="py-2">
                {item.name} — {item.variant}
              </td>
              <td className="py-2 font-mono">{item.sku}</td>
              <td className="py-2 text-right text-base font-bold">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.customerNote ? (
        <p className="mt-4 rounded border p-2">
          <span className="font-bold">Customer note:</span> {data.customerNote}
        </p>
      ) : null}
      <p className="mt-8 text-[11px] text-neutral-600">Check every item for leaks and secure all caps before packing liquids.</p>
    </div>
  );
}
