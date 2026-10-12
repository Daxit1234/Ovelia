import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh bg-neutral-100 py-6 print:bg-white print:py-0">{children}</main>;
}
