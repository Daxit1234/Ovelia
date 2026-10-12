import "server-only";
import { PINCODE_REGEX } from "@/lib/india";
import { manualProvider } from "@/lib/services/shipping/manual";
import { shiprocketProvider } from "@/lib/services/shipping/shiprocket";
import type { ServiceabilityResult, ShippingProvider } from "@/lib/services/shipping/types";
import type { StoreSettings } from "@/lib/validation/settings";

export type { ServiceabilityResult, ShippingProvider } from "@/lib/services/shipping/types";

export function getShippingProvider(settings: StoreSettings): ShippingProvider {
  if (settings.shipping.provider === "shiprocket" && shiprocketProvider.isConfigured()) return shiprocketProvider;
  return manualProvider;
}

export function bookingProvider(settings: StoreSettings): ShippingProvider | null {
  const provider = getShippingProvider(settings);
  return provider.createShipment ? provider : null;
}

/**
 * Checks whether we can deliver to a PIN code. Store-level blocks always
 * apply; provider checks fail open (with `unverified`) if the provider is
 * unreachable so that a courier API outage never blocks all sales.
 */
export async function checkServiceability(
  pincode: string,
  options: { cod: boolean; weightGrams?: number; declaredValue?: number; settings: StoreSettings },
): Promise<ServiceabilityResult> {
  if (!PINCODE_REGEX.test(pincode)) {
    return { serviceable: false, codAvailable: false, message: "Enter a valid 6-digit PIN code.", estimatedDays: null };
  }
  const { settings } = options;
  if (settings.shipping.blockedPincodes.includes(pincode)) {
    return { serviceable: false, codAvailable: false, message: "Sorry, we do not deliver to this PIN code yet.", estimatedDays: null };
  }
  const provider = getShippingProvider(settings);
  if (provider.id === "manual" || !settings.shipping.originPincode) {
    return { serviceable: true, codAvailable: settings.payments.codEnabled, message: null, estimatedDays: null };
  }
  try {
    const result = await provider.checkServiceability({
      deliveryPincode: pincode,
      pickupPincode: settings.shipping.originPincode,
      weightGrams: options.weightGrams ?? settings.shipping.defaultPackageWeightGrams,
      cod: options.cod,
      declaredValue: options.declaredValue ?? 0,
    });
    return { ...result, codAvailable: result.codAvailable && settings.payments.codEnabled };
  } catch (error) {
    console.error("Serviceability check failed; allowing order", error);
    return { serviceable: true, codAvailable: settings.payments.codEnabled, message: null, estimatedDays: null, unverified: true };
  }
}
