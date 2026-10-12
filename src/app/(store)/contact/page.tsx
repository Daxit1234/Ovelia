import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/store/contact-form";
import { PageHeader } from "@/components/store/page-header";
import { getPublicSettings } from "@/lib/data/content";
import { formatIndianMobile } from "@/lib/india";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with Ovelia about orders, products, returns or bulk enquiries.",
  alternates: { canonical: "/contact" },
};

async function ContactFormWithOrder({ searchParams }: Pick<PageProps<"/contact">, "searchParams">) {
  const order = (await searchParams).order;
  return <ContactForm defaultOrderNumber={typeof order === "string" ? order.slice(0, 32) : undefined} />;
}

export default async function ContactPage(props: PageProps<"/contact">) {
  const settings = await getPublicSettings();
  const store = settings.store;
  const address = [store.address.line1, store.address.line2, store.address.city, store.address.state, store.address.pincode].filter(Boolean).join(", ");
  const details = [
    { icon: Mail, label: "Email", value: store.supportEmail, href: store.supportEmail ? `mailto:${store.supportEmail}` : null, placeholder: "Support email" },
    { icon: Phone, label: "Phone", value: store.supportPhone ? formatIndianMobile(store.supportPhone) : "", href: store.supportPhone ? `tel:${store.supportPhone.replace(/\s/g, "")}` : null, placeholder: "Support phone" },
    { icon: MessageCircle, label: "WhatsApp", value: store.whatsappNumber ? formatIndianMobile(store.whatsappNumber) : "", href: store.whatsappNumber ? `https://wa.me/91${store.whatsappNumber.replace(/\D/g, "").slice(-10)}` : null, placeholder: null },
    { icon: MapPin, label: "Address", value: address, href: null, placeholder: "Business address" },
    { icon: Clock, label: "Support hours", value: store.businessHours, href: null, placeholder: null },
  ];
  return (
    <>
      <PageHeader eyebrow="We're here to help" title="Contact us" description="Questions about an order, a product or a bulk purchase? Send us a message." breadcrumbs={[{ label: "Contact", href: "/contact" }]} />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_360px]">
        <Suspense fallback={<ContactForm />}>
          <ContactFormWithOrder searchParams={props.searchParams} />
        </Suspense>
        <aside className="h-fit space-y-5 rounded-3xl bg-brand-mint/70 p-6">
          <h2 className="font-heading text-lg font-bold">Other ways to reach us</h2>
          <ul className="space-y-4 text-sm">
            {details
              .filter((d) => d.value || d.placeholder)
              .map(({ icon: Icon, label, value, href, placeholder }) => (
                <li key={label} className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-brand-teal" aria-hidden />
                  <div>
                    <p className="font-semibold text-brand-ink">{label}</p>
                    {value ? (
                      href ? (
                        <a href={href} className="text-brand-green hover:underline" target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                          {value}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">{value}</p>
                      )
                    ) : (
                      <p className="text-muted-foreground italic">[{placeholder} — to be added]</p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Looking for an order? <Link href="/track-order" className="font-semibold text-brand-green hover:underline">Track it here</Link>.
          </p>
        </aside>
      </div>
    </>
  );
}
