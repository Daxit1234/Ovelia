import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressBook } from "@/components/store/account/address-book";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listAddresses } from "@/lib/services/addresses";

export const metadata: Metadata = { title: "Addresses" };

async function Addresses() {
  const user = await requireUser("/account/addresses");
  return <AddressBook addresses={await listAddresses(user.id)} />;
}

export default function AddressesPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink">Saved addresses</h1>
      <Suspense fallback={<Skeleton className="h-56 w-full rounded-3xl" />}>
        <Addresses />
      </Suspense>
    </div>
  );
}
