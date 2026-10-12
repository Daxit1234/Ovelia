import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed } from "lucide-react";
import {
  OrdersSettingsForm,
  PaymentsSettingsForm,
  PoliciesSettingsForm,
  ReviewsSettingsForm,
  SeoSettingsForm,
  ShippingSettingsForm,
  StoreSettingsForm,
  TaxSettingsForm,
} from "@/components/admin/settings/settings-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { requireStaffPage } from "@/lib/auth/session";
import { oneOf, param } from "@/lib/admin/list";
import { getEnv, integrations, siteUrl } from "@/lib/env";
import { launchChecklist, loadSettings } from "@/lib/services/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = {
  store: "Store details",
  shipping: "Shipping",
  payments: "Payments",
  tax: "Tax (GST)",
  orders: "Orders & returns",
  reviews: "Reviews",
  seo: "Search & sharing",
  policies: "Policies & pages",
  integrations: "Integrations",
} as const;
type Section = keyof typeof SECTIONS;

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-ink">
          {label} <span className={cn("ml-1 text-xs font-medium", ok ? "text-emerald-700" : "text-muted-foreground")}>{ok ? "Configured" : "Not configured"}</span>
        </p>
        <p className="text-sm break-words text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireStaffPage("settings:write", "/admin/settings");
  const section = oneOf(param(await searchParams, "section"), Object.keys(SECTIONS) as Section[], "store");
  const settings = await loadSettings();
  const missing = launchChecklist(settings);
  const env = getEnv();
  const shiprocketReady = integrations.shiprocket() && Boolean(env.SHIPROCKET_PICKUP_LOCATION);

  let body: React.ReactNode;
  switch (section) {
    case "store":
      body = <StoreSettingsForm initial={settings.store} />;
      break;
    case "shipping":
      body = <ShippingSettingsForm initial={settings.shipping} shiprocketConfigured={shiprocketReady} />;
      break;
    case "payments":
      body = <PaymentsSettingsForm initial={settings.payments} razorpayConfigured={integrations.razorpay()} />;
      break;
    case "tax":
      body = <TaxSettingsForm initial={settings.tax} />;
      break;
    case "orders":
      body = <OrdersSettingsForm initial={settings.orders} />;
      break;
    case "reviews":
      body = <ReviewsSettingsForm initial={settings.reviews} />;
      break;
    case "seo":
      body = <SeoSettingsForm initial={settings.seo} />;
      break;
    case "policies":
      body = <PoliciesSettingsForm initial={settings.policies} />;
      break;
    case "integrations":
      body = (
        <Panel title="Integrations" description="Credentials are set as server environment variables (never in this admin) and their values are never shown here.">
          <ul className="divide-y">
            <Status ok={integrations.razorpay()} label="Razorpay payments" detail="RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Without them, online payment is unavailable at checkout." />
            <Status ok={integrations.razorpayWebhook()} label="Razorpay webhook" detail={`RAZORPAY_WEBHOOK_SECRET. In the Razorpay dashboard, add ${siteUrl("/api/webhooks/razorpay")} with the payment, order and refund events.`} />
            <Status ok={integrations.email()} label="Email (Resend)" detail={`RESEND_API_KEY and a verified sender in EMAIL_FROM (currently “${env.EMAIL_FROM}”). Without it, no emails are sent; each one is recorded as skipped in the notification log.`} />
            <Status ok={integrations.cloudinary()} label="Image hosting (Cloudinary)" detail="CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. Required for image uploads in production." />
            <Status
              ok={shiprocketReady}
              label="Shiprocket shipping"
              detail={`SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD (an API user) and SHIPROCKET_PICKUP_LOCATION. Tracking webhook: ${siteUrl("/api/webhooks/shipping")} with SHIPROCKET_WEBHOOK_TOKEN as the x-api-key.`}
            />
            <Status ok={Boolean(env.CRON_SECRET)} label="Scheduled maintenance" detail={`CRON_SECRET. Calls ${siteUrl("/api/cron/maintenance")} every 15 minutes to expire unpaid orders and release held stock (configured in vercel.json).`} />
            <Status ok={false} label="SMS / WhatsApp notifications" detail="Not built in. The notification service has extension points for an SMS or WhatsApp provider; nothing is sent by SMS or WhatsApp until one is connected." />
          </ul>
        </Panel>
      );
      break;
  }

  return (
    <>
      <AdminPageHeader title="Settings" description="Store-wide configuration. Changes apply to the storefront immediately." />
      {missing.length ? (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Before launch, add: {missing.join(" · ")}.
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {(Object.entries(SECTIONS) as [Section, string][]).map(([key, label]) => (
            <Link
              key={key}
              href={key === "store" ? "/admin/settings" : `/admin/settings?section=${key}`}
              aria-current={key === section ? "page" : undefined}
              className={cn("rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", key === section ? "bg-brand-mint text-brand-green" : "text-muted-foreground hover:bg-muted")}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{body}</div>
      </div>
    </>
  );
}
