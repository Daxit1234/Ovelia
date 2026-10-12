import { cn } from "@/lib/utils";

/** Ovelia mark: a water droplet holding a fresh leaf. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="ovelia-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e8f80" />
          <stop offset="1" stopColor="#0b4d3b" />
        </linearGradient>
      </defs>
      <path d="M16 2.5S5.5 13.6 5.5 20a10.5 10.5 0 0 0 21 0C26.5 13.6 16 2.5 16 2.5Z" fill="url(#ovelia-mark)" />
      <path d="M11 21.6c3.6-.3 7.6-2.5 9.4-7.3.4 5.1-2.4 9.6-7.1 9.9-1.2.1-2-.8-2.3-2.6Z" fill="#fff" />
      <path d="M11.6 22.4c2.3-1.6 4.4-3.6 6.2-6.4" stroke="#5ec9b9" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, tone = "dark", showTagline = false }: { className?: string; tone?: "dark" | "light"; showTagline?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading text-[1.6rem] font-extrabold tracking-tight",
            tone === "dark" ? "text-brand-green" : "text-white",
          )}
        >
          Ovelia
        </span>
        {showTagline ? (
          <span className={cn("mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]", tone === "dark" ? "text-brand-teal" : "text-white/70")}>
            Home &amp; car care
          </span>
        ) : null}
      </span>
    </span>
  );
}
