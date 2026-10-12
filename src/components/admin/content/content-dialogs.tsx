"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveBannerAction, saveFaqAction, saveTestimonialAction } from "@/app/admin/content/actions";
import { Field, fieldError, selectClass, SwitchRow } from "@/components/admin/form-fields";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type AnyForm } from "@/lib/forms";
import {
  BANNER_THEMES,
  bannerInputSchema,
  faqInputSchema,
  testimonialInputSchema,
  type BannerInput,
  type FaqInput,
  type TestimonialInput,
} from "@/lib/validation/content";

type SaveResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Dialog shell shared by the content editors: resets on open, maps server field errors, refreshes on save. */
function EditorDialog<T extends FieldValues>({
  title,
  description,
  trigger,
  form,
  initial,
  save,
  children,
}: {
  title: string;
  description?: string;
  trigger: ReactNode;
  form: AnyForm<T>;
  initial: T;
  save: (values: T) => Promise<SaveResult>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await save(values);
    if (!result.ok) {
      if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Saved");
    setOpen(false);
    router.refresh();
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(initial);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const intOrZero = (v: unknown) => (v === "" || v === null || v === undefined ? 0 : Number(v));

export function BannerDialog({ bannerId, initial, trigger }: { bannerId?: string; initial: BannerInput; trigger: ReactNode }) {
  const form = useForm<BannerInput>({ resolver: zodResolver(bannerInputSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  return (
    <EditorDialog title={bannerId ? "Edit banner" : "New banner"} description="Hero banners rotate at the top of the home page; promo banners appear between sections." trigger={trigger} form={form} initial={initial} save={(v) => saveBannerAction(v, bannerId)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Placement" error={err("placement")}>
          <select {...form.register("placement")} className={selectClass}>
            <option value="hero">Hero (top of home page)</option>
            <option value="promo">Promo strip</option>
          </select>
        </Field>
        <Field label="Colour theme" error={err("theme")}>
          <select {...form.register("theme")} className={selectClass}>
            {BANNER_THEMES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Small heading" error={err("eyebrow")} hint="Optional, above the title.">
          <Input {...form.register("eyebrow")} />
        </Field>
        <Field label="Title" error={err("title")}>
          <Input {...form.register("title")} />
        </Field>
        <Field label="Text" error={err("subtitle")} className="sm:col-span-2">
          <Textarea rows={2} {...form.register("subtitle")} />
        </Field>
        <Field label="Button label" error={err("ctaLabel")}>
          <Input {...form.register("ctaLabel")} />
        </Field>
        <Field label="Button link" error={err("ctaHref")} hint="e.g. /shop or /categories/kitchen-care">
          <Input {...form.register("ctaHref")} />
        </Field>
        <div className="space-y-1.5 sm:col-span-2">
          <Controller
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <Field label="Image" hint="Optional. Wide images (about 1600 × 700) work best. JPEG, PNG, WebP or AVIF up to 5 MB.">
                <ImageUploader
                  folder="banners"
                  max={1}
                  value={field.value ? [{ url: field.value, alt: form.getValues("imageAlt") }] : []}
                  onChange={(images) => {
                    field.onChange(images[0]?.url ?? "");
                    form.setValue("imageAlt", images[0]?.alt ?? "");
                  }}
                />
              </Field>
            )}
          />
        </div>
        <Field label="Image description (alt text)" error={err("imageAlt")} className="sm:col-span-2">
          <Input {...form.register("imageAlt")} />
        </Field>
        <Field label="Show from (IST)" error={err("startsAt")} hint="Blank to show now.">
          <Input type="datetime-local" {...form.register("startsAt")} />
        </Field>
        <Field label="Show until (IST)" error={err("endsAt")} hint="Blank for no end.">
          <Input type="datetime-local" {...form.register("endsAt")} />
        </Field>
        <Field label="Order" error={err("sortOrder")} hint="Lower numbers show first.">
          <Input type="number" min={0} {...form.register("sortOrder", { setValueAs: intOrZero })} />
        </Field>
        <div className="self-end">
          <Controller control={form.control} name="isActive" render={({ field }) => <SwitchRow label="Active" checked={field.value} onCheckedChange={field.onChange} />} />
        </div>
      </div>
    </EditorDialog>
  );
}

export function FaqDialog({ faqId, initial, trigger, categories }: { faqId?: string; initial: FaqInput; trigger: ReactNode; categories: string[] }) {
  const form = useForm<FaqInput>({ resolver: zodResolver(faqInputSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  const listId = `faq-categories-${faqId ?? "new"}`;
  return (
    <EditorDialog title={faqId ? "Edit question" : "New question"} trigger={trigger} form={form} initial={initial} save={(v) => saveFaqAction(v, faqId)}>
      <Field label="Question" error={err("question")}>
        <Input {...form.register("question")} />
      </Field>
      <Field label="Answer" error={err("answer")} hint="Plain text. Blank lines start new paragraphs.">
        <Textarea rows={6} {...form.register("answer")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category" error={err("category")} hint="Questions are grouped by category on the FAQ page.">
          <Input list={listId} {...form.register("category")} />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Order" error={err("sortOrder")}>
          <Input type="number" min={0} {...form.register("sortOrder", { setValueAs: intOrZero })} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller control={form.control} name="isPublished" render={({ field }) => <SwitchRow label="Published" description="Shown on the FAQ page." checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller control={form.control} name="showOnHome" render={({ field }) => <SwitchRow label="Show on home page" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>
    </EditorDialog>
  );
}

export function TestimonialDialog({ testimonialId, initial, trigger }: { testimonialId?: string; initial: TestimonialInput; trigger: ReactNode }) {
  const form = useForm<TestimonialInput>({ resolver: zodResolver(testimonialInputSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  return (
    <EditorDialog
      title={testimonialId ? "Edit testimonial" : "New testimonial"}
      description="Only add genuine feedback from real customers, in their own words, with their permission. Never write or edit testimonials to sound better."
      trigger={trigger}
      form={form}
      initial={initial}
      save={(v) => saveTestimonialAction(v, testimonialId)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name (as they agreed to be shown)" error={err("name")}>
          <Input {...form.register("name")} placeholder="e.g. Priya S." />
        </Field>
        <Field label="City (optional)" error={err("location")}>
          <Input {...form.register("location")} />
        </Field>
      </div>
      <Field label="What they said" error={err("quote")}>
        <Textarea rows={4} {...form.register("quote")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Their rating (optional)" error={err("rating")}>
          <Controller
            control={form.control}
            name="rating"
            render={({ field }) => (
              <select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} className={selectClass}>
                <option value="">No rating</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} star{r === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            )}
          />
        </Field>
        <Field label="Order" error={err("sortOrder")}>
          <Input type="number" min={0} {...form.register("sortOrder", { setValueAs: intOrZero })} />
        </Field>
      </div>
      <Controller
        control={form.control}
        name="consentConfirmed"
        render={({ field }) => (
          <div className="space-y-1">
            <label className="flex items-start gap-2 rounded-xl border p-3 text-sm">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
              <span>This is genuine feedback from a real customer, and they agreed to it being shown on the website with the name above.</span>
            </label>
            {err("consentConfirmed") ? <p className="text-xs text-destructive">{err("consentConfirmed")}</p> : null}
          </div>
        )}
      />
      <Controller control={form.control} name="isPublished" render={({ field }) => <SwitchRow label="Published" description="Shown on the home page when testimonials are turned on." checked={field.value} onCheckedChange={field.onChange} />} />
    </EditorDialog>
  );
}
