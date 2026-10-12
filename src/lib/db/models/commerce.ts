import { Schema, type Types } from "mongoose";
import { defineModel } from "@/lib/db/model";
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/domain/order-status";

/* ------------------------------------------------------------------ */
/* Cart                                                                */
/* ------------------------------------------------------------------ */

export interface CartItemDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  addedAt: Date;
}

export interface CartDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  /** SHA-256 of the guest cart cookie token (never the raw token). */
  guestTokenHash: string | null;
  items: CartItemDoc[];
  couponCode: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<CartDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    guestTokenHash: { type: String, default: null },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        variantId: { type: Schema.Types.ObjectId, required: true },
        quantity: { type: Number, required: true, min: 1, max: 99 },
        addedAt: { type: Date, default: () => new Date() },
      },
    ],
    couponCode: { type: String, default: null, uppercase: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

cartSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
cartSchema.index({ guestTokenHash: 1 }, { unique: true, partialFilterExpression: { guestTokenHash: { $type: "string" } } });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Cart = defineModel<CartDoc>("Cart", cartSchema);

/* ------------------------------------------------------------------ */
/* Order                                                               */
/* ------------------------------------------------------------------ */

export interface AddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

const addressSnapshotSchema = new Schema<AddressSnapshot>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    landmark: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" },
  },
  { _id: false },
);

export interface OrderItemDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string;
  productSlug: string;
  variantLabel: string;
  sku: string;
  image: string | null;
  hsnCode: string;
  quantity: number;
  unitMrp: number;
  unitPrice: number;
  lineSubtotal: number;
  discount: number;
  lineTotal: number;
  taxRate: number;
  taxableValue: number;
  taxAmount: number;
  returnedQuantity: number;
}

const orderItemSchema = new Schema<OrderItemDoc>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  productName: { type: String, required: true },
  productSlug: { type: String, required: true },
  variantLabel: { type: String, required: true },
  sku: { type: String, required: true },
  image: { type: String, default: null },
  hsnCode: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  unitMrp: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineSubtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0 },
  taxableValue: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, required: true, min: 0 },
  returnedQuantity: { type: Number, default: 0, min: 0 },
});

export interface StatusEvent {
  status: OrderStatus;
  note: string;
  at: Date;
  by: { id: string | null; name: string; type: "admin" | "customer" | "system" | "carrier" };
}

const actorSchema = new Schema(
  {
    id: { type: String, default: null },
    name: { type: String, default: "System" },
    type: { type: String, enum: ["admin", "customer", "system", "carrier"], default: "system" },
  },
  { _id: false },
);

