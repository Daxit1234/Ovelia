"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { replyToReviewAction } from "@/app/admin/reviews/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReplyDialog({ reviewId, initial, author }: { reviewId: string; initial: string; author: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(initial);
  const [pending, startTransition] = useTransition();
  const save = (value: string) =>
    startTransition(async () => {
      const result = await replyToReviewAction(reviewId, value);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {initial ? "Edit reply" : "Reply"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reply to {author}</DialogTitle>
          <DialogDescription>Your reply is shown publicly under the review as a response from the store.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`reply-${reviewId}`}>Reply</Label>
          <Textarea id={`reply-${reviewId}`} rows={5} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
        </div>
        <DialogFooter>
          {initial ? (
            <Button variant="outline" className="mr-auto" onClick={() => save("")} disabled={pending}>
              Remove reply
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => save(reply)} disabled={pending || !reply.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Publish reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
