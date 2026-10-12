"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { trackOrderAction } from "@/app/actions/orders";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrackOrderForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await trackOrderAction({ orderNumber, contact });
      if (result.ok) router.push(result.data.href);
      else setError(result.error);
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-white p-6 sm:p-8">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="track-order-number">Order number</Label>
        <Input id="track-order-number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="OV-261012-ABCDE" className="h-11 uppercase" required maxLength={32} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="track-contact">Email or mobile number</Label>
        <Input id="track-contact" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" className="h-11" required maxLength={254} />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />} Track order
      </Button>
    </form>
  );
}
