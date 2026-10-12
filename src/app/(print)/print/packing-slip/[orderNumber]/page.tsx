import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PackingSlip } from "@/components/shared/invoice-document";
import { requireStaffPage } from "@/lib/auth/session";
import { loadInvoiceData } from "@/lib/data/invoice";

export const metadata: Metadata = { title: "Packing slip" };

async function Slip({ params }: PageProps<"/print/packing-slip/[orderNumber]">) {
  const { orderNumber } = await params;
  await requireStaffPage("orders:read", `/print/packing-slip/${orderNumber}`);
  const result = await loadInvoiceData(orderNumber);
  if (!result) notFound();
  return <PackingSlip data={result.data} />;
}

export default function PackingSlipPage(props: PageProps<"/print/packing-slip/[orderNumber]">) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-neutral-500">Loading…</p>}>
      <Slip {...props} />
    </Suspense>
  );
}
