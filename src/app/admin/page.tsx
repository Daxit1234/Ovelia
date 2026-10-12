import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ClipboardCheck } from "lucide-react";
import { OrdersChart, RevenueChart } from "@/components/admin/dashboard/sales-charts";
import { AdminPageHeader, OrderStatusBadge, Panel, PaymentStatusBadge, StatCard } from "@/components/admin/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { oneOf, param } from "@/lib/admin/list";
import { bestSellers, dashboardSummary, lowStockVariants, RANGES, recentOrders, salesSeries, type RangeKey } from "@/lib/admin/reports";
import { hasPermission } from "@/lib/domain/roles";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { launchChecklist, loadSettings } from "@/lib/services/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function Delta({ current, previous, label, emptyLabel }: { current: number; previous: number; label: string; emptyLabel: string }) {
  // A percentage change from zero is meaningless, so say what the baseline was.
  if (previous === 0) return <span>{emptyLabel}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-emerald-700" : "text-rose-700")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {pct}% <span className="font-normal text-muted-foreground">&nbsp;{label}</span>
    </span>
  );
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireStaffPage("dashboard:view", "/admin");
  const range = oneOf(param(await searchParams, "range"), Object.keys(RANGES) as RangeKey[], "30d");
  const [summary, series, sellers, lowStock, recent, settings] = await Promise.all([
    dashboardSummary(),
    salesSeries(range),
    bestSellers(range),
    lowStockVariants(),
    recentOrders(),
    loadSettings(),
  ]);
  const checklist = hasPermission(user.role, "settings:write") ? launchChecklist(settings) : [];
  const chartData = series.map((p) => ({ label: p.label, revenue: p.revenue / 100, orders: p.orders }));
  const rangeRevenue = series.reduce((s, p) => s + p.revenue, 0);
  const rangeOrders = series.reduce((s, p) => s + p.orders, 0);
  const canOrders = hasPermission(user.role, "orders:read");

  return (
    <>
      <AdminPageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Store performance at a glance. Sales are net of refunds and exclude unpaid or cancelled orders." />

      {checklist.length ? (
        <Alert className="mb-5 border-amber-300 bg-amber-50">
          <ClipboardCheck className="size-4 text-amber-700" />
          <AlertTitle>Finish setting up your store before launch</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/admin/settings" className="mt-2 inline-block font-semibold text-brand-green underline">
              Open settings
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {summary.attention > 0 && canOrders ? (
        <Alert className="mb-5 border-rose-200 bg-rose-50">
          <AlertTriangle className="size-4 text-rose-700" />
          <AlertTitle>
            {summary.attention} order{summary.attention === 1 ? "" : "s"} need{summary.attention === 1 ? "s" : ""} attention
          </AlertTitle>
          <AlertDescription>
            <Link href="/admin/orders?attention=1" className="font-semibold text-brand-green underline">
              Review orders
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={formatINR(summary.totalSales)} hint={`${formatNumber(summary.salesOrders)} orders, all time`} />
        <StatCard label="Today's sales" value={formatINR(summary.todaySales)} hint={<Delta current={summary.todaySales} previous={summary.yesterdaySales} label="vs yesterday" emptyLabel="No sales yesterday" />} />
        <StatCard label="This month" value={formatINR(summary.monthSales)} hint={`${formatNumber(summary.monthOrders)} orders`} />
        <StatCard label="Average order value" value={formatINR(summary.averageOrderValue)} />
        <StatCard label="Orders" value={formatNumber(summary.totalOrders)} hint={`${summary.awaitingPayment} awaiting payment`} />
        <StatCard label="To fulfil" value={formatNumber(summary.toFulfil)} hint={`${summary.inTransit} in transit`} tone={summary.toFulfil > 0 ? "warn" : "default"} />
        <StatCard label="Delivered" value={formatNumber(summary.delivered)} tone="good" />
        <StatCard label="Cancelled" value={formatNumber(summary.cancelled)} />
      </section>

      <nav aria-label="Date range" className="mt-8 mb-4 flex flex-wrap items-center gap-1 rounded-xl border bg-white p-1 sm:w-fit">
        {(Object.entries(RANGES) as [RangeKey, string][]).map(([key, label]) => (
          <Link
            key={key}
            href={key === "30d" ? "/admin" : `/admin?range=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", key === range ? "bg-brand-green text-white" : "text-muted-foreground hover:bg-muted")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mb-5 rounded-2xl border bg-white p-5">
        <p className="text-sm text-muted-foreground">Net sales · {RANGES[range].toLowerCase()}</p>
        <p className="mt-1 font-heading text-5xl font-bold tracking-tight text-brand-ink">{formatINR(rangeRevenue)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(rangeOrders)} orders · average {formatINR(rangeOrders ? Math.round(rangeRevenue / rangeOrders) : 0)}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Net sales by ${range === "12m" ? "month" : "day"}`}>
          <RevenueChart data={chartData} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">View as table</summary>
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>{range === "12m" ? "Month" : "Date"}</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(p.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.orders}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </Panel>
        <Panel title={`Orders by ${range === "12m" ? "month" : "day"}`}>
          <OrdersChart data={chartData} />
          <p className="mt-3 text-xs text-muted-foreground">Table view: see “Net sales by {range === "12m" ? "month" : "day"}”.</p>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Best sellers" description={RANGES[range]}>
          {sellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this period yet.</p>
          ) : (
            <ol className="space-y-3">
              {sellers.map((s, i) => (
                <li key={String(s._id)} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-mint text-xs font-semibold text-brand-green">{i + 1}</span>
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-semibold">{s.units}</span>{" "}
                    <span className="text-muted-foreground">
                      unit{s.units === 1 ? "" : "s"} · {formatINR(s.revenue)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Low stock" actions={hasPermission(user.role, "inventory:read") ? <Link href="/admin/inventory?level=low" className="text-sm font-semibold text-brand-green">Inventory →</Link> : null}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All variants are above their alert levels.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {lowStock.map((v) => (
                <li key={v.sku} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {v.name} · {v.label}
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", v.stock === 0 ? "text-rose-700" : "text-amber-700")}>{v.stock === 0 ? "Out" : `${v.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent orders" actions={canOrders ? <Link href="/admin/orders" className="text-sm font-semibold text-brand-green">All orders →</Link> : null}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recent.map((o) => (
                <li key={o._id.toHexString()} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    {canOrders ? (
                      <Link href={`/admin/orders/${o._id.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                        {o.orderNumber}
                      </Link>
                    ) : (
                      <span className="font-semibold">{o.orderNumber}</span>
                    )}
                    <span className="font-semibold tabular-nums">{formatINR(o.pricing.grandTotal)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.customer.name} · {formatDateTime(o.placedAt)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} method={o.paymentMethod} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
