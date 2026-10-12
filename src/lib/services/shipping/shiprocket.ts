import "server-only";
import { connectDB, IntegrationToken } from "@/lib/db";
import { getEnv, integrations } from "@/lib/env";
import { mapCarrierStatus } from "@/lib/services/shipping/status-map";
import type { BookingResult, ShippingProvider, TrackingResult } from "@/lib/services/shipping/types";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_KEY = "shiprocket";
const TIMEOUT_MS = 12_000;

class ShiprocketError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function login(): Promise<string> {
  const env = getEnv();
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) throw new ShiprocketError(body.message ?? "Shiprocket authentication failed", res.status);
  // Tokens are valid for 10 days; refresh a day early.
  await IntegrationToken.updateOne(
    { _id: TOKEN_KEY },
    { $set: { token: body.token, expiresAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000) } },
    { upsert: true },
  );
  return body.token;
}

async function token(forceRefresh = false): Promise<string> {
  await connectDB();
  if (!forceRefresh) {
    const cached = await IntegrationToken.findById(TOKEN_KEY).lean();
    if (cached && cached.expiresAt > new Date()) return cached.token;
  }
  return login();
}

async function request<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, retry = true): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 401 && retry) {
    await token(true);
    return request<T>(path, init, false);
  }
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ShiprocketError((body as { message?: string }).message ?? `Shiprocket request failed (${res.status})`, res.status);
  return body;
}

function rupees(paise: number): number {
  return Math.round(paise) / 100;
}

function formatOrderDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function splitName(fullName: string): { first: string; last: string } {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return { first: first ?? fullName, last: rest.join(" ") };
}

interface ServiceabilityResponse {
  status?: number;
  data?: { available_courier_companies?: { cod?: number; estimated_delivery_days?: string | number; courier_name?: string }[] };
}

interface CreateOrderResponse {
  order_id?: number | string;
  shipment_id?: number | string;
  status?: string;
  awb_code?: string;
  courier_name?: string;
}

interface AssignAwbResponse {
  awb_assign_status?: number;
  response?: { data?: { awb_code?: string; courier_name?: string; shipment_id?: number | string } };
  message?: string;
}

interface TrackResponse {
  tracking_data?: {
    track_url?: string;
    shipment_track?: { current_status?: string }[];
    shipment_track_activities?: { date?: string; activity?: string; location?: string; status?: string; "sr-status-label"?: string }[];
  };
}

