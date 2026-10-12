"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain/order-status";

type Result = { ok: boolean; error?: string; message?: string };

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        onSuccess?.();
        router.refresh();
      } else toast.error(result.error ?? "Something went wrong");
    });
  return { pending, run };
}

export function StatusUpdater({
  allowed,
  current,
  hasTracking,
  action,
}: {
  allowed: OrderStatus[];
  current: OrderStatus;
  hasTracking: boolean;
  action: (input: { to: OrderStatus; note: string; shipment?: { courierName: string; trackingNumber: string; trackingUrl: string }; restock?: boolean }) => Promise<Result>;
}) {
  const { pending, run } = useRun();
  const [to, setTo] = useState<OrderStatus | "">(allowed.find((s) => s !== "cancelled") ?? "");
  const [note, setNote] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [restock, setRestock] = useState(true);
  const options = allowed.filter((s) => s !== "cancelled");
  if (options.length === 0) return <p className="text-sm text-muted-foreground">No further status changes are available for {ORDER_STATUS_LABELS[current].toLowerCase()} orders.</p>;
  const needsShipment = to === "shipped" && !hasTracking;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="status-to">Move order to</Label>
        <select id="status-to" value={to} onChange={(e) => setTo(e.target.value as OrderStatus)} className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
          {options.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {to === "shipped" || to === "out_for_delivery" ? (
        <div className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ship-courier">Courier {needsShipment ? "*" : ""}</Label>
            <Input id="ship-courier" value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="e.g. Delhivery" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ship-awb">Tracking / AWB</Label>
            <Input id="ship-awb" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ship-url">Tracking link (optional)</Label>
            <Input id="ship-url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://" />
          </div>
        </div>
      ) : null}
      {to === "rto_delivered" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={restock} onCheckedChange={(c) => setRestock(c === true)} /> Return items to sellable stock
        </label>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="status-note">Note (optional, shown in history)</Label>
        <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
      </div>
      <Button
        className="w-full"
        disabled={pending || !to}
        onClick={() =>
          run(() =>
            action({
              to: to as OrderStatus,
              note,
              shipment: to === "shipped" || to === "out_for_delivery" ? { courierName, trackingNumber, trackingUrl } : undefined,
              restock,
            }),
          )
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Update status
      </Button>
    </div>
  );
}

export function TrackingForm({
  initial,
  action,
}: {
  initial: { courierName: string; trackingNumber: string; trackingUrl: string };
  action: (input: { courierName: string; trackingNumber: string; trackingUrl: string }) => Promise<Result>;
}) {
  const { pending, run } = useRun();
  const [values, setValues] = useState(initial);
  return (
    <div className="space-y-2">
      <Input aria-label="Courier name" placeholder="Courier name" value={values.courierName} onChange={(e) => setValues({ ...values, courierName: e.target.value })} />
      <Input aria-label="Tracking number" placeholder="Tracking / AWB number" value={values.trackingNumber} onChange={(e) => setValues({ ...values, trackingNumber: e.target.value })} />
      <Input aria-label="Tracking URL" placeholder="Tracking link (https://…)" value={values.trackingUrl} onChange={(e) => setValues({ ...values, trackingUrl: e.target.value })} />
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => action(values))}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save tracking
      </Button>
    </div>
  );
}

export function BookShipmentDialog({ defaultWeight, action }: { defaultWeight: number; action: (input: { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number }) => Promise<Result> }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState({ weightGrams: defaultWeight, lengthCm: 25, breadthCm: 20, heightCm: 15 });
  const field = (key: keyof typeof pkg, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`pkg-${key}`}>{label}</Label>
      <Input id={`pkg-${key}`} type="number" min={1} value={pkg[key]} onChange={(e) => setPkg({ ...pkg, [key]: Number(e.target.value) })} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Book courier pickup
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book shipment with courier partner</DialogTitle>
          <DialogDescription>The shipment is only marked as booked once the courier assigns an AWB.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field("weightGrams", "Weight (g)")}
          {field("lengthCm", "Length (cm)")}
          {field("breadthCm", "Breadth (cm)")}
          {field("heightCm", "Height (cm)")}
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => run(() => action(pkg), () => setOpen(false))}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Book shipment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelOrderDialog({ paid, canRefund, action }: { paid: boolean; canRefund: boolean; action: (input: { reason: string; refund: boolean }) => Promise<Result> }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(paid && canRefund);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>Stock is returned to inventory and the customer is notified by email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason-admin">Reason (sent to the customer)</Label>
            <Textarea id="cancel-reason-admin" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          {paid ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={refund} disabled={!canRefund} onCheckedChange={(c) => setRefund(c === true)} />
              Refund the full paid amount now {canRefund ? "" : "(needs refund permission — will be queued for approval)"}
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => action({ reason, refund }), () => setOpen(false))}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RefundDialog({ maxRupees, action }: { maxRupees: number; action: (input: { amount: number; reason: string; processNow: boolean }) => Promise<Result> }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(maxRupees));
  const [reason, setReason] = useState("");
  const [processNow, setProcessNow] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={maxRupees <= 0}>
          Issue refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a refund</DialogTitle>
          <DialogDescription>Up to ₹{maxRupees.toFixed(2)} can be refunded. Online payments are refunded through Razorpay.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount (₹)</Label>
            <Input id="refund-amount" type="number" min={1} max={maxRupees} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea id="refund-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={processNow} onCheckedChange={(c) => setProcessNow(c === true)} /> Process now (otherwise queue for approval)
          </label>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !Number(amount) || Number(amount) > maxRupees || reason.trim().length < 3}
            onClick={() => run(() => action({ amount: Number(amount), reason, processNow }), () => setOpen(false))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Refund ₹{Number(amount || 0).toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NoteForm({ action }: { action: (note: string) => Promise<Result> }) {
  const { pending, run } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <Textarea aria-label="Internal note" placeholder="Add an internal note (not visible to the customer)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      <Button size="sm" variant="outline" disabled={pending || note.trim().length < 2} onClick={() => run(() => action(note), () => setNote(""))}>
        Add note
      </Button>
    </div>
  );
}

export function DecisionButtons({ approve, reject, approveLabel = "Approve", rejectLabel = "Decline" }: { approve: (note: string) => Promise<Result>; reject: (note: string) => Promise<Result>; approveLabel?: string; rejectLabel?: string }) {
  const { pending, run } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <Input aria-label="Decision note" placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => approve(note))}>
          {approveLabel}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reject(note))}>
          {rejectLabel}
        </Button>
      </div>
    </div>
  );
}
