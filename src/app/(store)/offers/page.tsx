import type { Metadata } from "next";
import { BadgePercent, CalendarClock, Copy, Sparkles } from "lucide-react";
import { CombosAndKits } from "@/components/store/home/combos";
import { PageHeader } from "@/components/store/page-header";
import { CopyCodeButton } from "@/components/store/copy-code-button";
import { parseShopQuery, searchProducts } from "@/lib/data/catalog";
import { getPublicSettings, getStorefrontOffers } from "@/lib/data/content";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Offers, coupons & combos",
  description: "Current Ovelia offers, coupon codes, combo deals and cleaning kits.",
  alternates: { canonical: "/offers" },
};

export default async function OffersPage() {
  const [offers, kits, settings] = await Promise.all([getStorefrontOffers(), searchProducts(parseShopQuery({}, "kits-combos")), getPublicSettings()]);
  const deals = offers.filter((o) => o.type !== "bundle");
  const threshold = settings.shipping.freeShippingThreshold;
  return (
    <>
      <PageHeader eyebrow="Save more" title="Offers & combos" description="Coupon codes, automatic savings and combo deals — all applied securely at checkout." breadcrumbs={[{ label: "Offers", href: "/offers" }]} />
      <div className="container-page py-12">
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {threshold !== null ? (
            <li className="flex flex-col gap-3 rounded-3xl border bg-white p-6">
              <Sparkles className="size-7 text-brand-teal" aria-hidden />
              <h2 className="font-heading text-lg font-bold">Free standard delivery</h2>
              <p className="text-sm text-muted-foreground">On every order of {formatINR(threshold)} or more after discounts. Applied automatically.</p>
            </li>
          ) : null}
          {deals.map((offer) => {
            const upcoming = offer.upcoming;
            return (
              <li key={offer.id} className="flex flex-col gap-3 rounded-3xl border bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <BadgePercent className="size-7 text-brand-teal" aria-hidden />
                  {upcoming ? (
                    <span className="rounded-full bg-brand-sky px-2.5 py-1 text-xs font-semibold text-brand-blue">Starts {formatDate(offer.startsAt)}</span>
                  ) : offer.isAutomatic ? (
                    <span className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-semibold text-brand-green">Auto-applied</span>
                  ) : null}
                </div>
                <h2 className="font-heading text-lg font-bold">{offer.name}</h2>
                <p className="flex-1 text-sm text-muted-foreground">{offer.description || offer.bannerText}</p>
                {offer.minSubtotal > 0 ? <p className="text-xs text-muted-foreground">Minimum order {formatINR(offer.minSubtotal)}</p> : null}
                {offer.endsAt ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden /> Valid until {formatDate(offer.endsAt)}
                  </p>
                ) : null}
                {offer.code ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-brand-teal/50 bg-brand-mint/40 px-3 py-2">
                    <span className="font-mono text-base font-bold tracking-wider text-brand-green">{offer.code}</span>
                    <CopyCodeButton code={offer.code} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {deals.length === 0 && threshold === null ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Copy className="size-4" /> No coupon offers right now — check back soon.
          </p>
        ) : null}
        <p className="mt-6 text-xs text-muted-foreground">
          Offers are subject to their conditions and validity. Where offers can&apos;t be combined, the best saving for your cart is applied automatically.
        </p>
      </div>
      <CombosAndKits offers={offers} kits={kits.items} />
    </>
  );
}
