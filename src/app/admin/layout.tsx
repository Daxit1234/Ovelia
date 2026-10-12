import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireStaffPage } from "@/lib/auth/session";
import { ContactMessage, connectDB, Order, Refund, ReturnRequest, Review } from "@/lib/db";
import { permissionsFor, ROLE_LABELS } from "@/lib/domain/roles";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Ovelia Admin" },
  robots: { index: false, follow: false },
};

// The admin is fully request-specific; let it render on demand.
export const instant = false;

async function badgeCounts() {
  await connectDB();
  const [toFulfil, returns, refunds, reviews, messages] = await Promise.all([
    Order.countDocuments({ status: { $in: ["confirmed", "processing", "on_hold"] } }),
    ReturnRequest.countDocuments({ status: "requested" }),
    Refund.countDocuments({ status: "pending_approval" }),
    Review.countDocuments({ status: "pending" }),
    ContactMessage.countDocuments({ status: "new" }),
  ]);
  return { toFulfil, returns: returns + refunds, reviews, messages };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireStaffPage("dashboard:view", "/admin");
  const counts = await badgeCounts();
  return (
    <SidebarProvider>
      <AdminSidebar user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }} permissions={[...permissionsFor(user.role)]} counts={counts} />
      <SidebarInset className="bg-muted/30">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white/90 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <p className="text-sm font-medium text-muted-foreground">Ovelia admin</p>
          <p className="ml-auto truncate text-sm text-muted-foreground">
            {user.name} · <span className="font-medium text-brand-green">{ROLE_LABELS[user.role]}</span>
          </p>
        </header>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
