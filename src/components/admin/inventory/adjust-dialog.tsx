"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adjustStockAction } from "@/app/admin/inventory/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const REASONS = ["New stock received", "Stock count correction", "Damaged / leaking", "Expired", "Returned to supplier", "Other"];

export function AdjustStockDialog({ productId, variantId, label, stock }: { productId: string; variantId: string; label: string; stock: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const qty = Number(quantity);
  const preview = mode === "add" ? stock + qty : mode === "remove" ? stock - qty : qty;

  const submit = () =>
    startTransition(async () => {
      const result = await adjustStockAction({ productId, variantId, mode, quantity: qty, reason: note ? `${reason}: ${note}` : reason });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setQuantity("");
        setNote("");
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {label} — currently {stock} available. Every adjustment is recorded with your name and the reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="flex gap-5">
            {(["add", "remove", "set"] as const).map((m) => (
              <Label key={m} className="flex items-center gap-2 font-normal capitalize">
                <RadioGroupItem value={m} /> {m === "set" ? "Set exact count" : m}
              </Label>
            ))}
          </RadioGroup>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-qty">Quantity</Label>
            <Input id="adjust-qty" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            {quantity !== "" && Number.isInteger(qty) ? (
              <p className={preview < 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                New available stock: {preview < 0 ? "cannot go below 0" : preview}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason</Label>
            <select id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <Input aria-label="Additional note" placeholder="Note (optional), e.g. invoice number" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || quantity === "" || !Number.isInteger(qty) || qty < 0 || preview < 0 || (mode !== "set" && qty === 0)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
