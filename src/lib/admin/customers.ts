import "server-only";
import type { QueryFilter } from "mongoose";
import { Address, AuthSession, connectDB, NewsletterSubscriber, Order, Review, User, Wishlist, type UserDoc } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { REVENUE_STATUSES } from "@/lib/domain/order-status";
import { escapeRegex } from "@/lib/format";
import { AppError, NotFoundError } from "@/lib/result";
import { oneOf, pageParam, param, type SearchParams } from "@/lib/admin/list";

/** Statuses whose value counts as money spent (confirmed onwards, not cancelled/returned). */
const SPENT_STATUSES = [...REVENUE_STATUSES, "delivered"];

export const CUSTOMER_SORTS = { newest: "Newest first", oldest: "Oldest first", name: "Name A–Z", last_login: "Recently signed in" } as const;
export type CustomerSort = keyof typeof CUSTOMER_SORTS;
export const CUSTOMERS_PAGE_SIZE = 25;

export interface CustomerFilters {
  q: string;
  status: "" | "active" | "suspended";
  sort: CustomerSort;
  page: number;
}

export function parseCustomerFilters(params: SearchParams): CustomerFilters {
  return {
    q: param(params, "q").slice(0, 80),
    status: oneOf(param(params, "status"), ["", "active", "suspended"] as const, ""),
    sort: oneOf(param(params, "sort"), Object.keys(CUSTOMER_SORTS) as CustomerSort[], "newest"),
    page: pageParam(params),
  };
}

export function customerQuery(filters: Pick<CustomerFilters, "q" | "status">): QueryFilter<UserDoc> {
  const query: QueryFilter<UserDoc> = { role: "customer" };
  if (filters.status) query.status = filters.status;
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    const digits = filters.q.replace(/\D/g, "");
    query.$or = [{ name: rx }, { email: rx }, ...(digits.length >= 4 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])];
  }
  return query;
}

const SORT_SPEC: Record<CustomerSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  last_login: { lastLoginAt: -1 },
};

/** Order count and net spend per customer. */
export async function orderStatsFor(userIds: UserDoc["_id"][]) {
  if (userIds.length === 0) return new Map<string, { orders: number; spent: number; lastOrderAt: Date | null }>();
  const rows = await Order.aggregate<{ _id: UserDoc["_id"]; orders: number; spent: number; lastOrderAt: Date }>([
    { $match: { userId: { $in: userIds }, status: { $ne: "pending_payment" } } },
    {
      $group: {
        _id: "$userId",
        orders: { $sum: 1 },
        spent: { $sum: { $cond: [{ $in: ["$status", SPENT_STATUSES] }, { $subtract: ["$pricing.grandTotal", "$pricing.amountRefunded"] }, 0] } },
        lastOrderAt: { $max: "$placedAt" },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id.toHexString(), { orders: r.orders, spent: r.spent, lastOrderAt: r.lastOrderAt }]));
}

export async function listCustomers(filters: CustomerFilters) {
  await connectDB();
  const query = customerQuery(filters);
  const [users, total] = await Promise.all([
    User.find(query, { name: 1, email: 1, phone: 1, status: 1, emailVerified: 1, createdAt: 1, lastLoginAt: 1, marketingOptIn: 1 })
      .sort({ ...SORT_SPEC[filters.sort], _id: -1 })
      .skip((filters.page - 1) * CUSTOMERS_PAGE_SIZE)
      .limit(CUSTOMERS_PAGE_SIZE)
      .lean(),
    User.countDocuments(query),
  ]);
  const stats = await orderStatsFor(users.map((u) => u._id));
  return {
    rows: users.map((u) => ({ ...u, stats: stats.get(u._id.toHexString()) ?? { orders: 0, spent: 0, lastOrderAt: null } })),
    total,
    pageCount: Math.ceil(total / CUSTOMERS_PAGE_SIZE),
  };
}

export async function getCustomer(id: string) {
  if (!isObjectId(id)) return null;
  await connectDB();
  const user = await User.findOne({ _id: toObjectId(id), role: "customer" }).lean();
  if (!user) return null;
  const [addresses, orders, stats, wishlist, reviews, subscriber, guestOrders] = await Promise.all([
    Address.find({ userId: user._id }).sort({ isDefault: -1, updatedAt: -1 }).lean(),
    Order.find({ userId: user._id }, { orderNumber: 1, placedAt: 1, status: 1, paymentStatus: 1, paymentMethod: 1, pricing: 1, items: 1 }).sort({ placedAt: -1 }).limit(20).lean(),
    orderStatsFor([user._id]),
    Wishlist.findOne({ userId: user._id }, { items: 1 }).lean(),
    Review.countDocuments({ userId: user._id }),
    NewsletterSubscriber.findOne({ email: user.email }, { status: 1, createdAt: 1 }).lean(),
    // Orders placed as a guest with the same email, before or without signing in.
    Order.countDocuments({ userId: null, "customer.email": user.email }),
  ]);
  return {
    user,
    addresses,
    orders,
    stats: stats.get(user._id.toHexString()) ?? { orders: 0, spent: 0, lastOrderAt: null },
    wishlistCount: wishlist?.items.length ?? 0,
    reviews,
    newsletter: subscriber?.status ?? null,
    guestOrders,
  };
}

/** Suspends or reactivates a customer. Suspension also ends their signed-in sessions. */
export async function setCustomerStatus(id: string, status: "active" | "suspended"): Promise<UserDoc> {
  if (!isObjectId(id)) throw new NotFoundError("Customer not found");
  await connectDB();
  const user = await User.findOneAndUpdate({ _id: toObjectId(id), role: "customer" }, { $set: { status, updatedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!user) throw new NotFoundError("Customer not found");
  if (status === "suspended") await revokeSessions(id);
  return user;
}

/** Deletes a user's sessions so they are signed out everywhere on their next request. */
export async function revokeSessions(userId: string): Promise<number> {
  if (!isObjectId(userId)) throw new AppError("Invalid user");
  await connectDB();
  // Use the raw collection so both ObjectId and string user ids match.
  const result = await AuthSession.collection.deleteMany({ $or: [{ userId: toObjectId(userId) }, { userId }] });
  return result.deletedCount;
}
