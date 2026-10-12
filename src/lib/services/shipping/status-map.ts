import type { OrderStatus } from "@/lib/domain/order-status";

/**
 * Maps courier / aggregator status labels (e.g. Shiprocket "sr-status-label"
 * values) to Ovelia order statuses. Unknown or pre-pickup statuses map to
 * null so they never move an order on their own.
 */
const STATUS_PATTERNS: [RegExp, OrderStatus | null][] = [
  [/^RTO[ _-]?DELIVERED$/, "rto_delivered"],
  [/^RTO/, "rto_initiated"],
  [/^DELIVERED$/, "delivered"],
  [/OUT FOR DELIVERY|^OFD$/, "out_for_delivery"],
  [/UNDELIVERED|DELIVERY FAILED|FAILED DELIVERY|NDR/, "delivery_failed"],
  [/PICKED UP|IN TRANSIT|SHIPPED|REACHED|DESTINATION HUB|ORIGIN HUB|MISROUTED|DELAYED/, "shipped"],
  [/CANCEL|LOST|DAMAGED|DESTROYED|PICKUP|AWB ASSIGNED|LABEL|MANIFEST|NEW|PENDING/, null],
];

export function mapCarrierStatus(raw: string | null | undefined): OrderStatus | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, " ");
  for (const [pattern, status] of STATUS_PATTERNS) {
    if (pattern.test(normalized)) return status;
  }
  return null;
}

/** Statuses that need a human to look at the shipment. */
export function isExceptionStatus(raw: string | null | undefined): boolean {
  return !!raw && /LOST|DAMAGED|DESTROYED|CANCEL/i.test(raw);
}
