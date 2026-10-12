"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CreditCard, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { reportPaymentFailureAction, retryPaymentAction, verifyPaymentAction } from "@/app/actions/checkout";
import { cancelOrderAction, requestReturnAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RETURN_REASONS } from "@/lib/domain/returns";
import { loadRazorpay, openRazorpay } from "@/lib/razorpay-client";


export function CancelOrderButton({ orderNumber, token, mode }: { orderNumber: string; token: string | null; mode: "direct" | "request" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const result = await cancelOrderAction({ orderNumber, token, reason });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <XCircle className="size-4" /> {mode === "direct" ? "Cancel order" : "Request cancellation"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "direct" ? "Cancel this order?" : "Request cancellation"}</DialogTitle>
          <DialogDescription>
            {mode === "direct"
              ? "Your order will be cancelled immediately. Online payments are refunded to the original payment method."
              : "Your order is already being prepared. Our team will review your request and update you by email."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Ordered by mistake" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending || reason.trim().length < 3}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {mode === "direct" ? "Cancel order" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RetryPaymentButton({ orderNumber, token, storeName }: { orderNumber: string; token: string | null; storeName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    const result = await retryPaymentAction({ orderNumber, token });
    if (!result.ok) {
      toast.error(result.error);
      setBusy(false);
      return;
    }
    try {
      await loadRazorpay();
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(false);
      return;
    }
    const rz = result.data;
    openRazorpay(
      {
        key: rz.keyId,
        amount: rz.amount,
        currency: "INR",
        name: storeName,
        description: rz.description,
        order_id: rz.razorpayOrderId,
        prefill: rz.prefill,
        theme: { color: "#0b4d3b" },
        modal: { confirm_close: true, ondismiss: () => setBusy(false) },
        handler: async (response) => {
          const verified = await verifyPaymentAction(response);
          if (verified.ok) toast.success("Payment received. Thank you!");
          else toast.error(verified.error);
          router.refresh();
          setBusy(false);
        },
      },
      (failure) => {
        const meta = failure.error.metadata;
        if (meta?.order_id && meta.payment_id) void reportPaymentFailureAction({ razorpayOrderId: meta.order_id, razorpayPaymentId: meta.payment_id });
        toast.error(failure.error.description || "Payment failed");
      },
    );
  };
  return (
    <Button size="lg" onClick={pay} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Complete payment
    </Button>
  );
}

/** Refreshes the page while a just-completed payment is being confirmed by webhook. */
export function PaymentConfirmationPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

export function ReturnRequestButton({
  orderNumber,
  token,
  items,
}: {
  orderNumber: string;
  token: string | null;
  items: { id: string; productName: string; variantLabel: string; maxQuantity: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<(typeof RETURN_REASONS)[number] | "">("");
  const [details, setDetails] = useState("");
  const [resolution, setResolution] = useState<"refund" | "replacement">("replacement");
  const [pending, startTransition] = useTransition();
  const chosen = Object.entries(selected).filter(([, q]) => q > 0);

  const submit = () =>
    startTransition(async () => {
      if (!reason) return;
      const result = await requestReturnAction({
        orderNumber,
        token,
        items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        reason,
        details,
        resolution,
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw className="size-4" /> Request return / replacement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>Select the affected items. Please keep the product and packaging until our team contacts you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <ul className="space-y-3">
            {items.map((item) => {
              const qty = selected[item.id] ?? 0;
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <Checkbox
                    id={`ret-${item.id}`}
                    checked={qty > 0}
                    onCheckedChange={(checked) => setSelected((s) => ({ ...s, [item.id]: checked === true ? 1 : 0 }))}
                  />
                  <Label htmlFor={`ret-${item.id}`} className="flex-1 font-normal">
                    <span className="font-medium">{item.productName}</span> <span className="text-muted-foreground">({item.variantLabel})</span>
                  </Label>
                  {qty > 0 && item.maxQuantity > 1 ? (
                    <Select value={String(qty)} onValueChange={(v) => setSelected((s) => ({ ...s, [item.id]: Number(v) }))}>
                      <SelectTrigger className="w-20" aria-label="Quantity to return">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: item.maxQuantity }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as (typeof RETURN_REASONS)[number])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preferred resolution</Label>
            <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as "refund" | "replacement")} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="replacement" /> Replacement
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="refund" /> Refund
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="return-details">Details</Label>
            <Textarea id="return-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} placeholder="Describe the issue (you can email photos to our support team)" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || chosen.length === 0 || !reason}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
