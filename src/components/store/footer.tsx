import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { TAGS } from "@/lib/cache-tags";
import { getCategories } from "@/lib/data/catalog";
import { getPublicSettings } from "@/lib/data/content";
import { formatIndianMobile } from "@/lib/india";

function Placeholder({ children }: { children: string }) {
  return (
    <span className="text-white/50 italic" title="Add this in Admin → Settings → Store details">
      [{children}]
    </span>
  );
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
};

export async function SiteFooter() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings, TAGS.categories);
  const [settings, categories] = await Promise.all([getPublicSettings(), getCategories()]);
  const store = settings.store;
  const address = [store.address.line1, store.address.line2, store.address.city, store.address.state, store.address.pincode].filter(Boolean).join(", ");
  const socials = Object.entries(store.social).filter(([, url]) => url);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-brand-green-dark text-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div className="space-y-5">
          <Logo tone="light" showTagline />
          <p className="max-w-xs text-sm leading-6 text-white/70">{store.tagline}. Everyday cleaning essentials for Indian homes and cars.</p>
          <ul className="space-y-2.5 text-sm text-white/80">
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand-teal-light" aria-hidden />
              {store.supportEmail ? (
                <a href={`mailto:${store.supportEmail}`} className="hover:text-white">
                  {store.supportEmail}
                </a>
              ) : (
                <Placeholder>Support email</Placeholder>
              )}
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-brand-teal-light" aria-hidden />
              {store.supportPhone ? (
                <a href={`tel:${store.supportPhone.replace(/\s/g, "")}`} className="hover:text-white">
                  {formatIndianMobile(store.supportPhone)}
                </a>
              ) : (
                <Placeholder>Support phone</Placeholder>
              )}
            </li>
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-teal-light" aria-hidden />
              {address ? <span>{address}</span> : <Placeholder>Business address</Placeholder>}
            </li>
          </ul>
          {store.businessHours ? <p className="text-xs text-white/60">Support hours: {store.businessHours}</p> : null}
        </div>

        <nav aria-label="Shop">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-white/60 uppercase">Shop</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/shop" className="text-white/85 hover:text-white">
                All products
              </Link>
            </li>
            {categories
              .filter((c) => c.productCount > 0)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="text-white/85 hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
            <li>
              <Link href="/offers" className="text-white/85 hover:text-white">
                Offers &amp; combos
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Help">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-white/60 uppercase">Help</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["/track-order", "Track your order"],
              ["/faq", "FAQs"],
              ["/contact", "Contact us"],
              ["/policies/shipping", "Shipping policy"],
              ["/policies/returns", "Returns & refunds"],
              ["/policies/privacy", "Privacy policy"],
              ["/policies/terms", "Terms & conditions"],
              ["/about", "About Ovelia"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-white/85 hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-white/60 uppercase">Stay in the loop</h2>
          <p className="text-sm text-white/70">Offers, new launches and cleaning tips. Unsubscribe any time.</p>
          <NewsletterForm tone="dark" source="footer" />
          {socials.length ? (
            <ul className="flex flex-wrap gap-2 pt-2">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/85 hover:border-white/50 hover:text-white">
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {store.legalName || store.name}. All rights reserved.
            {store.gstin ? <span className="ml-2">GSTIN: {store.gstin}</span> : null}
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-brand-teal-light" aria-hidden />
            Secure payments by Razorpay · UPI · Cards · Net banking · Wallets{settings.payments.codEnabled ? " · Cash on Delivery" : ""}
          </p>
        </div>
      </div>
    </footer>
  );
}
