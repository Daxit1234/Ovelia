import type { Metadata } from "next";
import { Check } from "lucide-react";
import { setStaffStatusAction } from "@/app/admin/staff/actions";
import { ActionButton } from "@/components/admin/action-button";
import { AddStaffDialog, RoleSelect } from "@/components/admin/staff/staff-controls";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { listStaff } from "@/lib/admin/staff";
import { PERMISSIONS, permissionsFor, ROLE_LABELS, STAFF_ROLES, type Permission, type StaffRole } from "@/lib/domain/roles";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Staff & roles" };

const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard:view": "View dashboard",
  "products:read": "View products",
  "products:write": "Create and edit products",
  "products:delete": "Delete products",
  "products:import": "Import / export products",
  "inventory:read": "View inventory",
  "inventory:adjust": "Adjust stock",
  "categories:write": "Manage categories",
  "orders:read": "View orders",
  "orders:update": "Update and fulfil orders",
  "orders:refund": "Approve refunds",
  "orders:export": "Export orders",
  "returns:manage": "Handle returns",
  "customers:read": "View customers",
  "customers:manage": "Suspend customers",
  "customers:export": "Export customers",
  "promotions:read": "View promotions",
  "promotions:write": "Manage promotions",
  "content:write": "Edit storefront content",
  "reviews:moderate": "Moderate reviews",
  "messages:read": "Read contact messages",
  "newsletter:read": "View newsletter subscribers",
  "newsletter:export": "Export newsletter subscribers",
  "settings:write": "Change store settings",
  "staff:manage": "Manage staff",
  "audit:read": "View audit log",
};

export default async function StaffPage() {
  const me = await requireStaffPage("staff:manage", "/admin/staff");
  const staff = await listStaff();

  return (
    <>
      <AdminPageHeader title="Staff & roles" description="Who can use the admin, and what each role can do. Permissions are enforced on the server for every page and action." actions={<AddStaffDialog />} />
      <Panel title="Team" className="mb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => {
              const id = s._id.toHexString();
              const isMe = id === me.id;
              return (
                <TableRow key={id}>
                  <TableCell>
                    <span className="font-medium text-brand-ink">
                      {s.name}
                      {isMe ? <span className="text-muted-foreground"> (you)</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">{s.email}</span>
                  </TableCell>
                  <TableCell>{isMe ? <Badge variant="outline">{ROLE_LABELS[s.role]}</Badge> : <RoleSelect userId={id} role={s.role as StaffRole} name={s.name} />}</TableCell>
                  <TableCell className="text-sm">{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "Never"}</TableCell>
                  <TableCell>{s.status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="outline">Active</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {isMe ? null : s.status === "suspended" ? (
                      <ActionButton variant="ghost" action={setStaffStatusAction.bind(null, id, "active")}>
                        Reactivate
                      </ActionButton>
                    ) : (
                      <ActionButton
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        action={setStaffStatusAction.bind(null, id, "suspended")}
                        confirm={{ title: `Suspend ${s.name}?`, description: "They are signed out everywhere and can't sign in until reactivated." }}
                        confirmLabel="Suspend"
                      >
                        Suspend
                      </ActionButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="What each role can do">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                {STAFF_ROLES.map((r) => (
                  <TableHead key={r} className="text-center">
                    {ROLE_LABELS[r]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((p) => (
                <TableRow key={p}>
                  <TableCell className="text-sm">{PERMISSION_LABELS[p]}</TableCell>
                  {STAFF_ROLES.map((r) => (
                    <TableCell key={r} className="text-center">
                      {permissionsFor(r).includes(p) ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Allowed" /> : <span className="text-muted-foreground" aria-label="Not allowed">–</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
