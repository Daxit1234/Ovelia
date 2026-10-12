import type { ShippingProvider } from "@/lib/services/shipping/types";

/**
 * Manual fulfilment: staff book shipments with any courier and enter the
 * courier name and tracking number in the admin. Serviceability is governed
 * by the blocked PIN code list in settings.
 */
export const manualProvider: ShippingProvider = {
  id: "manual",
  label: "Manual courier entry",
  isConfigured: () => true,
  async checkServiceability({ cod }) {
    return { serviceable: true, codAvailable: cod, message: null, estimatedDays: null };
  },
};
