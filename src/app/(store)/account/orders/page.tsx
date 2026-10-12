import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Package } from "lucide-react";
import { ProductImage } from "@/components/shared/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listCustomerOrders } from "@/lib/data/orders";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 10;

async function OrdersList({ searchParams }: Pick<PageProps<"/account/orders">, "searchParams">) {
  const user = await requireUser("/account/orders");
  const pageParam = Number((await searchParams).page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const { orders, total } = await listCustomerOrders(user.id, page, PAGE_SIZE);
  const pages = Math.ceil(total / PAGE_SIZE);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border bg-white px-6 py-16 text-center">
        <Package className="size-12 text-brand-teal" aria-hidden />
        <h2 className="font-heading text-xl font-bold">No orders yet</h2>
        <p className="text-muted-foreground">When you place an order, it will appear here.</p>
        <Button asChild className="rounded-full">
          <Link href="/shop">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.orderNumber}>
            <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-4 rounded-3xl border bg-white p-4 transition-colors hover:border-brand-teal/50 sm:p-5">
              <div className="flex -space-x-3">
                {o.images.map((src, i) => (
                  <span key={`${src}-${i}`} className="relative size-14 overflow-hidden rounded-xl border-2 border-white bg-brand-mint">
                    <ProductImage src={src} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-brand-ink">{o.orderNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {formatINR(o.grandTotal)}
                </p>
              </div>
              <div className="hidden flex-col items-end gap-1 sm:flex">
                <Badge variant="secondary">{o.statusLabel}</Badge>
                <span className="text-xs text-muted-foreground">{o.paymentStatusLabel}</span>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav className="flex justify-center gap-2" aria-label="Pagination">
          {page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={`/account/orders?page=${page - 1}`}>Previous</Link>
            </Button>
          ) : null}
          <span className="self-center text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button variant="outline" asChild>
              <Link href={`/account/orders?page=${page + 1}`}>Next</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export default function OrdersPage(props: PageProps<"/account/orders">) {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink">Your orders</h1>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-3xl" />}>
        <OrdersList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
