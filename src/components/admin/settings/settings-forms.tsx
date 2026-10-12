"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/admin/settings/actions";
import { Field, fieldError, LinesInput, selectClass, SwitchRow } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_ABOUT, DEFAULT_PRIVACY_POLICY, DEFAULT_RETURN_POLICY, DEFAULT_SHIPPING_POLICY, DEFAULT_TERMS } from "@/lib/content/default-policies";
import { type AnyForm } from "@/lib/forms";
import { INDIAN_STATE_NAMES } from "@/lib/india";
import { GST_RATES } from "@/lib/validation/product";
import {
  ordersSectionSchema,
  paymentsSectionSchema,
  policiesSectionSchema,
  reviewsSectionSchema,
  seoSectionSchema,
  shippingSectionSchema,
  storeSectionSchema,
  taxSectionSchema,
  type SettingsSection,
} from "@/lib/validation/settings";

/** Edits an amount stored in paise as rupees. */
function RupeeInput({ value, onChange, nullable, placeholder, id }: { value: number | null; onChange: (v: number | null) => void; nullable?: boolean; placeholder?: string; id?: string }) {
  const [text, setText] = useState(value === null ? "" : String(value / 100));
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim();
        onChange(t === "" ? (nullable ? null : 0) : Math.round(Number(t) * 100));
      }}
    />
  );
}

/** Form wrapper: submits one settings section and shows the result. */
function SectionForm<T extends FieldValues>({ section, form, children, title, description }: { section: SettingsSection; form: AnyForm<T>; children: ReactNode; title: string; description?: string }) {
  const router = useRouter();
  const onSubmit = form.handleSubmit(
    async (values) => {
      const result = await saveSettingsAction(section, values);
      if (!result.ok) {
        if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    },
    () => toast.error("Please fix the highlighted fields."),
  );
  return (
    <form onSubmit={onSubmit} noValidate>
      <Panel title={title} description={description}>
        <div className="space-y-4">{children}</div>
        <div className="mt-5 flex justify-end border-t pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save
          </Button>
        </div>
      </Panel>
    </form>
  );
}

const intValue = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? 0 : Number(v)) };

/* ---------------- Store details ---------------- */

