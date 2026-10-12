import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AccountNav } from "@/components/store/account/account-nav";

export const metadata: Metadata = { title: { default: "My account", template: "%s | My account" }, robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/30">
      <div className="container-page grid gap-8 py-8 sm:py-10 lg:grid-cols-[230px_1fr]">
        <Suspense fallback={<div className="h-14 rounded-2xl border bg-white lg:h-64" aria-hidden />}>
          <AccountNav />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
