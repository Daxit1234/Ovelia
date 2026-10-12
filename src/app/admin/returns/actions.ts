"use server";

import { z } from "zod";
import { actorFrom, authorize } from "@/lib/auth/session";
import { isObjectId } from "@/lib/db/model";
import { RETURN_STATUS_LABELS } from "@/lib/domain/returns";
import { hasPermission } from "@/lib/domain/roles";
import { formatINR, toPaise } from "@/lib/money";
import { AuthorizationError, fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import { updateReturnRequest } from "@/lib/services/returns";

const schema = z
  .object({
    action: z.enum(["approve", "reject", "receive", "refund", "close"]),
    note: z.string().trim().max(500),
    restock: z.boolean().optional(),
    /** Rupees; only for refunds. */
    refundAmount: z.number().positive().max(10_000_000).optional(),
  })
  .refine((v) => v.action !== "reject" || v.note.length >= 3, { message: "Tell the customer why the return was rejected.", path: ["note"] });

const PAST: Record<z.infer<typeof schema>["action"], string> = {
  approve: "approved",
  reject: "rejected",
  receive: "marked as received",
  refund: "refunded",
  close: "closed",
};

export async function updateReturnAction(returnId: string, input: z.input<typeof schema>): Promise<ActionResult<null>> {
  if (!isObjectId(returnId)) return fail("Return not found");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request");
  const { action, note, restock, refundAmount } = parsed.data;
  try {
    const user = await authorize("returns:manage");
    // Sending money back needs refund rights as well as returns access.
    if (action === "refund" && !hasPermission(user.role, "orders:refund")) throw new AuthorizationError("Only staff with refund permission can refund a return.");
    const amount = refundAmount !== undefined ? toPaise(refundAmount) : undefined;
    await updateReturnRequest(returnId, action, { note, restock, refundAmount: amount }, { id: user.id, name: user.name, type: "admin", email: user.email });
    await audit({
      actor: actorFrom(user),
      action: `return.${action}`,
      entityType: "return",
      entityId: returnId,
      summary: `Return ${PAST[action]}${amount ? ` (${formatINR(amount)})` : ""}${note ? `: ${note}` : ""}`,
      changes: { action, note, restock: restock ?? null, refundAmount: amount ?? null },
    });
    return ok(null, `Return ${PAST[action]}`);
  } catch (error) {
    return toActionError(error, `Could not update the return. It may already be ${RETURN_STATUS_LABELS.closed.toLowerCase()} or changed by someone else.`);
  }
}