export function StoreSettingsForm({ initial }: { initial: z.input<typeof storeSectionSchema> }) {
  const form = useForm({ resolver: zodResolver(storeSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  return (
    <SectionForm section="store" form={form} title="Store details" description="Shown in the footer, contact page, invoices and policies. Use your real, registered business details.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Store name" error={err("name")}>
          <Input {...form.register("name")} />
        </Field>
        <Field label="Registered business name" error={err("legalName")} hint="As on your GST registration. Printed on invoices.">
          <Input {...form.register("legalName")} />
        </Field>
        <Field label="Tagline" error={err("tagline")} className="sm:col-span-2">
          <Input {...form.register("tagline")} />
        </Field>
        <Field label="Support email" error={err("supportEmail")}>
          <Input type="email" {...form.register("supportEmail")} />
        </Field>
        <Field label="Support phone" error={err("supportPhone")}>
          <Input type="tel" {...form.register("supportPhone")} />
        </Field>
        <Field label="WhatsApp number" error={err("whatsappNumber")} hint="Optional. Shown as a contact option only.">
          <Input type="tel" {...form.register("whatsappNumber")} />
        </Field>
        <Field label="Support hours" error={err("businessHours")} hint="e.g. Mon–Sat, 10 am – 6 pm">
          <Input {...form.register("businessHours")} />
        </Field>
        <Field label="GSTIN" error={err("gstin")} hint="15 characters. Leave blank until registered.">
          <Input className="uppercase" {...form.register("gstin")} />
        </Field>
      </div>
      <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-brand-ink">Registered address</legend>
        <Field label="Address line 1" error={err("address.line1")}>
          <Input {...form.register("address.line1")} />
        </Field>
        <Field label="Address line 2" error={err("address.line2")}>
          <Input {...form.register("address.line2")} />
        </Field>
        <Field label="City" error={err("address.city")}>
          <Input {...form.register("address.city")} />
        </Field>
        <Field label="State" error={err("address.state")}>
          <select {...form.register("address.state")} className={selectClass}>
            <option value="">Select state</option>
            {INDIAN_STATE_NAMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PIN code" error={err("address.pincode")}>
          <Input inputMode="numeric" maxLength={6} {...form.register("address.pincode")} />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-brand-ink">Social profiles (optional)</legend>
        {([
          ["instagram", "Instagram"],
          ["facebook", "Facebook"],
          ["youtube", "YouTube"],
          ["x", "X (Twitter)"],
          ["linkedin", "LinkedIn"],
        ] as const).map(([key, label]) => (
          <Field key={key} label={label} error={err(`social.${key}`)}>
            <Input type="url" placeholder="https://" {...form.register(`social.${key}`)} />
          </Field>
        ))}
      </fieldset>
    </SectionForm>
  );
}

/* ---------------- Shipping ---------------- */

export function ShippingSettingsForm({ initial, shiprocketConfigured }: { initial: z.input<typeof shippingSectionSchema>; shiprocketConfigured: boolean }) {
  const form = useForm({ resolver: zodResolver(shippingSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  const provider = useWatch({ control: form.control, name: "provider" });
  return (
    <SectionForm section="shipping" form={form} title="Shipping" description="Fees are charged per order. The checkout always recalculates them on the server.">
      <Field label="Shipping provider" error={err("provider")}>
        <select {...form.register("provider")} className={selectClass}>
          <option value="manual">Manual (enter courier and tracking yourself)</option>
          <option value="shiprocket">Shiprocket</option>
        </select>
      </Field>
      {provider === "shiprocket" && !shiprocketConfigured ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Shiprocket is not configured on the server (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP_LOCATION). Until it is, shipments must be entered manually.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Standard: name" error={err("standardLabel")}>
          <Input {...form.register("standardLabel")} />
        </Field>
        <Field label="Standard: delivery time" error={err("standardEta")}>
          <Input {...form.register("standardEta")} />
        </Field>
        <Field label="Standard fee (₹)" error={err("standardFee")}>
          <Controller control={form.control} name="standardFee" render={({ field }) => <RupeeInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />
        </Field>
      </div>
      <Controller control={form.control} name="expressEnabled" render={({ field }) => <SwitchRow label="Offer express delivery" checked={field.value} onCheckedChange={field.onChange} />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Express: name" error={err("expressLabel")}>
          <Input {...form.register("expressLabel")} />
        </Field>
        <Field label="Express: delivery time" error={err("expressEta")}>
          <Input {...form.register("expressEta")} />
        </Field>
        <Field label="Express fee (₹)" error={err("expressFee")}>
          <Controller control={form.control} name="expressFee" render={({ field }) => <RupeeInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Free standard delivery from (₹)" error={err("freeShippingThreshold")} hint="Order value after discounts. Blank for no free delivery.">
          <Controller control={form.control} name="freeShippingThreshold" render={({ field }) => <RupeeInput nullable value={field.value} onChange={field.onChange} placeholder="No free delivery" />} />
        </Field>
        <Field label="Default parcel weight (g)" error={err("defaultPackageWeightGrams")} hint="Used when a product has no weight.">
          <Input type="number" min={1} {...form.register("defaultPackageWeightGrams", intValue)} />
        </Field>
        <Field label="Pickup PIN code" error={err("originPincode")} hint="Your warehouse PIN, for courier serviceability checks.">
          <Input inputMode="numeric" maxLength={6} {...form.register("originPincode")} />
        </Field>
        <Field label="Dispatch time (shown to customers)" error={err("processingTime")}>
          <Input {...form.register("processingTime")} />
        </Field>
      </div>
      <Field label="PIN codes you don't deliver to" error={err("blockedPincodes")} hint="One per line. Customers see that delivery is unavailable.">
        <Controller control={form.control} name="blockedPincodes" render={({ field }) => <LinesInput value={field.value} onChange={field.onChange} rows={4} placeholder="e.g. 744101" />} />
      </Field>
    </SectionForm>
  );
}

/* ---------------- Payments ---------------- */

export function PaymentsSettingsForm({ initial, razorpayConfigured }: { initial: z.input<typeof paymentsSectionSchema>; razorpayConfigured: boolean }) {
  const form = useForm({ resolver: zodResolver(paymentsSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  return (
    <SectionForm section="payments" form={form} title="Payments" description="Online payments run through Razorpay (UPI, cards, net banking, wallets). Orders are only marked paid after Razorpay confirms the payment.">
      <Controller
        control={form.control}
        name="razorpayEnabled"
        render={({ field }) => (
          <SwitchRow
            label="Online payments (Razorpay)"
            description={razorpayConfigured ? "Razorpay keys are configured on the server." : "Razorpay keys are not configured on the server (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET), so online payment stays unavailable until they are."}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <Controller control={form.control} name="codEnabled" render={({ field }) => <SwitchRow label="Cash on Delivery" description="Stock is reserved as soon as a COD order is placed." checked={field.value} onCheckedChange={field.onChange} />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="COD fee (₹)" error={err("codFee")} hint="0 for no fee.">
          <Controller control={form.control} name="codFee" render={({ field }) => <RupeeInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />
        </Field>
        <Field label="COD minimum order (₹)" error={err("codMinOrderValue")}>
          <Controller control={form.control} name="codMinOrderValue" render={({ field }) => <RupeeInput nullable value={field.value} onChange={field.onChange} placeholder="No minimum" />} />
        </Field>
        <Field label="COD maximum order (₹)" error={err("codMaxOrderValue")}>
          <Controller control={form.control} name="codMaxOrderValue" render={({ field }) => <RupeeInput nullable value={field.value} onChange={field.onChange} placeholder="No maximum" />} />
        </Field>
      </div>
    </SectionForm>
  );
}

/* ---------------- Tax ---------------- */

export function TaxSettingsForm({ initial }: { initial: z.input<typeof taxSectionSchema> }) {
  const form = useForm({ resolver: zodResolver(taxSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  return (
    <SectionForm section="tax" form={form} title="Tax (GST)" description="Check rates and HSN codes with your tax adviser. Invoices show CGST + SGST for orders in your state and IGST for other states.">
      <Controller
        control={form.control}
        name="pricesIncludeTax"
        render={({ field }) => <SwitchRow label="Prices include GST" description="Recommended in India: the price customers see is the price they pay." checked={field.value} onCheckedChange={field.onChange} />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Store state (place of supply)" error={err("storeState")}>
          <select {...form.register("storeState")} className={selectClass}>
            <option value="">Select state</option>
            {INDIAN_STATE_NAMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Default GST rate for new products" error={err("defaultGstRate")}>
          <select {...form.register("defaultGstRate", { valueAsNumber: true })} className={selectClass}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </Field>
        <Field label="GST on shipping and COD fees" error={err("shippingGstRate")}>
          <select {...form.register("shippingGstRate", { valueAsNumber: true })} className={selectClass}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </Field>
      </div>
    </SectionForm>
  );
}

/* ---------------- Orders & returns ---------------- */

export function OrdersSettingsForm({ initial }: { initial: z.input<typeof ordersSectionSchema> }) {
  const form = useForm({ resolver: zodResolver(ordersSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  return (
    <SectionForm section="orders" form={form} title="Orders & returns">
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller control={form.control} name="guestCheckoutEnabled" render={({ field }) => <SwitchRow label="Guest checkout" description="Customers can order without an account." checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller control={form.control} name="returnsEnabled" render={({ field }) => <SwitchRow label="Accept return requests" description="Customers can request returns after delivery." checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller
          control={form.control}
          name="autoRefundOnCustomerCancel"
          render={({ field }) => <SwitchRow label="Refund automatically when a customer cancels" description="Otherwise refunds for cancelled paid orders wait for approval." checked={field.value} onCheckedChange={field.onChange} />}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customers can cancel until" error={err("customerCancelUntil")}>
          <select {...form.register("customerCancelUntil")} className={selectClass}>
            <option value="confirmed">Order confirmed</option>
            <option value="processing">Processing</option>
            <option value="packed">Packed</option>
          </select>
        </Field>
        <Field label="Return window (days after delivery)" error={err("returnWindowDays")}>
          <Input type="number" min={0} max={60} {...form.register("returnWindowDays", intValue)} />
        </Field>
        <Field label="Hold stock for online payments (minutes)" error={err("reservationMinutes")} hint="Unpaid orders are cancelled after this.">
          <Input type="number" min={10} max={240} {...form.register("reservationMinutes", intValue)} />
        </Field>
        <Field label="Maximum quantity per item" error={err("maxQuantityPerItem")}>
          <Input type="number" min={1} max={99} {...form.register("maxQuantityPerItem", intValue)} />
        </Field>
      </div>
      <Field label="Send new-order and return alerts to" error={err("notificationEmails")} hint="One email address per line. Up to 10.">
        <Controller control={form.control} name="notificationEmails" render={({ field }) => <LinesInput value={field.value} onChange={field.onChange} rows={3} placeholder="orders@yourdomain.in" />} />
      </Field>
    </SectionForm>
  );
}

/* ---------------- Reviews ---------------- */

export function ReviewsSettingsForm({ initial }: { initial: z.input<typeof reviewsSectionSchema> }) {
  const form = useForm({ resolver: zodResolver(reviewsSectionSchema), defaultValues: initial });
  return (
    <SectionForm section="reviews" form={form} title="Reviews">
      <Controller control={form.control} name="enabled" render={({ field }) => <SwitchRow label="Accept product reviews" checked={field.value} onCheckedChange={field.onChange} />} />
      <Controller
        control={form.control}
        name="requirePurchase"
        render={({ field }) => <SwitchRow label="Only from customers who received the product" description="Reviews from verified purchases are labelled as such." checked={field.value} onCheckedChange={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="autoApprove"
        render={({ field }) => <SwitchRow label="Publish without moderation" description="When off, reviews wait in Reviews until approved." checked={field.value} onCheckedChange={field.onChange} />}
      />
    </SectionForm>
  );
}

/* ---------------- SEO ---------------- */

export function SeoSettingsForm({ initial }: { initial: z.input<typeof seoSectionSchema> }) {
  const form = useForm({ resolver: zodResolver(seoSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  const [title, description] = useWatch({ control: form.control, name: ["defaultTitle", "defaultDescription"] });
  return (
    <SectionForm section="seo" form={form} title="Search & sharing" description="Used for the home page and as a fallback where a page has no title of its own.">
      <Field label={`Title (${title.length}/70)`} error={err("defaultTitle")}>
        <Input {...form.register("defaultTitle")} />
      </Field>
      <Field label={`Description (${description.length}/170)`} error={err("defaultDescription")}>
        <Textarea rows={3} {...form.register("defaultDescription")} />
      </Field>
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">Search result preview</p>
        <p className="mt-1 truncate text-lg text-[#1a0dab]">{title}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </SectionForm>
  );
}

/* ---------------- Policies ---------------- */

const POLICIES = [
  { key: "shipping", label: "Shipping policy", fallback: DEFAULT_SHIPPING_POLICY },
  { key: "returns", label: "Returns & refunds policy", fallback: DEFAULT_RETURN_POLICY },
  { key: "privacy", label: "Privacy policy", fallback: DEFAULT_PRIVACY_POLICY },
  { key: "terms", label: "Terms & conditions", fallback: DEFAULT_TERMS },
  { key: "about", label: "About page", fallback: DEFAULT_ABOUT },
] as const;

export function PoliciesSettingsForm({ initial }: { initial: z.input<typeof policiesSectionSchema> }) {
  const form = useForm({ resolver: zodResolver(policiesSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  const values = useWatch({ control: form.control });
  return (
    <SectionForm
      section="policies"
      form={form}
      title="Policies & pages"
      description="Templates only, not legal advice: have them reviewed for your business. {{tokens}} are filled from your settings; replace every [placeholder] with real information before launch."
    >
      <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        Tokens: {"{{storeName}} {{legalName}} {{supportEmail}} {{supportPhone}} {{address}} {{returnWindowDays}} {{standardFee}} {{expressFee}} {{codFee}} {{freeShippingThreshold}} {{processingTime}}"}. Use # for headings, - for
        bullet points and a blank line between paragraphs.
      </p>
      {POLICIES.map((p) => {
        const placeholders = (values[p.key]?.match(/\[[^\]]+\]/g) ?? []).length;
        return (
          <Field
            key={p.key}
            label={p.label}
            error={err(p.key)}
            hint={
              placeholders ? (
                <span className="text-amber-700">
                  {placeholders} [placeholder]{placeholders === 1 ? "" : "s"} still to replace
                </span>
              ) : undefined
            }
          >
            <Textarea rows={10} className="font-mono text-xs" {...form.register(p.key)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue(p.key, p.fallback, { shouldDirty: true })}>
              <RotateCcw className="size-3.5" /> Restore template
            </Button>
          </Field>
        );
      })}
    </SectionForm>
  );
}
