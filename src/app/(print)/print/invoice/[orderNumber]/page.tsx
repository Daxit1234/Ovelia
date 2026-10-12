import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import { getSessionUser } from "@/lib/auth/session";
import { loadInvoiceData } from "@/lib/data/invoice";
import { hasPermission } from "@/lib/domain/roles";
import { verifyOrderAccessToken } from "@/lib/services/order-access";

export const metadata: Metadata = { title: "Tax invoice" };

async function Invoice({ params, searchParams }: PageProps<"/print/invoice/[orderNumber]">) {
  const { orderNumber } = await params;
  const token = (await searchParams).token;
  const result = await loadInvoiceData(orderNumber);
  if (!result) notFound();
  const user = await getSessionUser();
  const isStaff = !!user && hasPermission(user.role, "orders:read");
  const isOwner = !!user && result.order.userId?.toHexString() === user.id;
  const viaToken = verifyOrderAccessToken(result.order._id.toHexString(), typeof token === "string" ? token : null);
  if (!isStaff && !isOwner && !viaToken) notFound();
  if (!result.data.invoiceNumber && !isStaff) notFound();
  return (
    <>
      {!result.data.invoiceNumber ? (
        <p className="no-print mx-auto mb-3 max-w-[210mm] rounded bg-amber-100 p-3 text-sm text-amber-900">
          Draft preview — an invoice number is assigned when the order is packed or shipped.
        </p>
      ) : null}
      <InvoiceDocument data={result.data} />
    </>
  );
}

export default function InvoicePage(props: PageProps<"/print/invoice/[orderNumber]">) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-neutral-500">Loading invoice…</p>}>
      <Invoice {...props} />
    </Suspense>
  );
}
