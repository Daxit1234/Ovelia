"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateReturnAction } from "@/app/admin/returns/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Action = "approve" | "reject" | "receive" | "refund" | "close";

const COPY: Record<Action, { label: string; title: string; description: string; notePlaceholder: string }> = {
  approve: {
    label: "Approve return",
    title: "Approve this return?",
    description: "The customer is emailed that the return is approved. Arrange the pickup or tell them how to send the items back.",
    notePlaceholder: "Pickup or return instructions for the customer (optional)",
  },
  reject: {
    label: "Reject",
    title: "Reject this return?",
    description: "The customer is emailed your reason.",
    notePlaceholder: "Reason shown to the customer",
  },
  receive: {
    label: "Mark items received",
    title: "Mark the returned items as received?",
    description: "Records the returned quantities on the order. Restock only items that are unopened and sellable.",
    notePlaceholder: "Condition of the items (optional)",
  },
  refund: {
    label: "Refund",
    title: "Refund this return",
    description: "Online payments are refunded to the original payment method through Razorpay. For Cash on Delivery orders, pay the customer yourself (bank transfer or UPI) and record it here.",
    notePlaceholder: "Note for the customer (optional)",
  },
  close: {
    label: "Close without further action",
    title: "Close this return?",
    description: "Closes the request. No stock or refund changes are made.",
    notePlaceholder: "Internal note (optional)",
  },
};

function ActionDialog({
  returnId,
  action,
  variant = "outline",
  refund,
}: {
  returnId: string;
  action: Action;
  variant?: "default" | "outline" | "destructive";
  refund?: { defaultAmount: number; maxAmount: number; isCod: boolean };
}) {
  const router = useRouter();
  const copy = COPY[action];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [amount, setAmount] = useState(refund ? String(refund.defaultAmount) : "");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const refundAmount = action === "refund" ? Number(amount) : undefined;
      if (refundAmount !== undefined && !(refundAmount > 0 && refundAmount <= (refund?.maxAmount ?? 0))) {
        toast.error(`Enter an amount between ₹1 and ₹${refund?.maxAmount.toLocaleString("en-IN")}.`);
        return;
      }
      const result = await updateReturnAction(returnId, { action, note, restock: action === "receive" ? restock : undefined, refundAmount });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="w-full justify-center">
          {copy.label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {refund ? (
            <div className="space-y-1.5">
              <Label htmlFor={`refund-${returnId}`}>Refund amount (₹)</Label>
              <Input id={`refund-${returnId}`} type="number" inputMode="decimal" min={1} max={refund.maxAmount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Up to ₹{refund.maxAmount.toLocaleString("en-IN")} can still be refunded on this order.
                {refund.isCod ? " This is recorded as a manual refund." : ""}
              </p>
            </div>
          ) : null}
          {action === "receive" ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={restock} onCheckedChange={(v) => setRestock(v === true)} /> Add the returned units back to stock
            </label>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`note-${action}-${returnId}`}>{action === "reject" ? "Reason" : "Note"}</Label>
            <Textarea id={`note-${action}-${returnId}`} rows={3} maxLength={500} value={note} placeholder={copy.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={action === "reject" ? "destructive" : "default"} onClick={submit} disabled={pending || (action === "reject" && note.trim().length < 3)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {copy.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnActions({
  returnId,
  status,
  canRefund,
  refund,
}: {
  returnId: string;
  status: string;
  canRefund: boolean;
  refund: { defaultAmount: number; maxAmount: number; isCod: boolean; paid: boolean };
}) {
  const refundable = canRefund && refund.paid && refund.maxAmount > 0;
  const buttons: { action: Action; variant?: "default" | "outline" | "destructive" }[] = [];
  if (status === "requested") buttons.push({ action: "approve", variant: "default" }, { action: "reject", variant: "destructive" }, { action: "close" });
  if (status === "approved") {
    buttons.push({ action: "receive", variant: "default" });
    if (refundable) buttons.push({ action: "refund" });
    buttons.push({ action: "reject", variant: "destructive" }, { action: "close" });
  }
  if (status === "received") {
    if (refundable) buttons.push({ action: "refund", variant: "default" });
    buttons.push({ action: "close" });
  }
  if (status === "refunded") buttons.push({ action: "close" });

  if (buttons.length === 0) return <p className="text-sm text-muted-foreground">This return is {status}. No further actions are available.</p>;
  return (
    <div className="space-y-2">
      {buttons.map((b) => (
        <ActionDialog key={b.action} returnId={returnId} action={b.action} variant={b.variant} refund={b.action === "refund" ? refund : undefined} />
      ))}
      {(status === "approved" || status === "received") && !refundable ? (
        <p className="pt-1 text-xs text-muted-foreground">
          {!canRefund
            ? "Refunds need refund permission. Ask an order manager to refund this return."
            : !refund.paid
              ? "No payment is recorded on this order yet. Mark a COD order as delivered before refunding it."
              : "Nothing is left to refund on this order."}
        </p>
      ) : null}
    </div>
  );
}
