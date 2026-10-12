import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, Heart, Package } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="bg-hero">
      <div className="container-page grid min-h-[calc(100dvh-10rem)] items-center gap-10 py-10 lg:grid-cols-2">
        <div className="hidden space-y-6 lg:block">
          <Logo showTagline />
          <h2 className="max-w-md font-heading text-4xl leading-tight font-extrabold text-brand-ink">Your home care, all in one place.</h2>
          <ul className="space-y-3 text-brand-ink/80">
            <li className="flex items-center gap-3">
              <Package className="size-5 text-brand-teal" aria-hidden /> Track orders and request returns easily
            </li>
            <li className="flex items-center gap-3">
              <Heart className="size-5 text-brand-teal" aria-hidden /> Save favourites to your wishlist
            </li>
            <li className="flex items-center gap-3">
              <BadgeCheck className="size-5 text-brand-teal" aria-hidden /> Faster checkout with saved addresses
            </li>
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md rounded-3xl border bg-white p-6 shadow-[0_24px_60px_-40px_rgba(11,77,59,0.6)] sm:p-8">
          <div className="mb-6 space-y-1.5">
            <h1 className="font-heading text-2xl font-extrabold text-brand-ink">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
          {footer ? <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-green hover:underline">
      {children}
    </Link>
  );
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