export interface OrderDoc {
  _id: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId | null;
  isGuest: boolean;
  customer: { name: string; email: string; phone: string };
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  items: Types.DocumentArray<OrderItemDoc> | OrderItemDoc[];
  pricing: {
    currency: "INR";
    pricesIncludeTax: boolean;
    mrpTotal: number;
    subtotal: number;
    discountTotal: number;
    shippingFeeBeforeDiscount: number;
    shippingFee: number;
    codFee: number;
    taxTotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    interState: boolean;
    grandTotal: number;
    amountPaid: number;
    amountRefunded: number;
  };
  shippingMethod: { code: "standard" | "express"; label: string; eta: string };
  appliedPromotions: { promotionId: Types.ObjectId; name: string; code: string | null; type: string; amount: number; freeShipping: boolean }[];
  couponCode: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory: StatusEvent[];
  customerNote: string;
  internalNotes: { note: string; at: Date; by: { id: string | null; name: string; type: string } }[];
  razorpayOrderId: string | null;
  reservationId: Types.ObjectId | null;
  reservationExpiresAt: Date | null;
  stockCommitted: boolean;
  salesCounted: boolean;
  cartId: Types.ObjectId | null;
  checkoutKey: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  shipment: {
    provider: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  };
  cancellation: {
    status: "none" | "requested" | "approved" | "rejected";
    reason: string;
    requestedAt: Date | null;
    requestedBy: "customer" | "admin" | "system" | null;
    resolvedAt: Date | null;
    resolvedBy: string | null;
    note: string;
  };
  needsAttention: boolean;
  attentionReason: string;
  processingLock: Date | null;
  placedAt: Date;
  confirmedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDoc>(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isGuest: { type: Boolean, default: false },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true },
    },
    shippingAddress: { type: addressSnapshotSchema, required: true },
    billingAddress: { type: addressSnapshotSchema, required: true },
    items: { type: [orderItemSchema], required: true },
    pricing: {
      currency: { type: String, default: "INR" },
      pricesIncludeTax: { type: Boolean, default: true },
      mrpTotal: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      discountTotal: { type: Number, required: true },
      shippingFeeBeforeDiscount: { type: Number, required: true },
      shippingFee: { type: Number, required: true },
      codFee: { type: Number, required: true },
      taxTotal: { type: Number, required: true },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      interState: { type: Boolean, default: false },
      grandTotal: { type: Number, required: true, min: 0 },
      amountPaid: { type: Number, default: 0 },
      amountRefunded: { type: Number, default: 0 },
    },
    shippingMethod: {
      code: { type: String, enum: ["standard", "express"], default: "standard" },
      label: { type: String, default: "Standard delivery" },
      eta: { type: String, default: "" },
    },
    appliedPromotions: [
      {
        promotionId: { type: Schema.Types.ObjectId, ref: "Promotion" },
        name: String,
        code: { type: String, default: null },
        type: String,
        amount: Number,
        freeShipping: Boolean,
        _id: false,
      },
    ],
    couponCode: { type: String, default: null },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    statusHistory: [
      {
        status: { type: String, enum: ORDER_STATUSES },
        note: { type: String, default: "" },
        at: { type: Date, default: () => new Date() },
        by: { type: actorSchema, default: () => ({}) },
        _id: false,
      },
    ],
    customerNote: { type: String, default: "", maxlength: 500 },
    internalNotes: [
      {
        note: String,
        at: { type: Date, default: () => new Date() },
        by: { type: actorSchema, default: () => ({}) },
        _id: false,
      },
    ],
    razorpayOrderId: { type: String, default: null },
    reservationId: { type: Schema.Types.ObjectId, default: null },
    reservationExpiresAt: { type: Date, default: null },
    stockCommitted: { type: Boolean, default: false },
    salesCounted: { type: Boolean, default: false },
    cartId: { type: Schema.Types.ObjectId, default: null },
    checkoutKey: { type: String, required: true },
    invoiceNumber: { type: String, default: null },
    invoiceDate: { type: Date, default: null },
    shipment: {
      provider: { type: String, default: null },
      courierName: { type: String, default: null },
      trackingNumber: { type: String, default: null },
      trackingUrl: { type: String, default: null },
      shippedAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
    },
    cancellation: {
      status: { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      requestedBy: { type: String, enum: ["customer", "admin", "system", null], default: null },
      resolvedAt: { type: Date, default: null },
      resolvedBy: { type: String, default: null },
      note: { type: String, default: "" },
    },
    needsAttention: { type: Boolean, default: false },
    attentionReason: { type: String, default: "" },
    processingLock: { type: Date, default: null },
    placedAt: { type: Date, default: () => new Date() },
    confirmedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ checkoutKey: 1 }, { unique: true });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } });
orderSchema.index({ invoiceNumber: 1 }, { unique: true, partialFilterExpression: { invoiceNumber: { $type: "string" } } });
orderSchema.index({ userId: 1, placedAt: -1 });
orderSchema.index({ "customer.email": 1, placedAt: -1 });
orderSchema.index({ "customer.phone": 1 });
orderSchema.index({ status: 1, placedAt: -1 });
orderSchema.index({ paymentStatus: 1, placedAt: -1 });
orderSchema.index({ placedAt: -1 });
orderSchema.index({ status: 1, reservationExpiresAt: 1 });
orderSchema.index({ cartId: 1, status: 1 });

export const Order = defineModel<OrderDoc>("Order", orderSchema);

/* ------------------------------------------------------------------ */
/* Payment                                                             */
/* ------------------------------------------------------------------ */

