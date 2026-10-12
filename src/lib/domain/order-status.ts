export const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "rto_initiated",
  "rto_delivered",
  "on_hold",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "partially_refunded",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["razorpay", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delivery_failed: "Delivery attempt failed",
  rto_initiated: "Returning to seller",
  rto_delivered: "Returned to seller",
  on_hold: "On hold",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorized",
  paid: "Paid",
  failed: "Failed",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: "Online (UPI / Cards / Net banking / Wallets)",
  cod: "Cash on Delivery",
};

/**
 * Fulfilment transitions an administrator may perform. Payment-driven
 * transitions (pending_payment -> confirmed) are performed by the system only
 * after a verified payment, never manually.
 */
const ADMIN_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["cancelled"],
  confirmed: ["processing", "packed", "on_hold", "cancelled"],
  processing: ["packed", "on_hold", "cancelled"],
  packed: ["shipped", "processing", "on_hold", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "delivery_failed", "rto_initiated"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivery_failed: ["out_for_delivery", "shipped", "rto_initiated"],
  rto_initiated: ["rto_delivered"],
  rto_delivered: [],
  on_hold: ["confirmed", "processing", "cancelled"],
  delivered: [],
  cancelled: [],
  returned: [],
};

/** Transitions shipping providers may apply through tracking webhooks. */
const CARRIER_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  packed: ["shipped", "out_for_delivery", "delivered", "delivery_failed", "rto_initiated"],
  shipped: ["out_for_delivery", "delivered", "delivery_failed", "rto_initiated"],
  out_for_delivery: ["delivered", "delivery_failed", "rto_initiated"],
  delivery_failed: ["out_for_delivery", "delivered", "rto_initiated"],
  rto_initiated: ["rto_delivered"],
};

export function allowedAdminTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ADMIN_TRANSITIONS[from] ?? [];
}

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedAdminTransitions(from).includes(to);
}

export function canCarrierTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (CARRIER_TRANSITIONS[from] ?? []).includes(to);
}

/** Statuses after which goods have left the warehouse. */
export const DISPATCHED_STATUSES: readonly OrderStatus[] = [
  "shipped",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "rto_initiated",
  "rto_delivered",
  "returned",
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["cancelled", "returned", "rto_delivered"];

/** Orders counted as real sales in reports. */
export const REVENUE_STATUSES: readonly OrderStatus[] = [
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "on_hold",
];

/** Customer-facing progress steps for the tracking timeline. */
export const TRACKING_STEPS: readonly { status: OrderStatus; label: string }[] = [
  { status: "confirmed", label: "Order confirmed" },
  { status: "packed", label: "Packed" },
  { status: "shipped", label: "Shipped" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

const STEP_RANK: Partial<Record<OrderStatus, number>> = {
  pending_payment: -1,
  confirmed: 0,
  processing: 0,
  on_hold: 0,
  packed: 1,
  shipped: 2,
  delivery_failed: 2,
  out_for_delivery: 3,
  delivered: 4,
};

export function trackingStepIndex(status: OrderStatus): number {
  return STEP_RANK[status] ?? -1;
}
