import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type OrderStatus, type PaymentMethod } from "@/lib/domain/order-status";
import { escapeHtml, emailStyles, type EmailContent } from "@/lib/services/notifications/email-layout";

export interface EmailOrder {
  orderNumber: string;
  customerName: string;
  placedAt: Date;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  items: { productName: string; variantLabel: string; quantity: number; lineTotal: number }[];
  pricing: { subtotal: number; discountTotal: number; shippingFee: number; codFee: number; grandTotal: number; taxTotal: number };
  shippingAddress: { fullName: string; line1: string; line2?: string; city: string; state: string; pincode: string; phone: string };
  orderUrl: string;
}

function itemsTable(order: EmailOrder): string {
  const rows = order.items
    .map(
      (item) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid ${emailStyles.border}">${escapeHtml(item.productName)}<br><span style="color:${emailStyles.muted};font-size:13px">${escapeHtml(item.variantLabel)} × ${item.quantity}</span></td>
<td style="padding:8px 0;border-bottom:1px solid ${emailStyles.border};text-align:right;white-space:nowrap">${formatINR(item.lineTotal)}</td></tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? "font-weight:700" : `color:${emailStyles.muted}`}">${label}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:700" : ""}">${value}</td></tr>`;
  const p = order.pricing;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:12px 0">${rows}
${line("Items subtotal", formatINR(p.subtotal))}
${p.discountTotal > 0 ? line("Discounts", `−${formatINR(p.discountTotal)}`) : ""}
${line("Shipping", p.shippingFee === 0 ? "Free" : formatINR(p.shippingFee))}
${p.codFee > 0 ? line("COD fee", formatINR(p.codFee)) : ""}
${line("Total", formatINR(p.grandTotal), true)}
<tr><td colspan="2" style="padding-top:2px;color:${emailStyles.muted};font-size:12px">Prices include GST of ${formatINR(p.taxTotal)}.</td></tr>
</table>`;
}

function addressBlock(order: EmailOrder): string {
  const a = order.shippingAddress;
  return `<p style="margin:12px 0 0;font-size:14px"><strong>Delivering to</strong><br>${escapeHtml(a.fullName)}<br>${escapeHtml(a.line1)}${a.line2 ? `, ${escapeHtml(a.line2)}` : ""}<br>${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.pincode)}<br>Phone: ${escapeHtml(a.phone)}</p>`;
}

function itemsText(order: EmailOrder): string {
  return [
    ...order.items.map((i) => `- ${i.productName} (${i.variantLabel}) × ${i.quantity}: ${formatINR(i.lineTotal)}`),
    `Total: ${formatINR(order.pricing.grandTotal)}`,
  ].join("\n");
}

export const templates = {
  orderConfirmation(order: EmailOrder): EmailContent {
    const paid = order.paymentMethod === "razorpay";
    return {
      subject: `Order ${order.orderNumber} confirmed`,
      preheader: paid ? "Payment received — we're getting your order ready." : "We're getting your order ready.",
      heading: `Thank you, ${order.customerName.split(" ")[0]}! Your order is confirmed.`,
      bodyHtml: `<p style="margin:0 0 8px">Order <strong>${escapeHtml(order.orderNumber)}</strong> placed on ${formatDate(order.placedAt)}.</p>