export const PAYMENT_RECORD_STATUSES = ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export interface PaymentDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  provider: "razorpay" | "cod";
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amount: number;
  currency: "INR";
  status: PaymentRecordStatus;
  method: string | null;
  amountRefunded: number;
  errorCode: string | null;
  errorDescription: string | null;
  events: { type: string; source: "checkout" | "webhook" | "reconcile" | "admin" | "system"; at: Date; detail?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    provider: { type: String, enum: ["razorpay", "cod"], required: true },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: PAYMENT_RECORD_STATUSES, default: "created" },
    method: { type: String, default: null },
    amountRefunded: { type: Number, default: 0 },
    errorCode: { type: String, default: null },
    errorDescription: { type: String, default: null },
    events: [
      {
        type: { type: String, required: true },
        source: { type: String, enum: ["checkout", "webhook", "reconcile", "admin", "system"], required: true },
        at: { type: Date, default: () => new Date() },
        detail: { type: String, default: "" },
        _id: false,
      },
    ],
  },
  { timestamps: true },
);

paymentSchema.index({ orderId: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } });

export const Payment = defineModel<PaymentDoc>("Payment", paymentSchema);

/* ------------------------------------------------------------------ */
/* Refund                                                              */
/* ------------------------------------------------------------------ */

export const REFUND_STATUSES = ["pending_approval", "processing", "processed", "failed", "rejected", "manual"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface RefundDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  paymentId: Types.ObjectId | null;
  razorpayPaymentId: string | null;
  razorpayRefundId: string | null;
  amount: number;
  status: RefundStatus;
  reason: string;
  source: "cancellation" | "return" | "admin";
  returnRequestId: Types.ObjectId | null;
  requestedBy: { id: string | null; name: string; type: string };
  approvedBy: { id: string | null; name: string } | null;
  failureReason: string;
  /** Whether this refund is counted in the order's amountRefunded. */
  appliedToOrder: boolean;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<RefundDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpayRefundId: { type: String, default: null },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: REFUND_STATUSES, default: "pending_approval" },
    reason: { type: String, default: "" },
    source: { type: String, enum: ["cancellation", "return", "admin"], required: true },
    returnRequestId: { type: Schema.Types.ObjectId, default: null },
    requestedBy: { type: actorSchema, default: () => ({}) },
    approvedBy: { type: new Schema({ id: String, name: String }, { _id: false }), default: null },
    failureReason: { type: String, default: "" },
    appliedToOrder: { type: Boolean, default: false },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index({ razorpayRefundId: 1 }, { unique: true, partialFilterExpression: { razorpayRefundId: { $type: "string" } } });

export const Refund = defineModel<RefundDoc>("Refund", refundSchema);

/* ------------------------------------------------------------------ */
/* Return request                                                      */
/* ------------------------------------------------------------------ */

export const RETURN_STATUSES = ["requested", "approved", "rejected", "received", "refunded", "closed"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export interface ReturnRequestDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId | null;
  items: { orderItemId: Types.ObjectId; productName: string; variantLabel: string; sku: string; quantity: number; unitRefund: number }[];
  reason: string;
  details: string;
  resolution: "refund" | "replacement";
  status: ReturnStatus;
  refundAmount: number;
  restock: boolean;
  adminNote: string;
  history: { status: ReturnStatus; note: string; at: Date; by: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const returnRequestSchema = new Schema<ReturnRequestDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    items: [
      {
        orderItemId: { type: Schema.Types.ObjectId, required: true },
        productName: String,
        variantLabel: String,
        sku: String,
        quantity: { type: Number, min: 1 },
        unitRefund: { type: Number, min: 0 },
        _id: false,
      },
    ],
    reason: { type: String, required: true },
    details: { type: String, default: "", maxlength: 1000 },
    resolution: { type: String, enum: ["refund", "replacement"], default: "refund" },
    status: { type: String, enum: RETURN_STATUSES, default: "requested" },
    refundAmount: { type: Number, default: 0 },
    restock: { type: Boolean, default: true },
    adminNote: { type: String, default: "" },
    history: [
      {
        status: { type: String, enum: RETURN_STATUSES },
        note: String,
        at: { type: Date, default: () => new Date() },
        by: String,
        _id: false,
      },
    ],
  },
  { timestamps: true },
);

