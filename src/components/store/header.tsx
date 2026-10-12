import Link from "next/link";
import { Truck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AccountMenu, CartButton, HeaderSearch, MobileNav, NavLinks, WishlistLink } from "@/components/store/header-client";
import { getCategories } from "@/lib/data/catalog";
import { getPublicSettings } from "@/lib/data/content";
import { formatINR } from "@/lib/money";

export async function SiteHeader() {
  const [settings, categories] = await Promise.all([getPublicSettings(), getCategories()]);
  const nav = categories.filter((c) => !c.parentId && c.productCount > 0).map((c) => ({ name: c.name, slug: c.slug, description: c.description }));
  const threshold = settings.shipping.freeShippingThreshold;
  const announcement =
    settings.announcement.enabled && (settings.announcement.text || threshold !== null)
      ? settings.announcement.text || `Free standard delivery on orders above ${formatINR(threshold!)}`
      : null;

  return (
    <>
      {announcement ? (
        <div className="bg-brand-green text-white">
          <div className="container-page flex h-9 items-center justify-center gap-2 text-center text-xs font-medium sm:text-[13px]">
            <Truck className="size-4 shrink-0 text-brand-teal-light" aria-hidden />
            {settings.announcement.href ? (
              <Link href={settings.announcement.href} className="truncate hover:underline">
                {announcement}
              </Link>
            ) : (
              <span className="truncate">{announcement}</span>
            )}
          </div>
        </div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="container-page flex h-16 items-center gap-3 lg:h-[72px] lg:gap-6">
          <MobileNav categories={nav} />
          <Link href="/" className="shrink-0 rounded-lg" aria-label={`${settings.store.name} home`}>
            <Logo />
          </Link>
          <NavLinks categories={nav} />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <HeaderSearch />
            <WishlistLink />
            <AccountMenu />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}
