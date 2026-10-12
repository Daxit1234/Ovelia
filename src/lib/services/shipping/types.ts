import type { OrderStatus } from "@/lib/domain/order-status";

export interface ServiceabilityResult {
  serviceable: boolean;
  codAvailable: boolean;
  message: string | null;
  estimatedDays: number | null;
  /** True when the provider could not be reached and we failed open. */
  unverified?: boolean;
}

export interface ShipmentPackage {
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
}

export interface ShipmentOrderInput {
  orderNumber: string;
  placedAt: Date;
  paymentMethod: "razorpay" | "cod";
  grandTotal: number;
  subTotal: number;
  shippingFee: number;
  customer: { name: string; email: string; phone: string };
  shippingAddress: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  billingAddress: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  items: { name: string; sku: string; quantity: number; unitPrice: number; taxRate: number; hsnCode: string }[];
}

export interface BookingResult {
  /** "booked" only when the provider has assigned an AWB / tracking number. */
  status: "booked" | "pending";
  providerOrderId: string | null;
  providerShipmentId: string | null;
  trackingNumber: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  message: string;
}

export interface TrackingEvent {
  status: string;
  description: string;
  location: string;
  at: Date;
}

export interface TrackingResult {
  rawStatus: string;
  mappedStatus: OrderStatus | null;
  events: TrackingEvent[];
  trackingUrl: string | null;
}

export interface ShippingProvider {
  readonly id: "manual" | "shiprocket";
  readonly label: string;
  isConfigured(): boolean;
  checkServiceability(input: {
    deliveryPincode: string;
    pickupPincode: string;
    weightGrams: number;
    cod: boolean;
    declaredValue: number;
  }): Promise<ServiceabilityResult>;
  createShipment?(order: ShipmentOrderInput, pkg: ShipmentPackage): Promise<BookingResult>;
  track?(trackingNumber: string): Promise<TrackingResult>;
  cancel?(providerOrderId: string): Promise<void>;
}
