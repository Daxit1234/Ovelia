"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileClock,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Percent,
  RotateCcw,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Tags,
  Users,
  Warehouse,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAV, type AdminNavIcon } from "@/lib/admin/nav";
import { authClient } from "@/lib/auth/client";
import type { Permission } from "@/lib/domain/roles";

const ICONS: Record<AdminNavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  returns: RotateCcw,
  products: Package,
  categories: Tags,
  inventory: Warehouse,
  customers: Users,
  promotions: Percent,
  reviews: Star,
  content: Images,
  messages: MessageSquare,
  newsletter: Mail,
  settings: Settings,
  staff: ShieldCheck,
  audit: FileClock,
};

export function AdminSidebar({
  user,
  permissions,
  counts,
}: {
  user: { name: string; email: string; roleLabel: string };
  permissions: Permission[];
  counts: Record<"toFulfil" | "returns" | "reviews" | "messages", number>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const allowed = new Set(permissions);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link href="/admin" className="flex items-center gap-2 px-2 py-1.5" onClick={() => setOpenMobile(false)}>
          <Logo className="group-data-[collapsible=icon]:hidden" />
          <BarChart3 className="hidden size-5 text-brand-green group-data-[collapsible=icon]:block" aria-hidden />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {ADMIN_NAV.map((group) => {
          const items = group.items.filter((item) => allowed.has(item.permission));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.group}>
              <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                    const badge = item.badge ? counts[item.badge] : 0;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link href={item.href} onClick={() => setOpenMobile(false)}>
                            <Icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {badge > 0 ? <SidebarMenuBadge className="rounded-full bg-brand-teal text-white">{badge > 99 ? "99+" : badge}</SidebarMenuBadge> : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View store">
              <Link href="/" target="_blank">
                <Store className="size-4" />
                <span>View store</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pb-1 text-xs group-data-[collapsible=icon]:hidden">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-muted-foreground">{user.roleLabel}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
