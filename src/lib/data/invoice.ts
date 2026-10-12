import "server-only";
import { connectDB, Order, type OrderDoc, type OrderItemDoc } from "@/lib/db";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/order-status";
import { gstStateCode } from "@/lib/india";
import { rupeesInWords } from "@/lib/money";
import { loadSettings } from "@/lib/services/settings";

export interface InvoiceLine {
  description: string;
  sku: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  orderNumber: string;
  orderDate: string;
  paymentMethod: string;
  paymentStatus: string;
  interState: boolean;
  placeOfSupply: string;
  seller: { name: string; legalName: string; address: string; gstin: string; email: string; phone: string; stateCode: string | null };
  buyer: { name: string; email: string; phone: string; billing: OrderDoc["billingAddress"]; shipping: OrderDoc["shippingAddress"] };
  lines: InvoiceLine[];
  totals: { taxable: number; cgst: number; sgst: number; igst: number; grandTotal: number; discount: number };
  amountInWords: string;
  pricesIncludeTax: boolean;
  items: { name: string; variant: string; sku: string; quantity: number }[];
  customerNote: string;
  shippingMethod: string;
}

function split(tax: number, interState: boolean) {
  if (interState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

function chargeLine(label: string, amount: number, rate: number, inclusive: boolean, interState: boolean, hsn: string): InvoiceLine | null {
  if (amount <= 0) return null;
  const taxable = inclusive ? Math.round((amount * 100) / (100 + rate)) : amount;
  const tax = inclusive ? amount - taxable : Math.round((amount * rate) / 100);
  return { description: label, sku: "", hsn, quantity: 1, unitPrice: amount, discount: 0, taxableValue: taxable, taxRate: rate, ...split(tax, interState), total: taxable + tax };
}

export async function loadInvoiceData(orderNumber: string): Promise<{ data: InvoiceData; order: OrderDoc } | null> {
  await connectDB();
  const order = await Order.findOne({ orderNumber: orderNumber.toUpperCase() }).lean();
  if (!order) return null;
  const settings = await loadSettings();
  const interState = order.pricing.interState;
  const inclusive = order.pricing.pricesIncludeTax;

  const lines: InvoiceLine[] = (order.items as OrderItemDoc[]).map((item) => ({
    description: `${item.productName} — ${item.variantLabel}`,
    sku: item.sku,
    hsn: item.hsnCode,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    taxableValue: item.taxableValue,
    taxRate: item.taxRate,
    ...split(item.taxAmount, interState),
    total: item.lineTotal + (inclusive ? 0 : item.taxAmount),
  }));
  const shippingRate = settings.tax.shippingGstRate;
  const shipping = chargeLine(`Shipping — ${order.shippingMethod.label}`, order.pricing.shippingFee, shippingRate, inclusive, interState, "996812");
  const cod = chargeLine("Cash on Delivery handling", order.pricing.codFee, shippingRate, inclusive, interState, "996812");
  if (shipping) lines.push(shipping);
  if (cod) lines.push(cod);

  const sum = (key: keyof InvoiceLine) => lines.reduce((s, l) => s + (l[key] as number), 0);
  const store = settings.store;
  const sellerAddress = [store.address.line1, store.address.line2, store.address.city, store.address.state, store.address.pincode].filter(Boolean).join(", ");
  const state = order.shippingAddress.state;

  return {
    order,
    data: {
      invoiceNumber: order.invoiceNumber,
      invoiceDate: order.invoiceDate?.toISOString() ?? null,
      orderNumber: order.orderNumber,
      orderDate: order.placedAt.toISOString(),
      paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod],
      paymentStatus: order.paymentStatus,
      interState,
      placeOfSupply: `${state}${gstStateCode(state) ? ` (${gstStateCode(state)})` : ""}`,
      seller: {
        name: store.name,
        legalName: store.legalName || "[Registered business name]",
        address: sellerAddress || "[Registered business address]",
        gstin: store.gstin || "[GSTIN]",
        email: store.supportEmail,
        phone: store.supportPhone,
        stateCode: settings.tax.storeState ? gstStateCode(settings.tax.storeState) : null,
      },
      buyer: { name: order.customer.name, email: order.customer.email, phone: order.customer.phone, billing: order.billingAddress, shipping: order.shippingAddress },
      lines,
      totals: {
        taxable: sum("taxableValue"),
        cgst: sum("cgst"),
        sgst: sum("sgst"),
        igst: sum("igst"),
        grandTotal: order.pricing.grandTotal,
        discount: order.pricing.discountTotal,
      },
      amountInWords: rupeesInWords(order.pricing.grandTotal),
      pricesIncludeTax: inclusive,
      items: (order.items as OrderItemDoc[]).map((i) => ({ name: i.productName, variant: i.variantLabel, sku: i.sku, quantity: i.quantity })),
      customerNote: order.customerNote,
      shippingMethod: order.shippingMethod.label,
    },
  };
}
