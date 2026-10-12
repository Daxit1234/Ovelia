"use server";

import { z } from "zod";
import { actorFrom, authorize } from "@/lib/auth/session";
import { addStaff, changeStaffRole, setStaffStatus } from "@/lib/admin/staff";
import { isObjectId } from "@/lib/db/model";
import { ROLE_LABELS, STAFF_ROLES, USER_ROLES } from "@/lib/domain/roles";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";

const addSchema = z.object({ email: z.email("Enter the email of their account").max(200), role: z.enum(STAFF_ROLES) });

export async function addStaffAction(input: z.input<typeof addSchema>): Promise<ActionResult<null>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  try {
    const user = await authorize("staff:manage");
    const added = await addStaff(parsed.data.email, parsed.data.role);
    await audit({ actor: actorFrom(user), action: "staff.add", entityType: "user", entityId: added._id.toHexString(), summary: `Added ${added.email} as ${ROLE_LABELS[parsed.data.role]}` });
    return ok(null, `${added.name} added as ${ROLE_LABELS[parsed.data.role]}`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function changeStaffRoleAction(userId: string, role: string): Promise<ActionResult<null>> {
  if (!isObjectId(userId) || !(USER_ROLES as readonly string[]).includes(role)) return fail("Invalid request");
  try {
    const user = await authorize("staff:manage");
    const { before, after } = await changeStaffRole(userId, role as (typeof USER_ROLES)[number], user.id);
    if (before.role !== after.role) {
      await audit({
        actor: actorFrom(user),
        action: after.role === "customer" ? "staff.remove" : "staff.role",
        entityType: "user",
        entityId: userId,
        summary: after.role === "customer" ? `Removed staff access for ${after.email}` : `Changed ${after.email} from ${ROLE_LABELS[before.role]} to ${ROLE_LABELS[after.role]}`,
        changes: { role: { from: before.role, to: after.role } },
      });
    }
    return ok(null, after.role === "customer" ? "Staff access removed" : `Role changed to ${ROLE_LABELS[after.role]}`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setStaffStatusAction(userId: string, status: "active" | "suspended"): Promise<ActionResult<null>> {
  if (!isObjectId(userId) || !["active", "suspended"].includes(status)) return fail("Invalid request");
  try {
    const user = await authorize("staff:manage");
    const target = await setStaffStatus(userId, status, user.id);
    await audit({ actor: actorFrom(user), action: status === "suspended" ? "staff.suspend" : "staff.activate", entityType: "user", entityId: userId, summary: `${status === "suspended" ? "Suspended" : "Reactivated"} ${target.email}` });
    return ok(null, status === "suspended" ? "Suspended and signed out" : "Reactivated");
  } catch (error) {
    return toActionError(error);
  }
}
