import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/session";
import { ordersForExport, parseOrderFilters } from "@/lib/admin/orders";
import { csvResponse, rupeesCell, toCsv } from "@/lib/csv";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/domain/order-status";
import { AuthorizationError } from "@/lib/result";
import { audit } from "@/lib/services/audit";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await authorize("orders:export");
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseOrderFilters(params);
  const orders = await ordersForExport(filters);
  const csv = toCsv(orders, [
    { header: "Order number", value: (o) => o.orderNumber },
    { header: "Placed at (IST)", value: (o) => o.placedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) },
    { header: "Status", value: (o) => ORDER_STATUS_LABELS[o.status] },
    { header: "Payment status", value: (o) => PAYMENT_STATUS_LABELS[o.paymentStatus] },
    { header: "Payment method", value: (o) => (o.paymentMethod === "cod" ? "COD" : "Online") },
    { header: "Customer", value: (o) => o.customer.name },
    { header: "Email", value: (o) => o.customer.email },
    { header: "Phone", value: (o) => o.customer.phone },
    { header: "City", value: (o) => o.shippingAddress.city },
    { header: "State", value: (o) => o.shippingAddress.state },
    { header: "PIN code", value: (o) => o.shippingAddress.pincode },
    { header: "Items", value: (o) => o.items.map((i) => `${i.sku} x${i.quantity}`).join("; ") },
    { header: "Subtotal (INR)", value: (o) => rupeesCell(o.pricing.subtotal) },
    { header: "Discount (INR)", value: (o) => rupeesCell(o.pricing.discountTotal) },
    { header: "Shipping (INR)", value: (o) => rupeesCell(o.pricing.shippingFee) },
    { header: "COD fee (INR)", value: (o) => rupeesCell(o.pricing.codFee) },
    { header: "GST (INR)", value: (o) => rupeesCell(o.pricing.taxTotal) },
    { header: "Total (INR)", value: (o) => rupeesCell(o.pricing.grandTotal) },
    { header: "Refunded (INR)", value: (o) => rupeesCell(o.pricing.amountRefunded) },
    { header: "Coupon", value: (o) => o.couponCode ?? "" },
    { header: "Invoice number", value: (o) => o.invoiceNumber ?? "" },
    { header: "Courier", value: (o) => o.shipment?.courierName ?? "" },
    { header: "Tracking", value: (o) => o.shipment?.trackingNumber ?? "" },
  ]);
  await audit({
    actor: { id: user.id, name: user.name, email: user.email, role: user.role },
    action: "export.orders",
    entityType: "export",
    summary: `Exported ${orders.length} orders`,
    changes: { filters },
  });
  return csvResponse(csv, `ovelia-orders-${new Date().toISOString().slice(0, 10)}.csv`);
}
