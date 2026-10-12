"use server";

import { actorFrom, authorize } from "@/lib/auth/session";
import { isObjectId } from "@/lib/db/model";
import { setCustomerStatus } from "@/lib/admin/customers";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";

export async function setCustomerStatusAction(customerId: string, status: "active" | "suspended"): Promise<ActionResult<null>> {
  if (!isObjectId(customerId) || !["active", "suspended"].includes(status)) return fail("Invalid request");
  try {
    const user = await authorize("customers:manage");
    const customer = await setCustomerStatus(customerId, status);
    await audit({
      actor: actorFrom(user),
      action: status === "suspended" ? "customer.suspend" : "customer.activate",
      entityType: "customer",
      entityId: customerId,
      summary: `${status === "suspended" ? "Suspended" : "Reactivated"} customer ${customer.email}`,
    });
    return ok(null, status === "suspended" ? "Customer suspended and signed out" : "Customer reactivated");
  } catch (error) {
    return toActionError(error);
  }
}
