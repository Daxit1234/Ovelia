import type { Metadata } from "next";
import Link from "next/link";
import type { QueryFilter } from "mongoose";
import { BadgeCheck } from "lucide-react";
import { moderateReviewAction } from "@/app/admin/reviews/actions";
import { ActionButton } from "@/components/admin/action-button";
import { ReplyDialog } from "@/components/admin/reviews/reply-dialog";
import { AdminPageHeader, AdminPagination, EmptyState, FilterBar, FilterField, filterSelectClass } from "@/components/admin/ui";
import { RatingStars } from "@/components/shared/rating-stars";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { requireStaffPage } from "@/lib/auth/session";
import { compact, oneOf, pageParam, param } from "@/lib/admin/list";
import { connectDB, Product, Review, type ReviewDoc } from "@/lib/db";
import { hasPermission } from "@/lib/domain/roles";
import { escapeRegex, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Reviews" };

const PAGE_SIZE = 20;
const STATUS_FILTERS = { pending: "Awaiting moderation", approved: "Published", rejected: "Rejected", featured: "Featured", all: "All reviews" } as const;

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const user = await requireStaffPage("reviews:moderate", "/admin/reviews");
  const sp = await searchParams;
  const status = oneOf(param(sp, "status"), Object.keys(STATUS_FILTERS) as (keyof typeof STATUS_FILTERS)[], "pending");
  const rating = oneOf(param(sp, "rating"), ["", "1", "2", "3", "4", "5"] as const, "");
  const q = param(sp, "q").slice(0, 60);
  const page = pageParam(sp);

  const query: QueryFilter<ReviewDoc> = {};
  if (status === "featured") query.isFeatured = true;
  else if (status !== "all") query.status = status;
  if (rating) query.rating = Number(rating);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ title: rx }, { body: rx }, { authorName: rx }];
  }
  await connectDB();
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: status === "pending" ? 1 : -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Review.countDocuments(query),
  ]);
  const products = await Product.find({ _id: { $in: reviews.map((r) => r.productId) } }, { name: 1, slug: 1 }).lean();
  const productById = new Map(products.map((p) => [p._id.toHexString(), p]));
  const canEditProducts = hasPermission(user.role, "products:write");
  const params = compact({ status: status === "pending" ? "" : status, rating, q });

  return (
    <>
      <AdminPageHeader title="Reviews" description="Approve reviews before they appear on product pages, reply as the store and feature the most helpful ones." />
      <FilterBar resetHref="/admin/reviews">
        <FilterField label="Search" className="sm:col-span-2">
          <Input name="q" defaultValue={q} placeholder="Title, text or author" className="h-9" />
        </FilterField>
        <FilterField label="Show">
          <select name="status" defaultValue={status} className={filterSelectClass}>
            {Object.entries(STATUS_FILTERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Rating">
          <select name="rating" defaultValue={rating} className={filterSelectClass}>
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} star{r === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {reviews.length === 0 ? (
        <EmptyState title={status === "pending" ? "No reviews waiting for moderation" : "No reviews found"} description="Customers can review products they have received. Review rules are set in Settings → Reviews." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => {
            const id = r._id.toHexString();
            const product = productById.get(r.productId.toHexString());
            return (
              <li key={id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {product ? (
                        canEditProducts ? (
                          <Link href={`/admin/products/${product._id.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                            {product.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{product.name}</span>
                        )
                      ) : (
                        "Deleted product"
                      )}{" "}
                      · {formatDateTime(r.createdAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <RatingStars value={r.rating} />
                      <span className="font-semibold text-brand-ink">{r.title || "(no title)"}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      {r.authorName}
                      {r.verifiedPurchase ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-700">
                          <BadgeCheck className="size-3.5" aria-hidden /> Verified purchase
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={r.status === "approved" ? "bg-emerald-100 text-emerald-900" : r.status === "rejected" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"}>
                      {r.status === "approved" ? "Published" : r.status === "rejected" ? "Rejected" : "Pending"}
                    </Badge>
                    {r.isFeatured ? <Badge className="bg-sky-100 text-sky-900">Featured</Badge> : null}
                  </div>
                </div>
                {r.body ? <p className="mt-3 text-sm whitespace-pre-line text-brand-ink">{r.body}</p> : null}
                {r.adminReply ? (
                  <div className="mt-3 rounded-xl bg-brand-mint p-3 text-sm">
                    <p className="text-xs font-semibold text-brand-green">Store reply</p>
                    <p className="whitespace-pre-line">{r.adminReply}</p>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1 border-t pt-3">
                  {r.status !== "approved" ? (
                    <ActionButton size="sm" variant="default" action={moderateReviewAction.bind(null, id, "approve")}>
                      Approve
                    </ActionButton>
                  ) : null}
                  {r.status !== "rejected" ? (
                    <ActionButton size="sm" variant="outline" action={moderateReviewAction.bind(null, id, "reject")}>
                      Reject
                    </ActionButton>
                  ) : null}
                  {r.isFeatured ? (
                    <ActionButton size="sm" variant="ghost" action={moderateReviewAction.bind(null, id, "unfeature")}>
                      Unfeature
                    </ActionButton>
                  ) : (
                    <ActionButton size="sm" variant="ghost" action={moderateReviewAction.bind(null, id, "feature")}>
                      Feature
                    </ActionButton>
                  )}
                  <ReplyDialog reviewId={id} initial={r.adminReply} author={r.authorName} />
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive"
                    action={moderateReviewAction.bind(null, id, "delete")}
                    confirm={{ title: "Delete this review permanently?", description: "Rejecting keeps a record; deleting removes it and lets the customer review the product again." }}
                    confirmLabel="Delete"
                  >
                    Delete
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AdminPagination basePath="/admin/reviews" params={params} page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} />
    </>
  );
}
