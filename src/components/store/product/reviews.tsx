import { BadgeCheck } from "lucide-react";
import { RatingStars } from "@/components/shared/rating-stars";
import { ReviewForm } from "@/components/store/product/review-form";
import { getProductReviews } from "@/lib/data/content";
import { formatDate } from "@/lib/format";

export async function ProductReviews({
  productId,
  productName,
  slug,
  ratingAverage,
  ratingCount,
  reviewsEnabled,
}: {
  productId: string;
  productName: string;
  slug: string;
  ratingAverage: number;
  ratingCount: number;
  reviewsEnabled: boolean;
}) {
  const { reviews, distribution } = await getProductReviews(productId);
  const total = reviews.length;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-28">
      <h2 id="reviews-title" className="section-title">
        Customer reviews
      </h2>
      <div className="mt-6 grid gap-10 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          {ratingCount > 0 ? (
            <>
              <div className="flex items-end gap-3">
                <span className="font-heading text-5xl font-extrabold text-brand-ink">{ratingAverage.toFixed(1)}</span>
                <div className="pb-1.5">
                  <RatingStars value={ratingAverage} size="md" />
                  <p className="text-sm text-muted-foreground">
                    {ratingCount} review{ratingCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5" aria-label="Rating distribution">
                {distribution.map((count, i) => {
                  const stars = 5 - i;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <li key={stars} className="flex items-center gap-2 text-sm">
                      <span className="w-12 text-muted-foreground">{stars} star</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-8 text-right text-muted-foreground">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground">No reviews yet. Bought this product? Be the first to share your experience.</p>
          )}
          {reviewsEnabled ? <ReviewForm productId={productId} productName={productName} slug={slug} /> : null}
        </div>
        <ul className="divide-y">
          {reviews.map((review) => (
            <li key={review.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <RatingStars value={review.rating} />
                {review.title ? <p className="font-semibold text-brand-ink">{review.title}</p> : null}
              </div>
              <p className="mt-2 text-[15px] leading-7 text-brand-ink/85">{review.body}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="font-medium text-brand-ink">{review.authorName}</span>
                {review.verifiedPurchase ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="size-3.5" aria-hidden /> Verified purchase
                  </span>
                ) : null}
                <span>· {formatDate(review.createdAt)}</span>
              </p>
              {review.adminReply ? (
                <div className="mt-3 rounded-xl bg-brand-mint/70 p-3 text-sm">
                  <p className="font-semibold text-brand-green">Response from Ovelia</p>
                  <p className="mt-1 text-brand-ink/85">{review.adminReply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
