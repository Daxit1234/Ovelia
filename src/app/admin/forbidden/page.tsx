import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="space-y-4">
        <ShieldAlert className="mx-auto size-12 text-amber-500" aria-hidden />
        <h1 className="font-heading text-2xl font-bold">You don&apos;t have access to this page</h1>
        <p className="text-muted-foreground">Ask a Super Admin to update your role if you need access.</p>
        <Button asChild className="rounded-full">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
