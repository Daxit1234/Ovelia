import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/shared/rich-text";
import { PageHeader } from "@/components/store/page-header";
import { WhyChoose } from "@/components/store/home/sections";
import { Button } from "@/components/ui/button";
import { getPolicy, getPublicSettings } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "About Ovelia",
  description: "Learn about Ovelia — everyday cleaning essentials for Indian homes and cars.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [about, settings] = await Promise.all([getPolicy("about"), getPublicSettings()]);
  return (
    <>
      <PageHeader eyebrow="Our story" title="About Ovelia" description={settings.store.tagline} breadcrumbs={[{ label: "About", href: "/about" }]} />
      <div className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_320px]">
        <RichText text={about} className="text-base" />
        <aside className="h-fit space-y-4 rounded-3xl bg-brand-mint/70 p-6">
          <h2 className="font-heading text-lg font-bold">Shop the range</h2>
          <p className="text-sm text-muted-foreground">Dishwash, floor, kitchen, bathroom, glass, laundry and car care essentials.</p>
          <Button asChild className="w-full rounded-full">
            <Link href="/shop">Browse products</Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link href="/contact">Contact us</Link>
          </Button>
        </aside>
      </div>
      <WhyChoose items={settings.homepage.whyChoose} />
    </>
  );
}