returnRequestSchema.index({ orderId: 1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

export const ReturnRequest = defineModel<ReturnRequestDoc>("ReturnRequest", returnRequestSchema);

/* ------------------------------------------------------------------ */
/* Shipment                                                            */
/* ------------------------------------------------------------------ */

export const SHIPMENT_STATUSES = ["pending", "booked", "in_transit", "out_for_delivery", "delivered", "failed", "rto", "rto_delivered", "cancelled"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export interface ShipmentDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  provider: "manual" | "shiprocket";
  status: ShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  providerOrderId: string | null;
  providerShipmentId: string | null;
  weightGrams: number;
  events: { status: string; description: string; location: string; at: Date; source: "admin" | "provider" | "webhook" }[];
  bookedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const shipmentSchema = new Schema<ShipmentDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    provider: { type: String, enum: ["manual", "shiprocket"], required: true },
    status: { type: String, enum: SHIPMENT_STATUSES, default: "pending" },
    courierName: { type: String, default: null },
    trackingNumber: { type: String, default: null },
    trackingUrl: { type: String, default: null },
    providerOrderId: { type: String, default: null },
    providerShipmentId: { type: String, default: null },
    weightGrams: { type: Number, default: 0 },
    events: [
      {
        status: String,
        description: { type: String, default: "" },
        location: { type: String, default: "" },
        at: { type: Date, default: () => new Date() },
        source: { type: String, enum: ["admin", "provider", "webhook"], default: "admin" },
        _id: false,
      },
    ],
    bookedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

shipmentSchema.index({ orderId: 1, createdAt: -1 });
shipmentSchema.index({ trackingNumber: 1 });

export const Shipment = defineModel<ShipmentDoc>("Shipment", shipmentSchema);

/* ------------------------------------------------------------------ */
/* Inventory: reservations and movements                               */
/* ------------------------------------------------------------------ */

export interface ReservationItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  quantity: number;
}

export interface StockReservationDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  items: ReservationItem[];
  status: "active" | "committed" | "released";
  expiresAt: Date;
  releasedAt: Date | null;
  releaseReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<StockReservationDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, required: true },
        variantId: { type: Schema.Types.ObjectId, required: true },
        sku: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        _id: false,
      },
    ],
    status: { type: String, enum: ["active", "committed", "released"], default: "active" },
    expiresAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: "" },
  },
  { timestamps: true },
);

reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index({ orderId: 1 });

export const StockReservation = defineModel<StockReservationDoc>("StockReservation", reservationSchema);

export const MOVEMENT_TYPES = ["reserve", "release", "commit", "sale", "restock", "return", "adjustment", "import", "initial"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export interface InventoryMovementDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  productName: string;
  variantLabel: string;
  type: MovementType;
  /** Change in sellable stock. */
  stockChange: number;
  /** Change in reserved stock. */
  reservedChange: number;
  stockAfter: number | null;
  reservedAfter: number | null;
  reason: string;
  orderId: Types.ObjectId | null;
  orderNumber: string | null;
  actor: { id: string | null; name: string; email?: string | null; type: "admin" | "system" | "customer" };
  createdAt: Date;
}

const movementSchema = new Schema<InventoryMovementDoc>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    productName: { type: String, default: "" },
    variantLabel: { type: String, default: "" },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    stockChange: { type: Number, default: 0 },
    reservedChange: { type: Number, default: 0 },
    stockAfter: { type: Number, default: null },
    reservedAfter: { type: Number, default: null },
    reason: { type: String, default: "" },
    orderId: { type: Schema.Types.ObjectId, default: null },
    orderNumber: { type: String, default: null },
    actor: {
      id: { type: String, default: null },
      name: { type: String, default: "System" },
      email: { type: String, default: null },
      type: { type: String, enum: ["admin", "system", "customer"], default: "system" },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

movementSchema.index({ variantId: 1, createdAt: -1 });
movementSchema.index({ productId: 1, createdAt: -1 });
movementSchema.index({ createdAt: -1 });
movementSchema.index({ type: 1, createdAt: -1 });

export const InventoryMovement = defineModel<InventoryMovementDoc>("InventoryMovement", movementSchema);