export const shiprocketProvider: ShippingProvider = {
  id: "shiprocket",
  label: "Shiprocket",
  isConfigured: () => integrations.shiprocket() && Boolean(getEnv().SHIPROCKET_PICKUP_LOCATION),

  async checkServiceability({ deliveryPincode, pickupPincode, weightGrams, cod, declaredValue }) {
    const params = new URLSearchParams({
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight: String(Math.max(0.1, weightGrams / 1000)),
      cod: cod ? "1" : "0",
      declared_value: String(rupees(declaredValue)),
    });
    try {
      const body = await request<ServiceabilityResponse>(`/courier/serviceability/?${params.toString()}`);
      const couriers = body.data?.available_courier_companies ?? [];
      if (couriers.length === 0) {
        return { serviceable: false, codAvailable: false, message: "Sorry, we do not deliver to this PIN code yet.", estimatedDays: null };
      }
      const days = couriers
        .map((c) => Number(c.estimated_delivery_days))
        .filter((d) => Number.isFinite(d) && d > 0);
      return {
        serviceable: true,
        codAvailable: couriers.some((c) => c.cod === 1),
        message: null,
        estimatedDays: days.length ? Math.min(...days) : null,
      };
    } catch (error) {
      if (error instanceof ShiprocketError && error.status === 404) {
        return { serviceable: false, codAvailable: false, message: "Sorry, we do not deliver to this PIN code yet.", estimatedDays: null };
      }
      throw error;
    }
  },

  async createShipment(order, pkg): Promise<BookingResult> {
    const env = getEnv();
    const billing = splitName(order.billingAddress.fullName);
    const shipping = splitName(order.shippingAddress.fullName);
    const sameAddress =
      order.billingAddress.line1 === order.shippingAddress.line1 && order.billingAddress.pincode === order.shippingAddress.pincode;
    const created = await request<CreateOrderResponse>("/orders/create/adhoc", {
      method: "POST",
      body: {
        order_id: order.orderNumber,
        order_date: formatOrderDate(order.placedAt),
        pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
        billing_customer_name: billing.first,
        billing_last_name: billing.last,
        billing_address: order.billingAddress.line1,
        billing_address_2: order.billingAddress.line2 ?? "",
        billing_city: order.billingAddress.city,
        billing_pincode: order.billingAddress.pincode,
        billing_state: order.billingAddress.state,
        billing_country: "India",
        billing_email: order.customer.email,
        billing_phone: order.billingAddress.phone,
        shipping_is_billing: sameAddress,
        ...(sameAddress
          ? {}
          : {
              shipping_customer_name: shipping.first,
              shipping_last_name: shipping.last,
              shipping_address: order.shippingAddress.line1,
              shipping_address_2: order.shippingAddress.line2 ?? "",
              shipping_city: order.shippingAddress.city,
              shipping_pincode: order.shippingAddress.pincode,
              shipping_state: order.shippingAddress.state,
              shipping_country: "India",
              shipping_email: order.customer.email,
              shipping_phone: order.shippingAddress.phone,
            }),
        order_items: order.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.quantity,
          selling_price: rupees(item.unitPrice),
          discount: 0,
          tax: item.taxRate,
          hsn: item.hsnCode,
        })),
        payment_method: order.paymentMethod === "cod" ? "COD" : "Prepaid",
        shipping_charges: rupees(order.shippingFee),
        sub_total: rupees(order.subTotal),
        length: pkg.lengthCm,
        breadth: pkg.breadthCm,
        height: pkg.heightCm,
        weight: Math.max(0.1, pkg.weightGrams / 1000),
      },
    });

    const providerOrderId = created.order_id != null ? String(created.order_id) : null;
    const providerShipmentId = created.shipment_id != null ? String(created.shipment_id) : null;
    if (!providerShipmentId) {
      return {
        status: "pending",
        providerOrderId,
        providerShipmentId,
        trackingNumber: null,
        courierName: null,
        trackingUrl: null,
        message: "Order created in Shiprocket but no shipment id was returned. Check the Shiprocket panel.",
      };
    }

    const awb = await request<AssignAwbResponse>("/courier/assign/awb", {
      method: "POST",
      body: { shipment_id: providerShipmentId },
    }).catch((error: Error) => ({ awb_assign_status: 0, message: error.message }) as AssignAwbResponse);

    const awbCode = awb.response?.data?.awb_code || created.awb_code || null;
    if (!awbCode) {
      return {
        status: "pending",
        providerOrderId,
        providerShipmentId,
        trackingNumber: null,
        courierName: null,
        trackingUrl: null,
        message: `Shipment created but no courier was assigned yet${awb.message ? `: ${awb.message}` : ""}. Assign a courier in Shiprocket and refresh tracking.`,
      };
    }

    await request("/courier/generate/pickup", { method: "POST", body: { shipment_id: [providerShipmentId] } }).catch(() => undefined);

    return {
      status: "booked",
      providerOrderId,
      providerShipmentId,
      trackingNumber: awbCode,
      courierName: awb.response?.data?.courier_name || created.courier_name || null,
      trackingUrl: `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`,
      message: "Shipment booked with Shiprocket.",
    };
  },

  async track(trackingNumber): Promise<TrackingResult> {
    const body = await request<TrackResponse>(`/courier/track/awb/${encodeURIComponent(trackingNumber)}`);
    const data = body.tracking_data;
    const activities = data?.shipment_track_activities ?? [];
    const rawStatus = data?.shipment_track?.[0]?.current_status ?? activities[0]?.["sr-status-label"] ?? "";
    return {
      rawStatus,
      mappedStatus: mapCarrierStatus(rawStatus),
      trackingUrl: data?.track_url ?? null,
      events: activities.map((a) => ({
        status: a["sr-status-label"] ?? a.status ?? "",
        description: a.activity ?? "",
        location: a.location ?? "",
        at: a.date ? new Date(a.date.replace(" ", "T") + "+05:30") : new Date(),
      })),
    };
  },

  async cancel(providerOrderId) {
    await request("/orders/cancel", { method: "POST", body: { ids: [Number(providerOrderId) || providerOrderId] } });
  },
};
