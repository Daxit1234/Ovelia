import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChangePasswordForm, ProfileForm } from "@/components/store/account/profile-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { connectDB, User } from "@/lib/db";
import { toObjectId } from "@/lib/db/model";
import { listCustomerOrders } from "@/lib/data/orders";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Profile" };

async function Profile() {
  const user = await requireUser("/account");
  await connectDB();
  const [doc, recent] = await Promise.all([User.findById(toObjectId(user.id), { marketingOptIn: 1, createdAt: 1 }).lean(), listCustomerOrders(user.id, 1, 3)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink">Hello, {user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Member since {formatDate(doc?.createdAt ?? new Date())}</p>
      </div>

      {recent.orders.length ? (
        <section className="rounded-3xl border bg-white p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold">Recent orders</h2>
            <Link href="/account/orders" className="text-sm font-semibold text-brand-green hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y">
            {recent.orders.map((o) => (
              <li key={o.orderNumber}>
                <Link href={`/account/orders/${o.orderNumber}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-brand-green">
                  <span className="font-semibold">{o.orderNumber}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(o.placedAt)}</span>
                  <span className="text-sm">{o.statusLabel}</span>
                  <span className="font-semibold">{formatINR(o.grandTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="mb-5 font-heading text-lg font-bold">Personal details</h2>
        <ProfileForm
          initial={{ name: user.name, phone: user.phone ?? "", marketingOptIn: Boolean(doc?.marketingOptIn) }}
          email={user.email}
          emailVerified={user.emailVerified}
        />
      </section>

      <section className="rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="mb-5 font-heading text-lg font-bold">Password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
      <Profile />
    </Suspense>
  );
}
