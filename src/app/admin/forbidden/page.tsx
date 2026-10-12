import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-16 text-center">
      <ShieldAlert className="size-12 text-amber-500" aria-hidden />
      <h1 className="font-heading text-2xl font-bold">You don&apos;t have access to this page</h1>
      <p className="text-muted-foreground">Ask a Super Admin to update your role if you need access.</p>
      <Button asChild className="rounded-full">
        <Link href="/admin">Back to dashboard</Link>
      </Button>
    </div>
  );
}
