"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { PenLine, Star } from "lucide-react";
import { toast } from "sonner";
import { reviewEligibilityAction, submitReviewAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ReviewForm({ productId, productName, slug }: { productId: string; productName: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [checking, startCheck] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [notice, setNotice] = useState<{ text: string; signIn: boolean } | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const start = () =>
    startCheck(async () => {
      const eligibility = await reviewEligibilityAction(productId);
      if (eligibility.allowed) {
        setNotice(null);
        setOpen(true);
      } else {
        setNotice({ text: eligibility.reason ?? "You cannot review this product yet.", signIn: !eligibility.signedIn });
      }
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startSubmit(async () => {
      const result = await submitReviewAction({ productId, rating, title, body });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setRating(0);
        setTitle("");
        setBody("");
      } else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" className="rounded-full" onClick={start} disabled={checking}>
        <PenLine className="size-4" aria-hidden /> {checking ? "Checking…" : "Write a review"}
      </Button>
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice.text}{" "}
          {notice.signIn ? (
            <Link href={`/login?next=${encodeURIComponent(`/products/${slug}#reviews`)}`} className="font-semibold text-brand-green underline">
              Sign in
            </Link>
          ) : null}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review {productName}</DialogTitle>
            <DialogDescription>Share an honest review to help other customers. Reviews are checked before publishing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Your rating</legend>
              <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    aria-pressed={rating === value}
                    onMouseEnter={() => setHover(value)}
                    onClick={() => setRating(value)}
                    className="rounded p-0.5"
                  >
                    <Star className={cn("size-8", (hover || rating) >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="review-title">Title (optional)</Label>
              <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-body">Your review</Label>
              <Textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} minLength={10} maxLength={2000} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || rating === 0 || body.trim().length < 10}>
                {submitting ? "Submitting…" : "Submit review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
