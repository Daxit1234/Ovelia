export const RETURN_REASONS = [
  "Damaged or leaking on arrival",
  "Wrong product or size received",
  "Product expired on arrival",
  "Missing items",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_STATUS_LABELS = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
  refunded: "Refunded",
  closed: "Closed",
} as const;
