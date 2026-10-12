import type { StoreSettings } from "@/lib/validation/settings";

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  subject: string;
  preheader: string;
  heading: string;
  /** Pre-escaped HTML body blocks. */
  bodyHtml: string;
  text: string;
  cta?: { label: string; url: string };
}

const BRAND = {
  green: "#0b4d3b",
  teal: "#0e8f80",
  mint: "#eef7f3",
  ink: "#0f1f1a",
  muted: "#5b6b64",
  border: "#e1ebe6",
};

/** Table-based, inline-styled layout that renders consistently in email clients. */
export function renderEmail(content: EmailContent, settings: StoreSettings): { html: string; text: string } {
  const store = settings.store;
  const contactBits = [store.supportEmail, store.supportPhone].filter(Boolean).map(escapeHtml).join(" · ");
  const cta = content.cta
    ? `<tr><td style="padding:8px 32px 24px"><a href="${escapeHtml(content.cta.url)}" style="display:inline-block;background:${BRAND.green};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;font-size:15px">${escapeHtml(content.cta.label)}</a></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.mint};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.ink}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.mint};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border}">
<tr><td style="background:${BRAND.green};padding:22px 32px">
<span style="font-size:24px;font-weight:700;letter-spacing:0.5px;color:#ffffff">${escapeHtml(store.name || "Ovelia")}</span>
<span style="display:block;color:#bfe3d6;font-size:13px;margin-top:2px">${escapeHtml(store.tagline)}</span>
</td></tr>
<tr><td style="padding:28px 32px 8px"><h1 style="margin:0;font-size:22px;line-height:1.3;color:${BRAND.ink}">${escapeHtml(content.heading)}</h1></td></tr>
<tr><td style="padding:8px 32px 16px;font-size:15px;line-height:1.6;color:${BRAND.ink}">${content.bodyHtml}</td></tr>
${cta}
<tr><td style="padding:18px 32px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.muted}">
${contactBits ? `Need help? ${contactBits}<br>` : ""}You are receiving this email because of activity on your ${escapeHtml(store.name || "Ovelia")} account or order.
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    content.heading,
    "",
    content.text,
    content.cta ? `\n${content.cta.label}: ${content.cta.url}` : "",
    "",
    contactBits ? `Need help? ${[store.supportEmail, store.supportPhone].filter(Boolean).join(" · ")}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { html, text };
}

export const emailStyles = BRAND;
