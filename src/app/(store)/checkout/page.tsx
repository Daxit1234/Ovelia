import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { CheckoutClient } from "@/components/store/checkout/checkout-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicSettings } from "@/lib/data/content";
import { listAddresses } from "@/lib/services/addresses";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

async function CheckoutLoader() {
  const [user, settings] = await Promise.all([getSessionUser(), getPublicSettings()]);
  if (!user && !settings.orders.guestCheckoutEnabled) redirect("/login?next=/checkout");
  const addresses = user ? await listAddresses(user.id) : [];
  return <CheckoutClient user={user ? { name: user.name, email: user.email, phone: user.phone } : null} addresses={addresses} settings={settings} />;
}

export default function CheckoutPage() {
  return (
    <div className="bg-muted/30">
      <div className="container-page py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl">Checkout</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-4 text-brand-teal" aria-hidden /> Secure, encrypted checkout
          </p>
        </div>
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-[1fr_400px]" aria-busy="true">
              <div className="space-y-5">
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-96 rounded-3xl" />
              </div>
              <Skeleton className="h-96 rounded-3xl" />
            </div>
          }
        >
          <CheckoutLoader />
        </Suspense>
      </div>
    </div>
  );
}
