"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activeFilterCount, buildShopHref, toggleValue, type ShopUrlState } from "@/lib/shop-url";
import { cn } from "@/lib/utils";

export interface FilterProps {
  basePath: string;
  state: ShopUrlState;
  categories: { name: string; slug: string; productCount: number }[];
  facets: { fragrances: string[]; sizes: string[]; priceMin: number; priceMax: number };
  showCategories: boolean;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-b pb-5">
      <legend className="mb-3 text-sm font-semibold text-brand-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function FilterBody({ basePath, state, categories, facets, showCategories, onNavigate }: FilterProps & { onNavigate?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [min, setMin] = useState(state.minPrice?.toString() ?? "");
  const [max, setMax] = useState(state.maxPrice?.toString() ?? "");
  const go = (overrides: Partial<ShopUrlState>) => {
    startTransition(() => router.push(buildShopHref(basePath, state, overrides), { scroll: false }));
    onNavigate?.();
  };
  const applyPrice = (event: FormEvent) => {
    event.preventDefault();
    const toNumber = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v))));
    let minPrice = toNumber(min);
    let maxPrice = toNumber(max);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
    go({ minPrice: Number.isNaN(minPrice) ? null : minPrice, maxPrice: Number.isNaN(maxPrice) ? null : maxPrice });
  };

  return (
    <div className={cn("space-y-5 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      {showCategories ? (
        <FilterGroup title="Category">
          <ul className="space-y-1">
            <li>
              <button type="button" onClick={() => go({ category: "" })} className={cn("w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-mint", !state.category && "bg-brand-mint font-semibold text-brand-green")}>
                All products
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => go({ category: c.slug })}
                  className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-mint", state.category === c.slug && "bg-brand-mint font-semibold text-brand-green")}
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.productCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </FilterGroup>
      ) : null}

      <FilterGroup title="Price (₹)">
        <form onSubmit={applyPrice} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="price-min" className="sr-only">
              Minimum price
            </Label>
            <Input id="price-min" inputMode="numeric" placeholder={`Min ${facets.priceMin}`} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className="h-9" />
            <span className="text-muted-foreground">–</span>
            <Label htmlFor="price-max" className="sr-only">
              Maximum price
            </Label>
            <Input id="price-max" inputMode="numeric" placeholder={`Max ${facets.priceMax}`} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} className="h-9" />
          </div>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Apply price
          </Button>
        </form>
      </FilterGroup>

      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={state.inStock} onCheckedChange={(checked) => go({ inStock: checked === true })} />
          In stock only
        </label>
      </FilterGroup>

      {facets.sizes.length ? (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const active = state.sizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={active}
                  onClick={() => go({ sizes: toggleValue(state.sizes, size) })}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium", active ? "border-brand-green bg-brand-green text-white" : "hover:border-brand-teal")}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      ) : null}

      {facets.fragrances.length ? (
        <FilterGroup title="Fragrance">
          <div className="space-y-2">
            {facets.fragrances.map((fragrance) => (
              <label key={fragrance} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={state.fragrances.includes(fragrance)} onCheckedChange={() => go({ fragrances: toggleValue(state.fragrances, fragrance) })} />
                {fragrance}
              </label>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      {activeFilterCount({ ...state, category: showCategories ? state.category : "" }) > 0 ? (
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link href={buildShopHref(basePath, { ...state, minPrice: null, maxPrice: null, inStock: false, fragrances: [], sizes: [], category: showCategories ? "" : state.category })} scroll={false}>
            <X className="size-4" /> Clear all filters
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function ShopFilters(props: FilterProps) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">
      <div className="sticky top-24">
        <FilterBody {...props} />
      </div>
    </aside>
  );
}

export function MobileFilters(props: FilterProps) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount({ ...props.state, category: props.showCategories ? props.state.category : "" });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal className="size-4" /> Filters{count ? ` (${count})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto">
        <SheetHeader className="px-1">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-8">
          <FilterBody {...props} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SortSelect({ basePath, state, options }: { basePath: string; state: ShopUrlState; options: Record<string, string> }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="shop-sort" className="hidden text-sm text-muted-foreground sm:block">
        Sort by
      </Label>
      <Select value={state.sort} onValueChange={(sort) => router.push(buildShopHref(basePath, state, { sort }), { scroll: false })}>
        <SelectTrigger id="shop-sort" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {Object.entries(options).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
