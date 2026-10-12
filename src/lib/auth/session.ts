import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuth } from "@/lib/auth/auth";
import { hasPermission, isStaffRole, type Permission, type StaffRole, type UserRole } from "@/lib/domain/roles";
import { AuthorizationError } from "@/lib/result";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  phone: string | null;
  image: string | null;
}

export interface StaffUser extends SessionUser {
  role: StaffRole;
}

/**
 * Current signed-in user for this request (deduplicated with React.cache).
 * Suspended accounts are treated as signed out.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Session checks compare expiry times with the clock, so they must only
  // run for real requests, never during prerendering or prefetch renders.
  await connection();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user as typeof session.user & {
    role?: string | null;
    status?: string | null;
    phone?: string | null;
  };
  if (user.status === "suspended") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    role: (user.role as UserRole) ?? "customer",
    phone: user.phone ?? null,
    image: user.image ?? null,
  };
});

/** For pages: redirects to the login page when signed out. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

/** For admin pages: signed-in staff with the given permission, otherwise redirect/404. */
export async function requireStaffPage(permission: Permission = "dashboard:view", nextPath = "/admin"): Promise<StaffUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!isStaffRole(user.role)) notFound();
  if (!hasPermission(user.role, permission)) redirect("/admin/forbidden");
  return user as StaffUser;
}

/** For Server Actions and Route Handlers: throws instead of redirecting. */
export async function authorize(permission: Permission): Promise<StaffUser> {
  const user = await getSessionUser();
  if (!user || !isStaffRole(user.role) || !hasPermission(user.role, permission)) {
    throw new AuthorizationError();
  }
  return user as StaffUser;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Please sign in to continue.");
  return user;
}

export function actorFrom(user: SessionUser | null): { id: string | null; name: string; email: string | null; role: string | null } {
  if (!user) return { id: null, name: "System", email: null, role: null };
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
