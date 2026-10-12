"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { subscribeNewsletterAction } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NewsletterForm({ tone = "light", source = "website" }: { tone?: "light" | "dark"; source?: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await subscribeNewsletterAction({ email, source, website });
      if (result.ok) {
        setDone(true);
        toast.success(result.message ?? "Subscribed!");
      } else {
        toast.error(result.error);
      }
    });
  };

  if (done) {
    return (
      <p className={cn("flex items-center gap-2 text-sm font-medium", tone === "dark" ? "text-white" : "text-brand-green")} role="status">
        <CheckCircle2 className="size-5" aria-hidden /> You&apos;re subscribed. Thank you!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <label htmlFor={`newsletter-${source}`} className="sr-only">
        Email address
      </label>
      <Input
        id={`newsletter-${source}`}
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={cn("h-11 rounded-full px-4", tone === "dark" ? "border-white/20 bg-white/10 text-white placeholder:text-white/50" : "bg-white")}
      />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden
      />
      <Button type="submit" size="lg" disabled={pending} className={cn("h-11 rounded-full", tone === "dark" && "bg-brand-teal hover:bg-brand-teal/90")}>
        {pending ? "Subscribing…" : "Subscribe"}
      </Button>
    </form>
  );
}
