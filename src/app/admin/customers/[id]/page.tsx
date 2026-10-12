import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setCustomerStatusAction } from "@/app/admin/customers/actions";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, KeyValue, OrderStatusBadge, Panel, PaymentStatusBadge, StatCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { getCustomer } from "@/lib/admin/customers";
import { hasPermission } from "@/lib/domain/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const staff = await requireStaffPage("customers:read", `/admin/customers/${id}`);
  const data = await getCustomer(id);
  if (!data) notFound();
  const { user, addresses, orders, stats } = data;
  const canManage = hasPermission(staff.role, "customers:manage");
  const canOrders = hasPermission(staff.role, "orders:read");
  const suspended = user.status === "suspended";

  return (
    <>
      <AdminPageHeader
        title={user.name}
        description={`Customer since ${formatDate(user.createdAt)}`}
        back={{ href: "/admin/customers", label: "Customers" }}
        actions={
          canManage ? (
            suspended ? (
              <ActionButton action={setCustomerStatusAction.bind(null, id, "active")} variant="outline" confirm={{ title: `Reactivate ${user.name}?`, description: "They will be able to sign in and place orders again." }} confirmLabel="Reactivate">
                Reactivate account
              </ActionButton>
            ) : (
              <ActionButton
                action={setCustomerStatusAction.bind(null, id, "suspended")}
                variant="destructive"
                confirm={{ title: `Suspend ${user.name}?`, description: "They are signed out everywhere and can't sign in until reactivated. Their orders and data are kept." }}
                confirmLabel="Suspend"
              >
                Suspend account
              </ActionButton>
            )
          ) : null
        }
      />
      {suspended ? <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">This account is suspended. The customer cannot sign in.</p> : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders" value={stats.orders} hint={data.guestOrders ? `+${data.guestOrders} guest order${data.guestOrders === 1 ? "" : "s"} with this email` : undefined} />
        <StatCard label="Net spent" value={formatINR(stats.spent)} />
        <StatCard label="Average order" value={formatINR(stats.orders ? Math.round(stats.spent / stats.orders) : 0)} />
        <StatCard label="Last order" value={stats.lastOrderAt ? formatDate(stats.lastOrderAt) : "—"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Orders" description={orders.length === 20 ? "Latest 20" : undefined} className="min-w-0">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o._id.toHexString()}>
                    <TableCell>
                      {canOrders ? (
                        <Link href={`/admin/orders/${o._id.toHexString()}`} className="font-semibold text-brand-green hover:underline">
                          {o.orderNumber}
                        </Link>
                      ) : (
                        o.orderNumber
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateTime(o.placedAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.items.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatINR(o.pricing.grandTotal)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={o.paymentStatus} method={o.paymentMethod} />
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Contact">
            <KeyValue
              items={[
                { label: "Email", value: <a href={`mailto:${user.email}`} className="text-brand-green hover:underline">{user.email}</a> },
                { label: "Email verified", value: user.emailVerified ? "Yes" : "No" },
                { label: "Phone", value: user.phone || "—" },
                { label: "Newsletter", value: data.newsletter === "subscribed" ? "Subscribed" : data.newsletter === "unsubscribed" ? "Unsubscribed" : "Not subscribed" },
                { label: "Last sign-in", value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—" },
                { label: "Wishlist", value: `${data.wishlistCount} item${data.wishlistCount === 1 ? "" : "s"}` },
                { label: "Reviews", value: data.reviews },
              ]}
            />
          </Panel>
          <Panel title="Saved addresses">
            {addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {addresses.map((a) => (
                  <li key={a._id.toHexString()} className="rounded-xl border p-3">
                    <p className="flex items-center gap-2 font-medium text-brand-ink">
                      {a.fullName} <Badge variant="outline" className="capitalize">{a.label}</Badge>
                      {a.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    </p>
                    <p className="text-muted-foreground">
                      {[a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-muted-foreground">{a.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
