import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from "@/lib/domain/order-status";
import { RETURN_STATUS_LABELS } from "@/lib/domain/returns";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 space-y-3">
      {back ? (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-brand-green">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-white", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
          <div>
            <h2 className="font-heading text-base font-semibold text-brand-ink">{title}</h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

const ORDER_TONES: Partial<Record<OrderStatus, string>> = {
  pending_payment: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  processing: "bg-indigo-100 text-indigo-900",
  packed: "bg-violet-100 text-violet-900",
  shipped: "bg-teal-100 text-teal-900",
  out_for_delivery: "bg-cyan-100 text-cyan-900",
  delivered: "bg-emerald-100 text-emerald-900",
  delivery_failed: "bg-orange-100 text-orange-900",
  rto_initiated: "bg-orange-100 text-orange-900",
  rto_delivered: "bg-stone-200 text-stone-900",
  on_hold: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-900",
  returned: "bg-stone-200 text-stone-900",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={cn("rounded-full font-medium", ORDER_TONES[status])}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status, method }: { status: PaymentStatus; method?: string }) {
  const tone =
    status === "paid"
      ? "bg-emerald-100 text-emerald-900"
      : status === "failed"
        ? "bg-rose-100 text-rose-900"
        : status === "refunded" || status === "partially_refunded"
          ? "bg-stone-200 text-stone-900"
          : "bg-amber-100 text-amber-900";
  const label = method === "cod" && status === "pending" ? "COD — to collect" : PAYMENT_STATUS_LABELS[status];
  return <Badge className={cn("rounded-full font-medium", tone)}>{label}</Badge>;
}

const RETURN_TONES: Record<keyof typeof RETURN_STATUS_LABELS, string> = {
  requested: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-900",
  received: "bg-indigo-100 text-indigo-900",
  refunded: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  closed: "bg-stone-200 text-stone-900",
};

export function ReturnStatusBadge({ status }: { status: keyof typeof RETURN_STATUS_LABELS }) {
  return <Badge className={cn("rounded-full font-medium", RETURN_TONES[status])}>{RETURN_STATUS_LABELS[status]}</Badge>;
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "warn" | "good" }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-heading text-2xl font-bold tabular-nums", tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-brand-ink")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
      <p className="font-semibold text-brand-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

/** Server-rendered pagination links that keep the current query string. */
export function AdminPagination({ basePath, params, page, pageCount, total }: { basePath: string; params: Record<string, string>; page: number; pageCount: number; total: number }) {
  if (pageCount <= 1) return <p className="mt-4 text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const qs = new URLSearchParams({ ...params, page: String(p) });
    return `${basePath}?${qs.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        {total} results · page {page} of {pageCount}
      </p>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 hover:bg-muted">
            <ChevronLeft className="size-4" /> Prev
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={href(page + 1)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 hover:bg-muted">
            Next <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export const filterSelectClass = "h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-foreground";

/** GET filter form: labelled fields on an aligned grid, then Apply / Reset. */
export function FilterBar({ resetHref, children }: { resetHref: string; children: ReactNode }) {
  return (
    <form method="get" className="mb-4 grid items-end gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {children}
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" className="h-9">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href={resetHref}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="break-words text-brand-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
