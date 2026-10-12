import { discountPercent, formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Selling price with MRP and savings — discounts shown only when MRP is higher. */
export function Price({
  price,
  mrp,
  size = "md",
  showSavings = false,
  prefix,
  className,
}: {
  price: number;
  mrp?: number;
  size?: "sm" | "md" | "lg";
  showSavings?: boolean;
  prefix?: string;
  className?: string;
}) {
  const percent = mrp ? discountPercent(mrp, price) : 0;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "font-heading font-bold text-brand-ink",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-3xl",
        )}
      >
        {prefix ? <span className="mr-1 text-sm font-medium text-muted-foreground">{prefix}</span> : null}
        {formatINR(price)}
      </span>
      {percent > 0 && mrp ? (
        <>
          <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-base" : "text-sm")}>
            <span className="sr-only">MRP </span>
            {formatINR(mrp)}
          </span>
          <span className={cn("font-semibold text-emerald-700", size === "lg" ? "text-base" : "text-sm")}>{percent}% off</span>
        </>
      ) : null}
      {showSavings && percent > 0 && mrp ? (
        <span className="w-full text-sm text-emerald-700">You save {formatINR(mrp - price)}</span>
      ) : null}
    </div>
  );
}
