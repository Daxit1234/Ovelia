"use server";

import { z } from "zod";
import { actorFrom, authorize } from "@/lib/auth/session";
import { connectDB, ContactMessage } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";

const schema = z.object({ status: z.enum(["new", "in_progress", "resolved"]), notes: z.string().trim().max(2000) });

const LABELS = { new: "New", in_progress: "In progress", resolved: "Resolved" } as const;

export async function updateMessageAction(messageId: string, input: z.input<typeof schema>): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input);
  if (!isObjectId(messageId) || !parsed.success) return fail("Invalid request");
  try {
    const user = await authorize("messages:read");
    await connectDB();
    const before = await ContactMessage.findByIdAndUpdate(toObjectId(messageId), { $set: parsed.data }).lean();
    if (!before) return fail("Message not found");
    if (before.status !== parsed.data.status) {
      await audit({ actor: actorFrom(user), action: "message.status", entityType: "message", entityId: messageId, summary: `Marked message “${before.subject}” as ${LABELS[parsed.data.status].toLowerCase()}` });
    }
    return ok(null, "Saved");
  } catch (error) {
    return toActionError(error);
  }
}
