import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/shared/json-ld";
import { PageHeader } from "@/components/store/page-header";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getFaqs } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about delivery, payments, Cash on Delivery, cancellations, returns and Ovelia products.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faqs = await getFaqs();
  const groups = new Map<string, typeof faqs>();
  for (const faq of faqs) groups.set(faq.category, [...(groups.get(faq.category) ?? []), faq]);
  return (
    <>
      {faqs.length ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
          }}
        />
      ) : null}
      <PageHeader eyebrow="Help centre" title="Frequently asked questions" description="Quick answers about orders, delivery, payments and returns." breadcrumbs={[{ label: "FAQ", href: "/faq" }]} />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          {[...groups.entries()].map(([category, items]) => (
            <section key={category} aria-labelledby={`faq-${category}`}>
              <h2 id={`faq-${category}`} className="mb-3 font-heading text-xl font-bold text-brand-ink">
                {category}
              </h2>
              <Accordion type="multiple" className="rounded-2xl border bg-white px-5">
                {items.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-left text-[15px] font-semibold">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-[15px] leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
          {faqs.length === 0 ? <p className="text-muted-foreground">FAQs will be published here soon.</p> : null}
        </div>
        <aside className="h-fit space-y-3 rounded-3xl bg-brand-mint/70 p-6">
          <h2 className="font-heading text-lg font-bold">Still need help?</h2>
          <p className="text-sm text-muted-foreground">Track an order or send us a message and our team will get back to you.</p>
          <Button asChild className="w-full rounded-full">
            <Link href="/contact">Contact us</Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link href="/track-order">Track your order</Link>
          </Button>
        </aside>
      </div>
    </>
  );
}
