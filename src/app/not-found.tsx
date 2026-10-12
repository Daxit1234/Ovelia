import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-hero flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Link href="/" aria-label="Ovelia home">
        <Logo />
      </Link>
      <span className="grid size-20 place-items-center rounded-full bg-white shadow-sm">
        <SearchX className="size-9 text-brand-teal" aria-hidden />
      </span>
      <div className="space-y-2">
        <p className="eyebrow">Error 404</p>
        <h1 className="font-heading text-3xl font-extrabold text-brand-ink sm:text-4xl">We couldn&apos;t find that page</h1>
        <p className="mx-auto max-w-md text-muted-foreground">The link may be broken, or the page may have moved. Try searching the shop or head back home.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="rounded-full">
          <Link href="/">Go to home</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-full">
          <Link href="/shop">Browse products</Link>
        </Button>
      </div>
    </main>
  );
}