<p style="margin:0 0 8px">Payment: <strong>${escapeHtml(PAYMENT_METHOD_LABELS[order.paymentMethod])}</strong>${paid ? " — payment received" : " — please keep the exact amount ready at delivery"}.</p>
${itemsTable(order)}${addressBlock(order)}`,
      text: `Order ${order.orderNumber} is confirmed.\n\n${itemsText(order)}`,
      cta: { label: "View your order", url: order.orderUrl },
    };
  },

  paymentFailed(order: EmailOrder): EmailContent {
    return {
      subject: `Payment for order ${order.orderNumber} was not completed`,
      preheader: "Your items are not lost — you can retry the payment.",
      heading: "Your payment did not go through",
      bodyHtml: `<p style="margin:0 0 8px">We could not confirm the payment for order <strong>${escapeHtml(order.orderNumber)}</strong>. No order has been confirmed and, if any amount was debited, your bank will reverse it automatically.</p><p style="margin:0">You can retry the payment from your order page while the items are still reserved for you.</p>`,
      text: `Payment for order ${order.orderNumber} was not completed. Retry from your order page.`,
      cta: { label: "Retry payment", url: order.orderUrl },
    };
  },

  orderShipped(order: EmailOrder, shipment: { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null }): EmailContent {
    const tracking = shipment.trackingNumber
      ? `<p style="margin:0 0 8px">Courier: <strong>${escapeHtml(shipment.courierName || "Courier partner")}</strong><br>Tracking number: <strong>${escapeHtml(shipment.trackingNumber)}</strong></p>`
      : "";
    return {
      subject: `Your order ${order.orderNumber} has been shipped`,
      preheader: "Your Ovelia order is on its way.",
      heading: "Your order is on its way",
      bodyHtml: `<p style="margin:0 0 8px">Good news — order <strong>${escapeHtml(order.orderNumber)}</strong> has been handed to our courier partner.</p>${tracking}${itemsTable(order)}`,
      text: `Order ${order.orderNumber} has shipped.${shipment.trackingNumber ? ` Tracking: ${shipment.trackingNumber}` : ""}`,
      cta: shipment.trackingUrl ? { label: "Track shipment", url: shipment.trackingUrl } : { label: "Track your order", url: order.orderUrl },
    };
  },

  orderStatusUpdate(order: EmailOrder, note?: string): EmailContent {
    const label = ORDER_STATUS_LABELS[order.status];
    return {
      subject: `Order ${order.orderNumber}: ${label}`,
      preheader: `Your order status is now: ${label}`,
      heading: `Order update: ${label}`,
      bodyHtml: `<p style="margin:0 0 8px">The status of order <strong>${escapeHtml(order.orderNumber)}</strong> is now <strong>${escapeHtml(label)}</strong>.</p>${note ? `<p style="margin:0 0 8px">${escapeHtml(note)}</p>` : ""}`,
      text: `Order ${order.orderNumber} status: ${label}. ${note ?? ""}`,
      cta: { label: "View order", url: order.orderUrl },
    };
  },

  orderDelivered(order: EmailOrder): EmailContent {
    return {
      subject: `Order ${order.orderNumber} delivered`,
      preheader: "We hope you love your Ovelia products.",
      heading: "Your order has been delivered",
      bodyHtml: `<p style="margin:0 0 8px">Order <strong>${escapeHtml(order.orderNumber)}</strong> has been delivered. We hope everything arrived in perfect condition.</p><p style="margin:0">If something is wrong with your order, you can request help from your order page. We would also love to hear your review.</p>`,
      text: `Order ${order.orderNumber} has been delivered.`,
      cta: { label: "View order", url: order.orderUrl },
    };
  },

  orderCancelled(order: EmailOrder, reason: string, refundNote: string | null): EmailContent {
    return {
      subject: `Order ${order.orderNumber} has been cancelled`,
      preheader: "Your order has been cancelled.",
      heading: "Your order has been cancelled",
      bodyHtml: `<p style="margin:0 0 8px">Order <strong>${escapeHtml(order.orderNumber)}</strong> has been cancelled.${reason ? ` Reason: ${escapeHtml(reason)}.` : ""}</p>${refundNote ? `<p style="margin:0">${escapeHtml(refundNote)}</p>` : ""}`,
      text: `Order ${order.orderNumber} has been cancelled. ${reason} ${refundNote ?? ""}`,
      cta: { label: "View order", url: order.orderUrl },
    };
  },

  cancellationRequestUpdate(order: EmailOrder, approved: boolean, note: string): EmailContent {
    return {
      subject: `Cancellation request for ${order.orderNumber} ${approved ? "approved" : "declined"}`,
      preheader: `Your cancellation request was ${approved ? "approved" : "declined"}.`,
      heading: `Cancellation request ${approved ? "approved" : "declined"}`,
      bodyHtml: `<p style="margin:0 0 8px">Your request to cancel order <strong>${escapeHtml(order.orderNumber)}</strong> was <strong>${approved ? "approved" : "declined"}</strong>.</p>${note ? `<p style="margin:0">${escapeHtml(note)}</p>` : ""}`,
      text: `Cancellation request for ${order.orderNumber} ${approved ? "approved" : "declined"}. ${note}`,
      cta: { label: "View order", url: order.orderUrl },
    };
  },

  refundUpdate(order: EmailOrder, amount: number, status: "initiated" | "processed" | "failed"): EmailContent {
    const copy = {
      initiated: `We have initiated a refund of <strong>${formatINR(amount)}</strong> for order <strong>${escapeHtml(order.orderNumber)}</strong>. Banks usually take 5–7 business days to credit it to your original payment method.`,
      processed: `Your refund of <strong>${formatINR(amount)}</strong> for order <strong>${escapeHtml(order.orderNumber)}</strong> has been processed by our payment partner.`,
      failed: `We could not process the refund of <strong>${formatINR(amount)}</strong> for order <strong>${escapeHtml(order.orderNumber)}</strong> automatically. Our team will contact you to complete it.`,
    }[status];
    return {
      subject: `Refund ${status} for order ${order.orderNumber}`,
      preheader: `Refund of ${formatINR(amount)} ${status}.`,
      heading: `Refund ${status}`,
      bodyHtml: `<p style="margin:0">${copy}</p>`,
      text: copy.replace(/<[^>]+>/g, ""),
      cta: { label: "View order", url: order.orderUrl },
    };
  },

  returnUpdate(order: EmailOrder, statusLabel: string, note: string): EmailContent {
    return {
      subject: `Return request for ${order.orderNumber}: ${statusLabel}`,
      preheader: `Your return request is ${statusLabel.toLowerCase()}.`,
      heading: `Return request ${statusLabel.toLowerCase()}`,
      bodyHtml: `<p style="margin:0 0 8px">Your return request for order <strong>${escapeHtml(order.orderNumber)}</strong> is now <strong>${escapeHtml(statusLabel)}</strong>.</p>${note ? `<p style="margin:0">${escapeHtml(note)}</p>` : ""}`,
      text: `Return request for ${order.orderNumber}: ${statusLabel}. ${note}`,
      cta: { label: "View order", url: order.orderUrl },
    };
  },

  welcome(name: string, verifyUrl: string | null, shopUrl: string): EmailContent {
    return {
      subject: "Welcome to Ovelia",
      preheader: verifyUrl ? "Please confirm your email address." : "Your account is ready.",
      heading: `Welcome, ${name.split(" ")[0]}!`,
      bodyHtml: `<p style="margin:0 0 8px">Your Ovelia account has been created. You can now track orders, save addresses and keep a wishlist.</p>${verifyUrl ? `<p style="margin:0">Please confirm your email address so we can reach you about your orders.</p>` : ""}`,
      text: `Your Ovelia account has been created.${verifyUrl ? ` Confirm your email: ${verifyUrl}` : ""}`,
      cta: verifyUrl ? { label: "Confirm email address", url: verifyUrl } : { label: "Start shopping", url: shopUrl },
    };
  },

  passwordReset(name: string, resetUrl: string): EmailContent {
    return {
      subject: "Reset your Ovelia password",
      preheader: "Use this link within 1 hour to choose a new password.",
      heading: "Reset your password",
      bodyHtml: `<p style="margin:0 0 8px">Hi ${escapeHtml(name.split(" ")[0])}, we received a request to reset your password. The link below is valid for 1 hour and can be used once.</p><p style="margin:0">If you did not request this, you can safely ignore this email — your password will not change.</p>`,
      text: `Reset your password (valid for 1 hour): ${resetUrl}\nIf you did not request this, ignore this email.`,
      cta: { label: "Choose a new password", url: resetUrl },
    };
  },

  contactAcknowledgement(name: string, subject: string): EmailContent {
    return {
      subject: "We received your message",
      preheader: "Thanks for contacting Ovelia.",
      heading: `Thanks, ${name.split(" ")[0]} — we've received your message`,
      bodyHtml: `<p style="margin:0">Your message about “${escapeHtml(subject)}” has reached our team. We'll get back to you as soon as possible.</p>`,
      text: `We received your message about "${subject}".`,
    };
  },

  adminNewOrder(order: EmailOrder, adminUrl: string): EmailContent {
    return {
      subject: `New order ${order.orderNumber} — ${formatINR(order.pricing.grandTotal)}`,
      preheader: `${order.items.length} item(s), ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
      heading: `New order ${order.orderNumber}`,
      bodyHtml: `<p style="margin:0 0 8px">Payment: ${escapeHtml(PAYMENT_METHOD_LABELS[order.paymentMethod])}</p>${itemsTable(order)}${addressBlock(order)}`,
      text: `New order ${order.orderNumber}\n${itemsText(order)}`,
      cta: { label: "Open in admin", url: adminUrl },
    };
  },

  adminAlert(title: string, message: string, url: string): EmailContent {
    return {
      subject: `[Ovelia admin] ${title}`,
      preheader: message,
      heading: title,
      bodyHtml: `<p style="margin:0">${escapeHtml(message)}</p>`,
      text: message,
      cta: { label: "Open admin", url },
    };
  },
};
