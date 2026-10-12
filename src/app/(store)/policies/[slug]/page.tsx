import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RichText } from "@/components/shared/rich-text";
import { PageHeader } from "@/components/store/page-header";
import { getPolicy, type PolicyKey } from "@/lib/data/content";

const POLICIES: Record<string, { key: PolicyKey; title: string; description: string }> = {
  shipping: { key: "shipping", title: "Shipping Policy", description: "How and when we deliver your order." },
  returns: { key: "returns", title: "Return & Refund Policy", description: "Returns, replacements, refunds and cancellations." },
  privacy: { key: "privacy", title: "Privacy Policy", description: "How we collect, use and protect your information." },
  terms: { key: "terms", title: "Terms & Conditions", description: "The terms that apply when you shop with us." },
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const policy = POLICIES[(await params).slug];
  if (!policy) return { title: "Not found" };
  return { title: policy.title, description: policy.description, alternates: { canonical: `/policies/${(await params).slug}` } };
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();
  const text = await getPolicy(policy.key);
  return (
    <>
      <PageHeader title={policy.title} description={policy.description} breadcrumbs={[{ label: policy.title, href: `/policies/${slug}` }]} />
      <div className="container-page max-w-3xl py-12">
        <RichText text={text} className="text-base" />
      </div>
    </>
  );
}
