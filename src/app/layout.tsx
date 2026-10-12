import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { getPublicSettings } from "@/lib/data/content";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: settings.seo.defaultTitle, template: `%s | ${settings.store.name}` },
    description: settings.seo.defaultDescription,
    applicationName: settings.store.name,
    openGraph: {
      type: "website",
      siteName: settings.store.name,
      locale: "en_IN",
      title: settings.seo.defaultTitle,
      description: settings.seo.defaultDescription,
    },
    twitter: { card: "summary_large_image", title: settings.seo.defaultTitle, description: settings.seo.defaultDescription },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b4d3b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
