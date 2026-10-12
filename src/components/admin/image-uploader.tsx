"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductImage } from "@/components/shared/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface UploadedImage {
  url: string;
  alt: string;
  publicId?: string | null;
}

export async function uploadImage(file: File, folder: "products" | "categories" | "banners"): Promise<UploadedImage> {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  const res = await fetch("/api/admin/uploads", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; publicId?: string | null; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
  return { url: data.url, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), publicId: data.publicId ?? null };
}

export function ImageUploader({
  value,
  onChange,
  folder,
  max = 12,
  altPrefix = "",
}: {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  folder: "products" | "categories" | "banners";
  max?: number;
  altPrefix?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const next = [...value];
    for (const file of Array.from(files).slice(0, max - value.length)) {
      try {
        const image = await uploadImage(file, folder);
        next.push({ ...image, alt: altPrefix || image.alt });
      } catch (error) {
        toast.error(`${file.name}: ${(error as Error).message}`);
      }
    }
    onChange(next);
    setUploading(false);
    if (input.current) input.current.value = "";
  };

  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {value.map((image, index) => (
            <li key={`${image.url}-${index}`} className="flex gap-3 rounded-xl border bg-white p-2">
              <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                <ProductImage src={image.url} alt={image.alt} fill sizes="80px" className="object-cover" />
                {index === 0 ? <span className="absolute bottom-1 left-1 rounded bg-brand-green px-1.5 text-[10px] font-semibold text-white">Main</span> : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input
                  aria-label={`Alt text for image ${index + 1}`}
                  value={image.alt}
                  placeholder="Describe the image"
                  className="h-8 text-xs"
                  onChange={(e) => onChange(value.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)))}
                />
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move image up">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label="Move image down">
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="ml-auto text-destructive" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label="Remove image">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length < max ? (
        <div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple={max > 1} className="hidden" onChange={(e) => add(e.target.files)} />
          <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {uploading ? "Uploading…" : "Upload images"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or AVIF up to 5 MB. The first image is the main product photo.</p>
        </div>
      ) : null}
    </div>
  );
}
