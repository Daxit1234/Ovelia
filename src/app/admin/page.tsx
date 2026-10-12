import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/domain/roles";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

async function AdminHome() {
  const user = await requireStaffPage("dashboard:view", "/admin");
  return (
    <div className="space-y-4 rounded-3xl border bg-white p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Signed in as {user.name} · {ROLE_LABELS[user.role]}
      </p>
      <h1 className="font-heading text-2xl font-bold">Admin dashboard</h1>
      <p className="text-muted-foreground">The full admin dashboard (orders, products, inventory, promotions, customers, settings) is being added in the next update.</p>
      <Button asChild className="rounded-full">
        <Link href="/">Back to store</Link>
      </Button>
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="bg-hero grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
          <AdminHome />
        </Suspense>
      </div>
    </main>
  );
}
