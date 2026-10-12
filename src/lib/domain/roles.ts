export const STAFF_ROLES = [
  "super_admin",
  "product_manager",
  "order_manager",
  "marketing_manager",
  "support_agent",
] as const;

export const USER_ROLES = ["customer", ...STAFF_ROLES] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = "active" | "suspended";

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  super_admin: "Super Admin",
  product_manager: "Product Manager",
  order_manager: "Order Manager",
  marketing_manager: "Marketing Manager",
  support_agent: "Support Agent",
};

export const PERMISSIONS = [
  "dashboard:view",
  "products:read",
  "products:write",
  "products:delete",
  "products:import",
  "inventory:read",
  "inventory:adjust",
  "categories:write",
  "orders:read",
  "orders:update",
  "orders:refund",
  "orders:export",
  "returns:manage",
  "customers:read",
  "customers:manage",
  "customers:export",
  "promotions:read",
  "promotions:write",
  "content:write",
  "reviews:moderate",
  "messages:read",
  "newsletter:read",
  "newsletter:export",
  "settings:write",
  "staff:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  product_manager: [
    "dashboard:view",
    "products:read",
    "products:write",
    "products:delete",
    "products:import",
    "inventory:read",
    "inventory:adjust",
    "categories:write",
    "reviews:moderate",
  ],
  order_manager: [
    "dashboard:view",
    "orders:read",
    "orders:update",
    "orders:refund",
    "orders:export",
    "returns:manage",
    "customers:read",
    "products:read",
    "inventory:read",
  ],
  marketing_manager: [
    "dashboard:view",
    "promotions:read",
    "promotions:write",
    "content:write",
    "products:read",
    "reviews:moderate",
    "newsletter:read",
    "newsletter:export",
  ],
  support_agent: [
    "dashboard:view",
    "orders:read",
    "customers:read",
    "products:read",
    "messages:read",
    "returns:manage",
  ],
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function permissionsFor(role: string | null | undefined): readonly Permission[] {
  return isStaffRole(role) ? ROLE_PERMISSIONS[role] : [];
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
