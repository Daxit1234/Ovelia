import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, count, size = "sm", className }: { value: number; count?: number; size?: "sm" | "md"; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex" role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => {
          const fill = rounded >= i + 1 ? 1 : rounded >= i + 0.5 ? 0.5 : 0;
          return (
            <span key={i} className="relative">
              <Star className={cn("text-amber-300", size === "sm" ? "size-3.5" : "size-5")} strokeWidth={1.5} />
              {fill > 0 ? (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star className={cn("fill-amber-400 text-amber-400", size === "sm" ? "size-3.5" : "size-5")} strokeWidth={1.5} />
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {typeof count === "number" ? <span className="text-xs text-muted-foreground">({count})</span> : null}
    </div>
  );
}
