"use client";

import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveContentSettingsAction } from "@/app/admin/content/actions";
import { Field, fieldError, selectClass, SwitchRow } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { announcementSectionSchema, homepageSectionSchema } from "@/lib/validation/settings";

type HomepageValues = z.input<typeof homepageSectionSchema>;
type AnnouncementValues = z.input<typeof announcementSectionSchema>;

const ICONS = ["sparkles", "leaf", "shield", "truck", "badge", "heart", "droplet", "home"] as const;

const SECTION_TOGGLES: { name: keyof HomepageValues; label: string; description: string }[] = [
  { name: "showBestSellers", label: "Best sellers", description: "Products marked as best sellers, then top-selling products." },
  { name: "showNewArrivals", label: "New arrivals", description: "Products marked as new." },
  { name: "showBundles", label: "Combos & kits", description: "Combo offers from Promotions." },
  { name: "showTestimonials", label: "Testimonials", description: "Hidden automatically while there are none." },
  { name: "showFaq", label: "FAQs", description: "Questions marked “Show on home page”." },
  { name: "showNewsletter", label: "Newsletter sign-up", description: "Email sign-up with consent." },
];

export function HomepageForm({ initial }: { initial: HomepageValues }) {
  const router = useRouter();
  const form = useForm<HomepageValues>({ resolver: zodResolver(homepageSectionSchema), defaultValues: initial });
  const why = useFieldArray({ control: form.control, name: "whyChoose" });
  const err = (p: string) => fieldError(form.formState.errors, p);
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveContentSettingsAction("homepage", values);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Homepage saved");
    router.refresh();
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Panel title="Hero" description="Shown when no active hero banner is scheduled.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Small heading" error={err("heroEyebrow")}>
            <Input {...form.register("heroEyebrow")} />
          </Field>
          <Field label="Title" error={err("heroTitle")}>
            <Input {...form.register("heroTitle")} />
          </Field>
          <Field label="Text" error={err("heroSubtitle")} className="sm:col-span-2">
            <Textarea rows={3} {...form.register("heroSubtitle")} />
          </Field>
          <Field label="Button label" error={err("heroCtaLabel")}>
            <Input {...form.register("heroCtaLabel")} />
          </Field>
          <Field label="Button link" error={err("heroCtaHref")}>
            <Input {...form.register("heroCtaHref")} />
          </Field>
        </div>
      </Panel>
      <Panel title="Sections">
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTION_TOGGLES.map((s) => (
            <Controller key={s.name} control={form.control} name={s.name} render={({ field }) => <SwitchRow label={s.label} description={s.description} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          ))}
        </div>
      </Panel>
      <Panel title="Why choose Ovelia" description="Short, true statements about your store. Avoid claims you can't back up, such as certifications you don't hold.">
        <div className="space-y-3">
          {why.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
              <select aria-label="Icon" {...form.register(`whyChoose.${i}.icon`)} className={selectClass}>
                {ICONS.map((icon) => (
                  <option key={icon} value={icon} className="capitalize">
                    {icon[0].toUpperCase() + icon.slice(1)}
                  </option>
                ))}
              </select>
              <div className="space-y-2">
                <Input aria-label="Title" placeholder="Title" {...form.register(`whyChoose.${i}.title`)} />
                <Textarea aria-label="Description" rows={2} placeholder="Description" {...form.register(`whyChoose.${i}.description`)} />
                {err(`whyChoose.${i}.title`) ? <p className="text-xs text-destructive">{err(`whyChoose.${i}.title`)}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => why.remove(i)} aria-label="Remove">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => why.append({ title: "", description: "", icon: "sparkles" })} disabled={why.fields.length >= 8}>
            <Plus className="size-4" /> Add point
          </Button>
        </div>
      </Panel>
      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save homepage
        </Button>
      </div>
    </form>
  );
}

export function AnnouncementForm({ initial }: { initial: AnnouncementValues }) {
  const router = useRouter();
  const form = useForm<AnnouncementValues>({ resolver: zodResolver(announcementSectionSchema), defaultValues: initial });
  const err = (p: string) => fieldError(form.formState.errors, p);
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveContentSettingsAction("announcement", values);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Announcement bar saved");
    router.refresh();
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <Panel title="Announcement bar" description="The thin strip above the header on every page. When the text is empty, the free-delivery threshold is shown.">
        <div className="space-y-4">
          <Controller control={form.control} name="enabled" render={({ field }) => <SwitchRow label="Show the announcement bar" checked={field.value} onCheckedChange={field.onChange} />} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Text" error={err("text")}>
              <Input {...form.register("text")} placeholder="e.g. Festive offers are live — up to 15% off" />
            </Field>
            <Field label="Link" error={err("href")} hint="Optional, e.g. /offers">
              <Input {...form.register("href")} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </div>
        </div>
      </Panel>
    </form>
  );
}
