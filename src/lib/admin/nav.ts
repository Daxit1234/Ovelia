import type { Permission } from "@/lib/domain/roles";

export type AdminNavIcon =
  | "dashboard"
  | "orders"
  | "returns"
  | "products"
  | "categories"
  | "inventory"
  | "customers"
  | "promotions"
  | "reviews"
  | "content"
  | "messages"
  | "newsletter"
  | "settings"
  | "staff"
  | "audit";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: AdminNavIcon;
  permission: Permission;
  badge?: "toFulfil" | "returns" | "reviews" | "messages";
}

export const ADMIN_NAV: { group: string; items: AdminNavItem[] }[] = [
  {
    group: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard:view" }],
  },
  {
    group: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders", permission: "orders:read", badge: "toFulfil" },
      { href: "/admin/returns", label: "Returns & refunds", icon: "returns", permission: "returns:manage", badge: "returns" },
      { href: "/admin/customers", label: "Customers", icon: "customers", permission: "customers:read" },
    ],
  },
  {
    group: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: "products", permission: "products:read" },
      { href: "/admin/categories", label: "Categories", icon: "categories", permission: "categories:write" },
      { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: "inventory:read" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/promotions", label: "Promotions", icon: "promotions", permission: "promotions:read" },
      { href: "/admin/reviews", label: "Reviews", icon: "reviews", permission: "reviews:moderate", badge: "reviews" },
      { href: "/admin/content", label: "Storefront content", icon: "content", permission: "content:write" },
      { href: "/admin/newsletter", label: "Newsletter", icon: "newsletter", permission: "newsletter:read" },
      { href: "/admin/messages", label: "Messages", icon: "messages", permission: "messages:read", badge: "messages" },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings:write" },
      { href: "/admin/staff", label: "Staff & roles", icon: "staff", permission: "staff:manage" },
      { href: "/admin/audit", label: "Audit log", icon: "audit", permission: "audit:read" },
    ],
  },
];
