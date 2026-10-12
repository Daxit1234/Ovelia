"use server";

import { updateTag } from "next/cache";
import { authorize } from "@/lib/auth/session";
import { TAGS } from "@/lib/cache-tags";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import { adjustStock } from "@/lib/services/inventory";
import { stockAdjustmentSchema } from "@/lib/validation/product";
import type { z } from "zod";

export async function adjustStockAction(input: z.input<typeof stockAdjustmentSchema>): Promise<ActionResult<{ stock: number }>> {
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid adjustment");
  try {
    const user = await authorize("inventory:adjust");
    const variant = await adjustStock({
      ...parsed.data,
      actor: { id: user.id, name: user.name, email: user.email, type: "admin" },
    });
    updateTag(TAGS.catalog);
    updateTag(TAGS.product(parsed.data.productId));
    await audit({
      actor: { id: user.id, name: user.name, email: user.email, role: user.role },
      action: "inventory.adjust",
      entityType: "variant",
      entityId: parsed.data.variantId,
      summary: `${variant.sku}: ${parsed.data.mode} ${parsed.data.quantity} (${parsed.data.reason}) → ${variant.stock}`,
      changes: parsed.data,
    });
    return ok({ stock: variant.stock }, `Stock updated — ${variant.sku} now has ${variant.stock} available`);
  } catch (error) {
    return toActionError(error, "Could not adjust stock.");
  }
}
