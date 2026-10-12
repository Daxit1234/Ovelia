"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveCategoryAction } from "@/app/admin/products/actions";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { categoryInputSchema, type CategoryInput } from "@/lib/validation/product";

export function CategoryDialog({
  categoryId,
  initial,
  parents,
  trigger,
}: {
  categoryId?: string;
  initial: CategoryInput;
  parents: { id: string; name: string; depth: number }[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<CategoryInput>({ resolver: zodResolver(categoryInputSchema), defaultValues: initial });
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveCategoryAction(values, categoryId);
    if (!result.ok) {
      if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{categoryId ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" {...form.register("name")} />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">URL slug</Label>
              <Input id="cat-slug" placeholder="auto from name" {...form.register("slug")} />
              {errors.slug ? <p className="text-xs text-destructive">{errors.slug.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Parent category</Label>
              <select id="cat-parent" {...form.register("parentId")} className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
                <option value="">None (top level)</option>
                {parents
                  .filter((p) => p.id !== categoryId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {"— ".repeat(p.depth)}
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-sort">Sort order</Label>
              <Input id="cat-sort" type="number" {...form.register("sortOrder", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea id="cat-desc" rows={3} {...form.register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label>Image</Label>
            <Controller
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <ImageUploader
                  folder="categories"
                  max={1}
                  value={field.value ? [{ url: field.value, alt: form.getValues("imageAlt") }] : []}
                  onChange={(images) => {
                    field.onChange(images[0]?.url ?? "");
                    form.setValue("imageAlt", images[0]?.alt ?? "");
                  }}
                />
              )}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={field.value} onCheckedChange={field.onChange} /> Visible in store
                </label>
              )}
            />
            <Controller
              control={form.control}
              name="showOnHome"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={field.value} onCheckedChange={field.onChange} /> Show on home page
                </label>
              )}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-seo-title">SEO title</Label>
              <Input id="cat-seo-title" {...form.register("seoTitle")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-seo-desc">SEO description</Label>
              <Input id="cat-seo-desc" {...form.register("seoDescription")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
