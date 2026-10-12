"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveProductAction } from "@/app/admin/products/actions";
import { Field, fieldError as err, LinesInput, ProductPicker } from "@/components/admin/form-fields";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NEW_VARIANT } from "@/lib/admin/product-defaults";
import { GST_RATES, productInputSchema, SIZE_UNIT_OPTIONS, type ProductInput } from "@/lib/validation/product";

export function ProductForm({
  productId,
  initial,
  categories,
  products,
  canDelete,
}: {
  productId?: string;
  initial: ProductInput;
  categories: { id: string; name: string; depth: number }[];
  products: { id: string; name: string }[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const form = useForm<ProductInput>({ resolver: zodResolver(productInputSchema), defaultValues: initial, mode: "onTouched" });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  const specs = useFieldArray({ control: form.control, name: "specifications" });
  const errors = form.formState.errors;
  const existingVariantIds = useMemo(() => new Set(initial.variants.map((v) => v.id).filter(Boolean)), [initial.variants]);

  const onSubmit = form.handleSubmit(
    async (values) => {
      const result = await saveProductAction(values, productId);
      if (!result.ok) {
        if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      if (!productId) router.push(`/admin/products/${result.data.id}`);
      else {
        form.reset(values);
        router.refresh();
      }
    },
    () => toast.error("Please fix the highlighted fields."),
  );

  const num = { valueAsNumber: true } as const;

  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Panel title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" error={err(errors, "name")} className="sm:col-span-2">
              <Input {...form.register("name")} />
            </Field>
            <Field label="URL slug" error={err(errors, "slug")} hint="Leave blank to generate from the name.">
              <Input {...form.register("slug")} placeholder="lemon-dishwash-liquid" />
            </Field>
            <Field label="Category" error={err(errors, "categoryId")}>
              <select {...form.register("categoryId")} className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"— ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Short description" error={err(errors, "shortDescription")} className="sm:col-span-2" hint="Shown on product cards and in search results (max 300 characters).">
              <Textarea rows={2} {...form.register("shortDescription")} />
            </Field>
            <Field label="Full description" error={err(errors, "description")} className="sm:col-span-2" hint="Supports ## headings, - bullet lists and **bold**.">
              <Textarea rows={7} {...form.register("description")} />
            </Field>
          </div>
        </Panel>

        <Panel title="Images">
          <Controller control={form.control} name="images" render={({ field }) => <ImageUploader value={field.value} onChange={field.onChange} folder="products" />} />
        </Panel>

        <Panel
          title="Variants, pricing & stock"
          description="Each size has its own SKU, MRP, selling price and stock."
          actions={
            <Button type="button" size="sm" variant="outline" onClick={() => variants.append({ ...NEW_VARIANT })} disabled={variants.fields.length >= 20}>
              <Plus className="size-4" /> Add variant
            </Button>
          }
        >
          {err(errors, "variants") ? <p className="mb-3 text-sm text-destructive">{err(errors, "variants")}</p> : null}
          <div className="space-y-4">
            {variants.fields.map((field, index) => {
              const isExisting = Boolean(field.id && form.getValues(`variants.${index}.id`) && existingVariantIds.has(form.getValues(`variants.${index}.id`)));
              const p = `variants.${index}`;
              return (
                <div key={field.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Variant {index + 1}</p>
                    <div className="flex items-center gap-3">
                      <Controller
                        control={form.control}
                        name={`variants.${index}.isActive`}
                        render={({ field: f }) => (
                          <label className="flex items-center gap-2 text-sm">
                            <Switch checked={f.value} onCheckedChange={f.onChange} /> Active
                          </label>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => variants.remove(index)} disabled={variants.fields.length === 1} aria-label="Remove variant">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Label" error={err(errors, `${p}.label`)}>
                      <Input {...form.register(`variants.${index}.label`)} placeholder="500 ml" />
                    </Field>
                    <Field label="SKU" error={err(errors, `${p}.sku`)}>
                      <Input {...form.register(`variants.${index}.sku`)} className="uppercase" placeholder="OV-DW-500" />
                    </Field>
                    <Field label="Size" error={err(errors, `${p}.sizeValue`)}>
                      <div className="flex gap-2">
                        <Input type="number" step="any" {...form.register(`variants.${index}.sizeValue`, num)} />
                        <select {...form.register(`variants.${index}.sizeUnit`)} className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
                          {SIZE_UNIT_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Weight (g)" error={err(errors, `${p}.weightGrams`)}>
                      <Input type="number" {...form.register(`variants.${index}.weightGrams`, num)} />
                    </Field>
                    <Field label="MRP (₹)" error={err(errors, `${p}.mrp`)}>
                      <Input type="number" step="0.01" {...form.register(`variants.${index}.mrp`, num)} />
                    </Field>
                    <Field label="Selling price (₹)" error={err(errors, `${p}.price`)}>
                      <Input type="number" step="0.01" {...form.register(`variants.${index}.price`, num)} />
                    </Field>
                    <Field label="Cost price (₹)" error={err(errors, `${p}.costPrice`)} hint="Private — used for margin reports.">
                      <Input type="number" step="0.01" {...form.register(`variants.${index}.costPrice`, num)} />
                    </Field>
                    <Field label="Low-stock alert at" error={err(errors, `${p}.lowStockThreshold`)}>
                      <Input type="number" {...form.register(`variants.${index}.lowStockThreshold`, num)} />
                    </Field>
                    {isExisting ? (
                      <Field label="Stock" hint="Change stock from Inventory so every adjustment is recorded.">
                        <div className="flex items-center gap-2">
                          <Input value={form.getValues(`variants.${index}.stock`)} disabled />
                          <Link href={`/admin/inventory?q=${encodeURIComponent(form.getValues(`variants.${index}.sku`))}`} className="text-xs font-semibold whitespace-nowrap text-brand-green">
                            Adjust
                          </Link>
                        </div>
                      </Field>
                    ) : (
                      <Field label="Opening stock" error={err(errors, `${p}.stock`)}>
                        <Input type="number" {...form.register(`variants.${index}.stock`, num)} />
                      </Field>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Product details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key highlights (one per line)" error={err(errors, "highlights")} className="sm:col-span-2">
              <Controller control={form.control} name="highlights" render={({ field }) => <LinesInput value={field.value} onChange={field.onChange} rows={4} />} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Specifications</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => specs.append({ label: "", value: "" })} disabled={specs.fields.length >= 20}>
                  <Plus className="size-4" /> Add row
                </Button>
              </div>
              {specs.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input aria-label="Specification name" placeholder="e.g. Fragrance" {...form.register(`specifications.${index}.label`)} />
                  <Input aria-label="Specification value" placeholder="e.g. Lemon" {...form.register(`specifications.${index}.value`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => specs.remove(index)} aria-label="Remove row">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Field label="How to use" error={err(errors, "usageInstructions")} className="sm:col-span-2">
              <Textarea rows={3} {...form.register("usageInstructions")} />
            </Field>
            <Field label="Safety information" error={err(errors, "safetyInformation")} className="sm:col-span-2">
              <Textarea rows={3} {...form.register("safetyInformation")} />
            </Field>
            <Field label="Ingredients" error={err(errors, "ingredients")} className="sm:col-span-2" hint="Only shown when filled in. Use the formulation details supplied by the manufacturer.">
              <Textarea rows={2} {...form.register("ingredients")} />
            </Field>
            <Field label="Fragrance" error={err(errors, "fragrance")}>
              <Input {...form.register("fragrance")} placeholder="Lemon" />
            </Field>
            <Field label="Search tags (one per line)" error={err(errors, "tags")}>
              <Controller control={form.control} name="tags" render={({ field }) => <LinesInput value={field.value} onChange={field.onChange} rows={3} />} />
            </Field>
            <Field label="Shipping info override" error={err(errors, "shippingInfo")} hint="Leave blank to use the store shipping summary.">
              <Textarea rows={2} {...form.register("shippingInfo")} />
            </Field>
            <Field label="Return info override" error={err(errors, "returnInfo")} hint="Leave blank to use the store return summary.">
              <Textarea rows={2} {...form.register("returnInfo")} />
            </Field>
          </div>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Related products">
            <Controller control={form.control} name="relatedProductIds" render={({ field }) => <ProductPicker options={products} value={field.value} onChange={field.onChange} max={12} exclude={productId} />} />
          </Panel>
          <Panel title="Frequently bought together">
            <Controller control={form.control} name="fbtProductIds" render={({ field }) => <ProductPicker options={products} value={field.value} onChange={field.onChange} max={6} exclude={productId} />} />
          </Panel>
        </div>
      </div>

      <div className="space-y-5 xl:sticky xl:top-20">
        <Panel title="Publishing">
          <div className="space-y-3">
            <Field label="Status">
              <select {...form.register("status")} className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published</option>
              </select>
            </Field>
            {(["isFeatured", "isBestSeller", "isNewArrival", "reviewsEnabled"] as const).map((name) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-2 text-sm">
                    {{ isFeatured: "Featured on home page", isBestSeller: "Best seller badge", isNewArrival: "New arrival badge", reviewsEnabled: "Allow reviews" }[name]}
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} {productId ? "Save changes" : "Create product"}
            </Button>
            {canDelete && productId ? <p className="text-xs text-muted-foreground">Delete is available from the product list.</p> : null}
          </div>
        </Panel>
        <Panel title="Tax">
          <div className="grid grid-cols-2 gap-3">
            <Field label="HSN code" error={err(errors, "hsnCode")}>
              <Input {...form.register("hsnCode")} placeholder="3402" />
            </Field>
            <Field label="GST rate" error={err(errors, "gstRate")}>
              <select {...form.register("gstRate", num)} className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Confirm HSN codes and GST rates with your tax advisor.</p>
        </Panel>
        <Panel title="Search engine listing">
          <div className="space-y-3">
            <Field label="SEO title" error={err(errors, "seoTitle")} hint="Max 70 characters. Defaults to the product name.">
              <Input {...form.register("seoTitle")} />
            </Field>
            <Field label="SEO description" error={err(errors, "seoDescription")} hint="Max 170 characters. Defaults to the short description.">
              <Textarea rows={3} {...form.register("seoDescription")} />
            </Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}
