import type { Metadata } from "next";
import { PageHeader } from "@/components/store/page-header";
import { TrackOrderForm } from "@/components/store/track-order-form";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your Ovelia order with your order number and email or mobile number.",
  alternates: { canonical: "/track-order" },
};

export default function TrackOrderPage() {
  return (
    <>
      <PageHeader title="Track your order" description="Enter your order number and the email or mobile number used at checkout." breadcrumbs={[{ label: "Track order", href: "/track-order" }]} />
      <div className="container-page max-w-xl py-12">
        <TrackOrderForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">Your order number starts with “OV-” and is in your confirmation email.</p>
      </div>
    </>
  );
}
