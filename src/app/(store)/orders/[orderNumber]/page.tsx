import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetail } from "@/components/store/orders/order-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicSettings } from "@/lib/data/content";
import { getOrderForCustomer } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

function first(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

async function GuestOrder({ params, searchParams }: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const token = first(sp.token);
  const [user, settings] = await Promise.all([getSessionUser(), getPublicSettings()]);
  const order = await getOrderForCustomer(orderNumber, { userId: user?.id ?? null, token });
  if (!order) notFound();
  const invoiceHref = order.invoiceNumber ? `/print/invoice/${order.orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}` : null;
  return <OrderDetail order={order} token={token} placed={first(sp.placed) === "1"} storeName={settings.store.name} invoiceHref={invoiceHref} />;
}

export default function GuestOrderPage(props: PageProps<"/orders/[orderNumber]">) {
  return (
    <div className="container-page max-w-5xl py-8 sm:py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <GuestOrder {...props} />
      </Suspense>
    </div>
  );
}
