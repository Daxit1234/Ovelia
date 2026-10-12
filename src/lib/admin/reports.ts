import "server-only";
import { connectDB, Order, Product, type VariantDoc } from "@/lib/db";
import { REVENUE_STATUSES } from "@/lib/domain/order-status";

const TZ = "Asia/Kolkata";
/** Orders that count as sales: confirmed onwards, excluding cancelled/returned/unpaid. */
const SALE_STATUSES = [...REVENUE_STATUSES, "delivered"] as const;

export const RANGES = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "12m": "Last 12 months" } as const;
export type RangeKey = keyof typeof RANGES;

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { y: get("year"), m: get("month"), d: get("day") };
}

function startOfIstDay(date: Date): Date {
  const { y, m, d } = istParts(date);
  return new Date(`${y}-${m}-${d}T00:00:00+05:30`);
}

function startOfIstMonth(date: Date): Date {
  const { y, m } = istParts(date);
  return new Date(`${y}-${m}-01T00:00:00+05:30`);
}

async function salesBetween(from: Date | null, to: Date | null = null) {
  const match: Record<string, unknown> = { status: { $in: SALE_STATUSES } };
  if (from || to) match.placedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) };
  const [row] = await Order.aggregate<{ revenue: number; refunded: number; orders: number }>([
    { $match: match },
    { $group: { _id: null, revenue: { $sum: "$pricing.grandTotal" }, refunded: { $sum: "$pricing.amountRefunded" }, orders: { $sum: 1 } } },
  ]);
  return { revenue: (row?.revenue ?? 0) - (row?.refunded ?? 0), orders: row?.orders ?? 0 };
}

export async function dashboardSummary(now = new Date()) {
  await connectDB();
  const today = startOfIstDay(now);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const month = startOfIstMonth(now);
  const [total, todaySales, yesterdaySales, monthSales, statusCounts, attention] = await Promise.all([
    salesBetween(null),
    salesBetween(today),
    salesBetween(yesterday, today),
    salesBetween(month),
    Order.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.countDocuments({ needsAttention: true }),
  ]);
  const count = (statuses: string[]) => statusCounts.filter((s) => statuses.includes(s._id)).reduce((sum, s) => sum + s.count, 0);
  return {
    totalSales: total.revenue,
    totalOrders: count(["confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered", "delivery_failed", "on_hold", "rto_initiated", "rto_delivered", "returned", "cancelled"]),
    salesOrders: total.orders,
    todaySales: todaySales.revenue,
    todayOrders: todaySales.orders,
    yesterdaySales: yesterdaySales.revenue,
    monthSales: monthSales.revenue,
    monthOrders: monthSales.orders,
    toFulfil: count(["confirmed", "processing", "packed", "on_hold"]),
    inTransit: count(["shipped", "out_for_delivery", "delivery_failed"]),
    delivered: count(["delivered"]),
    cancelled: count(["cancelled"]),
    awaitingPayment: count(["pending_payment"]),
    averageOrderValue: total.orders ? Math.round(total.revenue / total.orders) : 0,
    attention,
  };
}

export interface SeriesPoint {
  key: string;
  label: string;
  revenue: number;
  orders: number;
}

function lastTwelveMonthKeys(now: Date): string[] {
  const { y, m } = istParts(now);
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    let month = Number(m) - i;
    let year = Number(y);
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return keys;
}

/** Sales per day (or per month for 12m), in IST, with empty buckets filled with zero. */
export async function salesSeries(range: RangeKey, now = new Date()): Promise<SeriesPoint[]> {
  await connectDB();
  const monthly = range === "12m";
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const monthKeys = monthly ? lastTwelveMonthKeys(now) : [];
  const start = monthly ? new Date(`${monthKeys[0]}-01T00:00:00+05:30`) : new Date(startOfIstDay(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const rows = await Order.aggregate<{ _id: string; revenue: number; refunded: number; orders: number }>([
    { $match: { status: { $in: SALE_STATUSES }, placedAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: monthly ? "%Y-%m" : "%Y-%m-%d", date: "$placedAt", timezone: TZ } },
        revenue: { $sum: "$pricing.grandTotal" },
        refunded: { $sum: "$pricing.amountRefunded" },
        orders: { $sum: 1 },
      },
    },
  ]);
  const byKey = new Map(rows.map((r) => [r._id, r]));
  const labelFmt = new Intl.DateTimeFormat("en-IN", monthly ? { month: "short", year: "2-digit", timeZone: TZ } : { day: "numeric", month: "short", timeZone: TZ });
  const keys = monthly
    ? monthKeys
    : Array.from({ length: days }, (_, i) => {
        const { y, m, d } = istParts(new Date(start.getTime() + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000));
        return `${y}-${m}-${d}`;
      });
  return keys.map((key) => {
    const row = byKey.get(key);
    const labelDate = new Date(monthly ? `${key}-15T12:00:00+05:30` : `${key}T12:00:00+05:30`);
    return { key, label: labelFmt.format(labelDate), revenue: row ? row.revenue - row.refunded : 0, orders: row?.orders ?? 0 };
  });
}

export async function bestSellers(range: RangeKey, limit = 6, now = new Date()) {
  await connectDB();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const since = new Date(startOfIstDay(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return Order.aggregate<{ _id: string; name: string; units: number; revenue: number }>([
    { $match: { status: { $in: SALE_STATUSES }, placedAt: { $gte: since } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", name: { $first: "$items.productName" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.lineTotal" } } },
    { $sort: { units: -1, revenue: -1 } },
    { $limit: limit },
  ]);
}

export async function lowStockVariants(limit = 8) {
  await connectDB();
  const products = await Product.find({ status: "published" }, { name: 1, variants: 1 }).lean();
  return products
    .flatMap((p) =>
      (p.variants as VariantDoc[])
        .filter((v) => v.isActive && v.stock <= v.lowStockThreshold)
        .map((v) => ({ productId: p._id.toHexString(), name: p.name, label: v.label, sku: v.sku, stock: v.stock, threshold: v.lowStockThreshold })),
    )
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limit);
}

export async function recentOrders(limit = 8) {
  await connectDB();
  return Order.find({}, { orderNumber: 1, customer: 1, placedAt: 1, status: 1, paymentStatus: 1, paymentMethod: 1, pricing: 1 }).sort({ placedAt: -1 }).limit(limit).lean();
}
