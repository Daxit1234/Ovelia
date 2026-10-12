"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center gap-5 py-24 text-center">
      <AlertTriangle className="size-12 text-amber-500" aria-hidden />
      <h1 className="font-heading text-2xl font-bold text-brand-ink">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        Sorry — we couldn&apos;t load this page. Please try again. If the problem continues, contact us{error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => retry()} className="rounded-full">
          Try again
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
