"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, CreditCard, Loader2, Lock, ShieldCheck, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { placeOrderAction, quoteCheckoutAction, reportPaymentFailureAction, verifyPaymentAction, type PlaceOrderResponse } from "@/app/actions/checkout";
import { AddressFields, TextField } from "@/components/store/checkout/address-fields";
import { useCart } from "@/components/store/cart-context";
import { CouponBox, TotalsList } from "@/components/store/cart/order-summary";
import { ProductImage } from "@/components/shared/product-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { PublicSettings } from "@/lib/data/content";
import { formatINR } from "@/lib/money";
import { loadRazorpay, openRazorpay } from "@/lib/razorpay-client";
import type { SavedAddress } from "@/lib/services/addresses";
import type { CartView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { checkoutFormSchema, type CheckoutFormInput, type CheckoutInput } from "@/lib/validation/checkout";
import type { z } from "zod";

interface CheckoutUser {
  name: string;
  email: string;
  phone: string | null;
}

const EMPTY_BILLING = { fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };
const emptyShipping = (name = "", phone = "") =>
  ({ ...EMPTY_BILLING, fullName: name, phone }) as unknown as CheckoutFormInput["shippingAddress"];

function Step({ number, title, children, aside }: { number: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border bg-white p-5 sm:p-7" aria-labelledby={`step-${number}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={`step-${number}`} className="flex items-center gap-3 font-heading text-lg font-bold text-brand-ink">
          <span className="grid size-7 place-items-center rounded-full bg-brand-green text-sm text-white">{number}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function OptionCard({
  checked,
  onSelect,
  disabled,
  icon: Icon,
  title,
  description,
  trailing,
  name,
  value,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  name: string;
  value: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors",
        checked ? "border-brand-green bg-brand-mint/50" : "border-border hover:border-brand-teal/50",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} disabled={disabled} className="mt-1 accent-[#0b4d3b]" />
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-teal" />
      <span className="flex-1">
        <span className="block font-semibold text-brand-ink">{title}</span>
        {description ? <span className="block text-sm text-muted-foreground">{description}</span> : null}
      </span>
      {trailing ? <span className="text-sm font-semibold">{trailing}</span> : null}
    </label>
  );
}

export function CheckoutClient({ user, addresses, settings }: { user: CheckoutUser | null; addresses: SavedAddress[]; settings: PublicSettings }) {
  const router = useRouter();
  const { cart, ready, refresh } = useCart();
  const onlineAvailable = settings.payments.razorpayEnabled && settings.payments.razorpayConfigured;
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">(defaultAddress?.id ?? "new");
  const [quote, setQuote] = useState<CartView | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [paymentStage, setPaymentStage] = useState<"idle" | "awaiting" | "verifying">("idle");
  const checkoutKey = useRef<string>(crypto.randomUUID());
  const lastAttempt = useRef<string | null>(null);
  const pendingOrder = useRef<PlaceOrderResponse | null>(null);

  const form = useForm<CheckoutFormInput, unknown, z.output<typeof checkoutFormSchema>>({
    resolver: zodResolver(checkoutFormSchema),
    mode: "onTouched",
    defaultValues: {
      contact: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" },
      shippingAddress: defaultAddress
        ? { ...defaultAddress }
        : emptyShipping(user?.name ?? "", user?.phone ?? ""),
      billingSameAsShipping: true,
      billingAddress: { ...EMPTY_BILLING },
      shippingMethod: "standard",
      paymentMethod: onlineAvailable ? "razorpay" : "cod",
      customerNote: "",
      saveAddress: Boolean(user) && addresses.length === 0,
    },
  });

  const [shippingMethod, paymentMethod, state, email, phone, billingSame, saveAddress] = useWatch({
    control: form.control,
    name: ["shippingMethod", "paymentMethod", "shippingAddress.state", "contact.email", "contact.phone", "billingSameAsShipping", "saveAddress"],
  });

  const current = quote ?? cart;

  const requote = useCallback(async () => {
    setQuoting(true);
    try {
      const result = await quoteCheckoutAction({
        shippingMethod,
        paymentMethod,
        state: (state || null) as never,
        email: email || null,
        phone: phone || null,
      });
      if (result.ok) setQuote(result.data);
    } finally {
      setQuoting(false);
    }
  }, [email, paymentMethod, phone, shippingMethod, state]);

  // Re-price whenever an option that can change the total changes.
  useEffect(() => {
    if (!ready || cart.lines.length === 0) return;
    const timer = setTimeout(() => void requote(), 350);
    return () => clearTimeout(timer);
  }, [ready, cart.couponCode, cart.itemCount, cart.lines.length, cart.totals.merchandiseTotal, requote]);

  // Keep the payment method valid as options change.
  useEffect(() => {
    if (!quote) return;
    if (paymentMethod === "cod" && !quote.codAvailable && onlineAvailable) form.setValue("paymentMethod", "razorpay");
  }, [form, onlineAvailable, paymentMethod, quote]);

  const chooseAddress = (id: string | "new") => {
    setSelectedAddressId(id);
    const address = addresses.find((a) => a.id === id);
    form.setValue("shippingAddress", address ? { ...address } : emptyShipping(user?.name ?? "", user?.phone ?? ""), {
      shouldValidate: Boolean(address),
    });
  };

  const fingerprint = useMemo(() => () => JSON.stringify({ ...form.getValues(), total: current.totals.grandTotal }), [form, current.totals.grandTotal]);

  const startPayment = async (order: PlaceOrderResponse) => {
    const rz = order.razorpay!;
    setPaymentStage("awaiting");
    try {
      await loadRazorpay();
    } catch (error) {
      toast.error((error as Error).message);
      setPaymentStage("idle");
      setPlacing(false);
      return;
    }
    openRazorpay(
      {
        key: rz.keyId,
        amount: rz.amount,
        currency: "INR",
        name: settings.store.name || "Ovelia",
        description: rz.description,
        order_id: rz.razorpayOrderId,
        prefill: rz.prefill,
        notes: { order_number: order.orderNumber },
        theme: { color: "#0b4d3b" },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setPaymentStage("idle");
            setPlacing(false);
            toast.info(`Payment not completed. Your order ${order.orderNumber} is saved — you can try again.`);
          },
        },
        handler: async (response) => {
          setPaymentStage("verifying");
          const result = await verifyPaymentAction(response);
          await refresh();
          if (result.ok) {
            router.push(result.data.redirectTo);
          } else {
            toast.error(result.error);
            router.push(order.redirectTo);
          }
        },
      },
      (failure) => {
        const meta = failure.error.metadata;
        if (meta?.order_id && meta.payment_id) void reportPaymentFailureAction({ razorpayOrderId: meta.order_id, razorpayPaymentId: meta.payment_id });
        toast.error(failure.error.description || "Payment failed. Please try again or use another method.");
      },
    );
  };

  const placeOrder = async (values: z.output<typeof checkoutFormSchema>) => {
    if (!quote || quoting) {
      toast.info("Updating your total, please try again in a moment.");
      return;
    }
    // Reuse the same order (and Razorpay order) if nothing changed since the last attempt.
    const print = fingerprint();
    if (lastAttempt.current && lastAttempt.current !== print) checkoutKey.current = crypto.randomUUID();
    if (pendingOrder.current && lastAttempt.current === print && pendingOrder.current.razorpay) {
      setPlacing(true);
      await startPayment(pendingOrder.current);
      return;
    }
    lastAttempt.current = print;
    setPlacing(true);
    const result = await placeOrderAction({
      ...values,
      billingAddress: values.billingSameAsShipping ? undefined : values.billingAddress,
      checkoutKey: checkoutKey.current,
      expectedTotal: quote.totals.grandTotal,
    } as unknown as CheckoutInput);

    if (!result.ok) {
      setPlacing(false);
      lastAttempt.current = null;
      if (result.newTotal !== undefined) {
        await requote();
        await refresh();
      }
      if (result.fieldErrors) {
        for (const [path, messages] of Object.entries(result.fieldErrors)) {
          form.setError(path as never, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    if (result.data.razorpay) {
      pendingOrder.current = result.data;
      await startPayment(result.data);
    } else {
      await refresh();
      router.push(result.data.redirectTo);
    }
  };
  // handleSubmit runs at submit time, so the refs read by placeOrder are never touched during render.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => form.handleSubmit(placeOrder)(event);

  if (!ready) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]" aria-busy="true">
        <div className="space-y-5">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  if (cart.lines.length === 0 && !placing && paymentStage === "idle") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-16 text-center">
        <h2 className="font-heading text-2xl font-bold">Your cart is empty</h2>
        <p className="text-muted-foreground">Add a few essentials to check out.</p>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  const codReason = current.codAvailable ? null : current.codUnavailableReason;
  const codDisabled = !settings.payments.codEnabled || !current.codAvailable;

  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5">
        {!user ? (
          <p className="rounded-2xl bg-brand-sky px-4 py-3 text-sm text-brand-ink">
            Have an account?{" "}
            <Link href="/login?next=/checkout" className="font-semibold text-brand-green underline">
              Sign in
            </Link>{" "}
            for faster checkout and order tracking. Or continue as a guest.
          </p>
        ) : null}

        <Step number={1} title="Contact details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="contact.name" label="Full name" autoComplete="name" className="sm:col-span-2" />
            <TextField form={form} name="contact.email" label="Email" type="email" inputMode="email" autoComplete="email" />
            <TextField form={form} name="contact.phone" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile" maxLength={14} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">We&apos;ll send order updates to this email. Couriers may call this number for delivery.</p>
        </Step>

        <Step number={2} title="Delivery address">
          {addresses.length ? (
            <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "cursor-pointer rounded-2xl border-2 p-4 text-sm transition-colors",
                    selectedAddressId === a.id ? "border-brand-green bg-brand-mint/50" : "border-border hover:border-brand-teal/50",
                  )}
                >
                  <input type="radio" name="saved-address" className="sr-only" checked={selectedAddressId === a.id} onChange={() => chooseAddress(a.id)} />
                  <span className="flex items-center justify-between font-semibold capitalize">
                    {a.fullName}
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-muted-foreground">{a.label}</span>
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                  </span>
                  <span className="block text-muted-foreground">+91 {a.phone}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => chooseAddress("new")}
                className={cn(
                  "rounded-2xl border-2 border-dashed p-4 text-sm font-semibold text-brand-green",
                  selectedAddressId === "new" ? "border-brand-green bg-brand-mint/50" : "border-border hover:border-brand-teal/50",
                )}
              >
                + Deliver to a new address
              </button>
            </div>
          ) : null}
          {selectedAddressId === "new" || addresses.length === 0 ? (
            <>
              <AddressFields form={form} prefix="shippingAddress" section="shipping" />
              {user ? (
                <label className="mt-4 flex items-center gap-2.5 text-sm">
                  <Checkbox checked={saveAddress} onCheckedChange={(c) => form.setValue("saveAddress", c === true)} />
                  Save this address to my account
                </label>
              ) : null}
            </>
          ) : null}
          <label className="mt-5 flex items-center gap-2.5 text-sm">
            <Checkbox checked={billingSame} onCheckedChange={(c) => form.setValue("billingSameAsShipping", c === true)} />
            Billing address is the same as delivery address
          </label>
          {!billingSame ? (
            <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
              <h3 className="mb-4 font-heading font-semibold">Billing address</h3>
              <AddressFields form={form} prefix="billingAddress" section="billing" />
            </div>
          ) : null}
        </Step>

        <Step number={3} title="Delivery method">
          <div className="grid gap-3">
            <OptionCard
              name="shipping-method"
              value="standard"
              checked={shippingMethod === "standard"}
              onSelect={() => form.setValue("shippingMethod", "standard")}
              icon={Truck}
              title={settings.shipping.standardLabel}
              description={settings.shipping.standardEta}
              trailing={
                current.freeShipping.qualified || settings.shipping.standardFee === 0 ? <span className="text-emerald-700">Free</span> : formatINR(settings.shipping.standardFee)
              }
            />
            {settings.shipping.expressEnabled ? (
              <OptionCard
                name="shipping-method"
                value="express"
                checked={shippingMethod === "express"}
                onSelect={() => form.setValue("shippingMethod", "express")}
                icon={Zap}
                title={settings.shipping.expressLabel}
                description={settings.shipping.expressEta}
                trailing={formatINR(settings.shipping.expressFee)}
              />
            ) : null}
          </div>
        </Step>

        <Step
          number={4}
          title="Payment"
          aside={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden /> Secure
            </span>
          }
        >
          <div className="grid gap-3">
            {onlineAvailable ? (
              <OptionCard
                name="payment-method"
                value="razorpay"
                checked={paymentMethod === "razorpay"}
                onSelect={() => form.setValue("paymentMethod", "razorpay")}
                icon={CreditCard}
                title="Pay online"
                description="UPI, debit/credit cards, net banking and wallets via Razorpay"
              />
            ) : null}
            {settings.payments.codEnabled ? (
              <OptionCard
                name="payment-method"
                value="cod"
                checked={paymentMethod === "cod"}
                onSelect={() => form.setValue("paymentMethod", "cod")}
                disabled={codDisabled}
                icon={Banknote}
                title="Cash on Delivery"
                description={codReason ?? (settings.payments.codFee > 0 ? `A COD handling fee of ${formatINR(settings.payments.codFee)} applies.` : "Pay when your order arrives.")}
              />
            ) : null}
            {!onlineAvailable && !settings.payments.codEnabled ? (
              <p className="text-sm text-destructive">Payments are temporarily unavailable. Please try again later.</p>
            ) : null}
          </div>
          <Field className="mt-5">
            <FieldLabel htmlFor="customer-note">
              Order note <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea id="customer-note" rows={2} maxLength={500} placeholder="Delivery instructions, gate code, etc." {...form.register("customerNote")} />
          </Field>
        </Step>
      </div>

      <aside className="space-y-4 rounded-3xl border bg-white p-6 lg:sticky lg:top-24" aria-label="Order summary">
        <h2 className="font-heading text-lg font-bold">Order summary</h2>
        <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {current.lines.map((line) => (
            <li key={line.variantId} className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-brand-mint">
                {line.image ? <ProductImage src={line.image.url} alt={line.image.alt} fill sizes="56px" className="object-cover" /> : null}
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand-green text-[11px] font-bold text-white">{line.quantity}</span>
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="line-clamp-1 font-medium">{line.name}</span>
                <span className="text-xs text-muted-foreground">{line.variantLabel}</span>
                {line.issue ? <span className="block text-xs text-destructive">{line.issue}</span> : null}
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatINR(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <CouponBox />
        <div className={cn("relative transition-opacity", quoting && "opacity-60")}>
          {quoting ? <Loader2 className="absolute top-0 right-0 size-4 animate-spin text-muted-foreground" aria-label="Updating total" /> : null}
          <TotalsList cart={current} shippingNote={shippingMethod === "express" ? settings.shipping.expressLabel : settings.shipping.standardLabel} />
        </div>
        {current.issues.length ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {current.issues[0]}{" "}
            <Link href="/cart" className="font-semibold underline">
              Update cart
            </Link>
          </p>
        ) : null}
        <Button type="submit" size="xl" className="w-full" disabled={placing || quoting || !quote || !current.canCheckout}>
          {paymentStage === "verifying" ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden /> Confirming payment…
            </>
          ) : placing ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden /> {paymentMethod === "razorpay" ? "Opening payment…" : "Placing order…"}
            </>
          ) : paymentMethod === "razorpay" ? (
            `Pay ${formatINR(current.totals.grandTotal)}`
          ) : (
            `Place order · ${formatINR(current.totals.grandTotal)}`
          )}
        </Button>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden />
          By placing this order you agree to our{" "}
          <Link href="/policies/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/policies/returns" className="underline">
            Return Policy
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
