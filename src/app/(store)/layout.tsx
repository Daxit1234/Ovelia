import type { ReactNode } from "react";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CartProvider } from "@/components/store/cart-context";
import { SiteFooter } from "@/components/store/footer";
import { SiteHeader } from "@/components/store/header";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand-green px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CartDrawer />
    </CartProvider>
  );
}
