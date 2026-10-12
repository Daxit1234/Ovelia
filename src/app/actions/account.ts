"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/lib/auth/auth";
import { requireSessionUser } from "@/lib/auth/session";
import { isObjectId } from "@/lib/db/model";
import { normalizeIndianMobile } from "@/lib/india";
import { fail, ok, toActionError, type ActionResult } from "@/lib/result";
import { deleteAddress, saveAddress, setDefaultAddress, type SavedAddress } from "@/lib/services/addresses";
import { savedAddressSchema } from "@/lib/validation/checkout";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
  marketingOptIn: z.boolean(),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult<null>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your details.");
  try {
    await requireSessionUser();
    const auth = await getAuth();
    await auth.api.updateUser({
      headers: await headers(),
      body: {
        name: parsed.data.name,
        phone: normalizeIndianMobile(parsed.data.phone),
        marketingOptIn: parsed.data.marketingOptIn,
      },
    });
    return ok(null, "Profile updated");
  } catch (error) {
    return toActionError(error, "Could not update your profile.");
  }
}

export async function saveAddressAction(input: z.input<typeof savedAddressSchema>, addressId?: string): Promise<ActionResult<SavedAddress>> {
  const parsed = savedAddressSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  if (addressId && !isObjectId(addressId)) return fail("Address not found");
  try {
    const user = await requireSessionUser();
    return ok(await saveAddress(user.id, parsed.data, addressId), "Address saved");
  } catch (error) {
    return toActionError(error, "Could not save the address.");
  }
}

export async function deleteAddressAction(addressId: string): Promise<ActionResult<null>> {
  if (!isObjectId(addressId)) return fail("Address not found");
  try {
    const user = await requireSessionUser();
    await deleteAddress(user.id, addressId);
    return ok(null, "Address removed");
  } catch (error) {
    return toActionError(error);
  }
}

export async function setDefaultAddressAction(addressId: string): Promise<ActionResult<null>> {
  if (!isObjectId(addressId)) return fail("Address not found");
  try {
    const user = await requireSessionUser();
    await setDefaultAddress(user.id, addressId);
    return ok(null, "Default address updated");
  } catch (error) {
    return toActionError(error);
  }
}
