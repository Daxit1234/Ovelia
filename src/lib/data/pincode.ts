import "server-only";
import { cacheLife } from "next/cache";
import { INDIAN_STATES, PINCODE_REGEX, type IndianStateName } from "@/lib/india";

export interface PincodeInfo {
  pincode: string;
  city: string;
  district: string;
  state: IndianStateName | null;
}

const ALIASES: Record<string, IndianStateName> = {
  "jammu & kashmir": "Jammu and Kashmir",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra & nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman & diu": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "the dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  pondicherry: "Puducherry",
  orissa: "Odisha",
  chattisgarh: "Chhattisgarh",
  uttaranchal: "Uttarakhand",
  "new delhi": "Delhi",
  "nct of delhi": "Delhi",
};

export function normalizeState(raw: string | undefined | null): IndianStateName | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (ALIASES[key]) return ALIASES[key];
  const normalized = key.replace(/&/g, "and");
  return INDIAN_STATES.find((s) => s.name.toLowerCase() === normalized)?.name ?? null;
}

/**
 * Looks up a PIN code with the public India Post API to autofill city and
 * state. Best effort only: returns null on any failure, and the customer can
 * always type the details manually.
 */
export async function lookupPincode(pincode: string): Promise<PincodeInfo | null> {
  "use cache";
  cacheLife("weeks");
  if (!PINCODE_REGEX.test(pincode) || process.env.PINCODE_LOOKUP === "off") return null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { Status?: string; PostOffice?: { District?: string; State?: string; Block?: string; Name?: string }[] | null }[];
    const office = body?.[0]?.Status === "Success" ? body[0].PostOffice?.[0] : undefined;
    if (!office) return null;
    return {
      pincode,
      city: office.District ?? office.Block ?? "",
      district: office.District ?? "",
      state: normalizeState(office.State),
    };
  } catch {
    return null;
  }
}
