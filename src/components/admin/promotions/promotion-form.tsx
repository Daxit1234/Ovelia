"use client";

import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Shuffle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { savePromotionAction } from "@/app/admin/promotions/actions";
import { Field, fieldError, ProductPicker, selectClass, SwitchRow } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROMOTION_TYPES } from "@/lib/domain/pricing";
import { formatINR, toPaise } from "@/lib/money";
import { PROMOTION_TYPE_LABELS, promotionInputSchema, type PromotionData, type PromotionInput } from "@/lib/validation/promotion";

type ProductOption = { id: string; name: string; variants: { id: string; label: string; sku: string }[] };

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `OVL${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

function NullableNumber({ control, name, placeholder, step = "1", id }: { control: Control<PromotionInput, unknown, PromotionData>; name: "maxDiscount" | "usageLimit" | "usageLimitPerCustomer" | "bundlePrice"; placeholder: string; step?: string; id?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          placeholder={placeholder}
          value={field.value ?? ""}
          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
          onBlur={field.onBlur}
        />
      )}
    />
  );
}

const rupees = (v: number | null | undefined) => formatINR(toPaise(Number(v ?? 0)));

/** Plain-language description of the promotion, built from the form values. */
function describe(v: PromotionInput, products: ProductOption[], categories: { id: string; name: string }[]): string[] {
  const lines: string[] = [];
  const how = v.trigger === "code" ? `Customers enter ${v.code || "the code"} at checkout` : "Applied automatically at checkout";
  let offer = "";
  switch (v.type) {
    case "percentage":
      offer = `${v.value || 0}% off${v.maxDiscount ? `, up to ${rupees(v.maxDiscount)}` : ""}`;
      break;
    case "fixed":
      offer = `${rupees(v.value)} off`;
      break;
    case "free_shipping":
      offer = "free standard shipping";
      break;
    case "buy_x_get_y":
      offer = `buy ${v.buyQuantity}, get ${v.getQuantity} ${v.getDiscountPercent >= 100 ? "free" : `at ${v.getDiscountPercent}% off`} (cheapest items discounted)`;
      break;
    case "bundle": {
      const items = v.bundleItems.map((i) => {
        const p = products.find((x) => x.id === i.productId);
        const size = p?.variants.find((x) => x.id === i.variantId)?.label;
        return `${i.quantity} × ${p?.name ?? "?"}${size ? ` ${size}` : ""}`;
      });
      offer = `${items.join(" + ") || "the combo items"} for ${rupees(v.bundlePrice)}`;
      break;
    }
  }
  lines.push(`${how}: ${offer}.`);
  if (v.type !== "bundle" && v.type !== "free_shipping") {
    if (v.appliesTo === "products") lines.push(`Only on ${v.productIds.length} selected product${v.productIds.length === 1 ? "" : "s"}.`);
    if (v.appliesTo === "categories") lines.push(`Only on ${v.categoryIds.map((id) => categories.find((c) => c.id === id)?.name ?? "?").join(", ") || "selected categories"}.`);
  }
  const conditions: string[] = [];
  if (v.minSubtotal > 0) conditions.push(`orders of ${rupees(v.minSubtotal)} or more`);
  if (v.minQuantity > 0) conditions.push(`at least ${v.minQuantity} items`);
  if (conditions.length) lines.push(`Needs ${conditions.join(" and ")}.`);
  if (v.firstOrderOnly) lines.push("First order only.");
  if (v.usageLimitPerCustomer) lines.push(`${v.usageLimitPerCustomer === 1 ? "Once" : `${v.usageLimitPerCustomer} times`} per customer.`);
  if (v.usageLimit) lines.push(`Ends after ${v.usageLimit} uses in total.`);
  lines.push(v.stackable ? "Can be combined with other stackable offers." : "Not combined with other offers: the best single deal for the customer wins.");
  if (!v.isActive) lines.push("Paused: customers can't use it.");
  return lines;
}

export function PromotionForm({
  promotionId,
  initial,
  products,
  categories,
}: {
  promotionId?: string;
  initial: PromotionInput;
  products: ProductOption[];
  categories: { id: string; name: string; depth: number }[];
}) {
  const router = useRouter();
  const form = useForm<PromotionInput, unknown, PromotionData>({ resolver: zodResolver(promotionInputSchema), defaultValues: initial, mode: "onTouched" });
  const bundle = useFieldArray({ control: form.control, name: "bundleItems" });
  const values = useWatch({ control: form.control }) as PromotionInput;
  const errors = form.formState.errors;
  const err = (path: string) => fieldError(errors, path);
  const type = values.type;

  const onSubmit = form.handleSubmit(
    async (data) => {
      const result = await savePromotionAction(data, promotionId);
      if (!result.ok) {
        if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      if (!promotionId) router.push(`/admin/promotions/${result.data.id}`);
      else router.refresh();
    },
    () => toast.error("Please fix the highlighted fields."),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="min-w-0 space-y-5">
        <Panel title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={err("name")} className="sm:col-span-2" hint="Shown to customers on the cart and offers page.">
              <Input {...form.register("name")} placeholder="e.g. Monsoon sale — 15% off" />
            </Field>
            <Field label="Description" error={err("description")} className="sm:col-span-2">
              <Textarea rows={2} {...form.register("description")} placeholder="Short explanation of the offer and its conditions" />
            </Field>
            <Field label="Campaign (internal)" error={err("campaign")} hint="Group related offers for reporting.">
              <Input {...form.register("campaign")} placeholder="e.g. Festive season" />
            </Field>
          </div>
        </Panel>

        <Panel title="How customers get it">
          <div className="space-y-4">
            <Controller
              control={form.control}
              name="trigger"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Trigger" className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["code", "Coupon code", "Customers type a code at checkout."],
                      ["automatic", "Automatic", "Applied by itself when the cart qualifies."],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label key={value} className={`cursor-pointer rounded-xl border p-3 ${field.value === value ? "border-brand-teal bg-brand-mint" : ""}`}>
                      <input type="radio" className="sr-only" checked={field.value === value} onChange={() => field.onChange(value)} />
                      <span className="block text-sm font-semibold text-brand-ink">{label}</span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </label>
                  ))}
                </div>
              )}
            />
            {values.trigger === "code" ? (
              <Field label="Coupon code" htmlFor="promo-code" error={err("code")} hint="Letters, numbers, - and _. Not case-sensitive for customers.">
                <div className="flex gap-2">
                  <Input id="promo-code" {...form.register("code")} className="font-mono uppercase placeholder:font-sans placeholder:normal-case" placeholder="e.g. WELCOME10" autoComplete="off" aria-describedby="promo-code-hint" />
                  <Button type="button" variant="outline" onClick={() => form.setValue("code", randomCode(), { shouldDirty: true, shouldValidate: true })}>
                    <Shuffle className="size-4" /> Generate
                  </Button>
                </div>
              </Field>
            ) : null}
          </div>
        </Panel>

        <Panel title="Discount">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" error={err("type")} className="sm:col-span-2">
              <select {...form.register("type")} className={selectClass}>
                {PROMOTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROMOTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            {type === "percentage" || type === "fixed" ? (
              <Field label={type === "percentage" ? "Percentage off" : "Amount off (₹)"} error={err("value")}>
                <Input type="number" inputMode="decimal" min={0} step={type === "percentage" ? "1" : "0.01"} {...form.register("value", { valueAsNumber: true })} />
              </Field>
            ) : null}
            {type === "percentage" || type === "buy_x_get_y" ? (
              <Field label="Maximum discount (₹)" error={err("maxDiscount")} hint="Optional cap per order.">
                <NullableNumber control={form.control} name="maxDiscount" placeholder="No cap" step="0.01" />
              </Field>
            ) : null}
            {type === "buy_x_get_y" ? (
              <>
                <Field label="Customer buys" error={err("buyQuantity")}>
                  <Input type="number" min={1} {...form.register("buyQuantity", { valueAsNumber: true })} />
                </Field>
                <Field label="And gets" error={err("getQuantity")}>
                  <Input type="number" min={1} {...form.register("getQuantity", { valueAsNumber: true })} />
                </Field>
                <Field label="Discount on the items they get (%)" error={err("getDiscountPercent")} hint="100 = free. The cheapest eligible items are discounted.">
                  <Input type="number" min={1} max={100} {...form.register("getDiscountPercent", { valueAsNumber: true })} />
                </Field>
              </>
            ) : null}
            {type === "free_shipping" ? <p className="text-sm text-muted-foreground sm:col-span-2">Removes the standard shipping fee. Express delivery is still charged.</p> : null}
            {type === "bundle" ? (
              <div className="space-y-3 sm:col-span-2">
                <p className="text-sm text-muted-foreground">When the cart has every item below, those items together cost the combo price. Leave the size as “Any size” to accept every size.</p>
                {bundle.fields.map((f, index) => {
                  const productId = values.bundleItems?.[index]?.productId;
                  const variants = products.find((p) => p.id === productId)?.variants ?? [];
                  return (
                    <div key={f.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_160px_90px_auto]">
                      <select aria-label="Product" {...form.register(`bundleItems.${index}.productId`, { onChange: () => form.setValue(`bundleItems.${index}.variantId`, "") })} className={selectClass}>
                        <option value="">Choose a product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select aria-label="Size" {...form.register(`bundleItems.${index}.variantId`)} className={selectClass}>
                        <option value="">Any size</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <Input aria-label="Quantity" type="number" min={1} {...form.register(`bundleItems.${index}.quantity`, { valueAsNumber: true })} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => bundle.remove(index)} aria-label="Remove item">
                        <Trash2 className="size-4" />
                      </Button>
                      {err(`bundleItems.${index}.productId`) ? <p className="text-xs text-destructive sm:col-span-4">Choose a product</p> : null}
                    </div>
                  );
                })}
                {err("bundleItems") ? <p className="text-xs text-destructive">{err("bundleItems")}</p> : null}
                <div className="flex flex-wrap items-end gap-3">
                  <Button type="button" variant="outline" onClick={() => bundle.append({ productId: "", variantId: "", quantity: 1 })} disabled={bundle.fields.length >= 10}>
                    <Plus className="size-4" /> Add item
                  </Button>
                  <Field label="Combo price (₹)" error={err("bundlePrice")} className="w-48">
                    <NullableNumber control={form.control} name="bundlePrice" placeholder="e.g. 299" step="0.01" />
                  </Field>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        {type !== "bundle" && type !== "free_shipping" ? (
          <Panel title="Applies to">
            <div className="space-y-4">
              <select {...form.register("appliesTo")} className={selectClass} aria-label="Applies to">
                <option value="all">All products</option>
                <option value="products">Specific products</option>
                <option value="categories">Specific categories</option>
              </select>
              {values.appliesTo === "products" ? (
                <Field label="Products" error={err("productIds")}>
                  <Controller control={form.control} name="productIds" render={({ field }) => <ProductPicker options={products} value={field.value} onChange={field.onChange} max={200} />} />
                </Field>
              ) : null}
              {values.appliesTo === "categories" ? (
                <Field label="Categories" error={err("categoryIds")} hint="Includes products in sub-categories.">
                  <Controller
                    control={form.control}
                    name="categoryIds"
                    render={({ field }) => <ProductPicker options={categories} value={field.value} onChange={field.onChange} max={50} searchLabel="Search categories" emptyLabel="No categories" />}
                  />
                </Field>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <Panel title="Conditions and limits">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum order value (₹)" error={err("minSubtotal")} hint="Cart total before discounts. 0 for none.">
              <Input type="number" inputMode="decimal" min={0} step="0.01" {...form.register("minSubtotal", { setValueAs: (v) => (v === "" ? 0 : Number(v)) })} />
            </Field>
            <Field label="Minimum number of items" error={err("minQuantity")} hint="Counts eligible items only. 0 for none.">
              <Input type="number" min={0} {...form.register("minQuantity", { setValueAs: (v) => (v === "" ? 0 : Number(v)) })} />
            </Field>
            <Field label="Total uses" error={err("usageLimit")} hint="Across all customers. Blank for unlimited.">
              <NullableNumber control={form.control} name="usageLimit" placeholder="Unlimited" />
            </Field>
            <Field label="Uses per customer" error={err("usageLimitPerCustomer")} hint="Matched by account, email and phone.">
              <NullableNumber control={form.control} name="usageLimitPerCustomer" placeholder="Unlimited" />
            </Field>
            <div className="sm:col-span-2">
              <Controller
                control={form.control}
                name="firstOrderOnly"
                render={({ field }) => <SwitchRow label="First order only" description="Only for customers with no earlier confirmed orders (by account, email or phone)." checked={field.value} onCheckedChange={field.onChange} />}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Schedule and combining">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts (IST)" error={err("startsAt")} hint="Blank to start immediately.">
              <Input type="datetime-local" {...form.register("startsAt")} />
            </Field>
            <Field label="Ends (IST)" error={err("endsAt")} hint="Blank to run until paused.">
              <Input type="datetime-local" {...form.register("endsAt")} />
            </Field>
            <div className="sm:col-span-2">
              <Controller
                control={form.control}
                name="stackable"
                render={({ field }) => (
                  <SwitchRow
                    label="Can be combined with other offers"
                    description="When off, the customer gets whichever single offer saves them the most. Stackable offers apply together."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            <Field label="Priority" error={err("priority")} hint="Higher runs first when several offers apply. −100 to 100.">
              <Input type="number" min={-100} max={100} {...form.register("priority", { setValueAs: (v) => (v === "" ? 0 : Number(v)) })} />
            </Field>
          </div>
        </Panel>

        <Panel title="Storefront">
          <div className="space-y-4">
            <Controller
              control={form.control}
              name="showOnStorefront"
              render={({ field }) => <SwitchRow label="Show on the offers page" description="Lists the offer on /offers and in promotional banners while it is active." checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Field label="Banner text" error={err("bannerText")}>
              <Input {...form.register("bannerText")} placeholder="e.g. Buy any 2 products and save 10% automatically" />
            </Field>
          </div>
        </Panel>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Panel title="Summary">
          <ul className="space-y-1.5 text-sm text-brand-ink">
            {describe(values, products, categories).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-4 border-t pt-4">
            <Controller control={form.control} name="isActive" render={({ field }) => <SwitchRow label="Active" description="Paused offers can't be used." checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {promotionId ? "Save changes" : "Create promotion"}
          </Button>
        </Panel>
        <p className="text-xs text-muted-foreground">Discounts are always recalculated on the server at checkout, so customers cannot change them.</p>
      </aside>
    </form>
  );
}
