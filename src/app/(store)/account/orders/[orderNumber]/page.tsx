import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetail } from "@/components/store/orders/order-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getPublicSettings } from "@/lib/data/content";
import { getOrderForCustomer } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Order details" };

async function AccountOrder({ params, searchParams }: PageProps<"/account/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const user = await requireUser(`/account/orders/${orderNumber}`);
  const [order, settings] = await Promise.all([getOrderForCustomer(orderNumber, { userId: user.id }), getPublicSettings()]);
  if (!order) notFound();
  const placed = (await searchParams).placed === "1";
  return (
    <OrderDetail
      order={order}
      token={null}
      placed={placed}
      storeName={settings.store.name}
      invoiceHref={order.invoiceNumber ? `/print/invoice/${order.orderNumber}` : null}
    />
  );
}

export default function AccountOrderPage(props: PageProps<"/account/orders/[orderNumber]">) {
  return (
    <div className="space-y-4">
      <Link href="/account/orders" className="text-sm font-semibold text-brand-green hover:underline">
        ← All orders
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <AccountOrder {...props} />
      </Suspense>
    </div>
  );
}
