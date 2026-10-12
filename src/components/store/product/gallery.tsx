"use client";

import { useState, type MouseEvent } from "react";
import { ProductImage } from "@/components/shared/product-image";
import type { ImageView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: ImageView[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const current = images[active] ?? images[0];

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  };

  if (!current) {
    return <div className="aspect-square w-full rounded-3xl bg-brand-mint" aria-label={`${name} image coming soon`} />;
  }

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto lg:flex-col" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Show image ${index + 1}: ${image.alt}`}
                onClick={() => setActive(index)}
                className={cn(
                  "relative block size-18 shrink-0 overflow-hidden rounded-xl border-2 bg-brand-mint transition-all sm:size-20",
                  index === active ? "border-brand-green" : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <ProductImage src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-3xl bg-brand-mint"
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
      >
        <ProductImage
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          priority={active === 0}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="animate-in object-cover duration-300 fade-in"
          style={zoom ? { transform: "scale(1.6)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
      </div>
    </div>
  );
}
