"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type ActionResultLike = { ok: boolean; error?: string; message?: string };

/**
 * Runs a bound Server Action, optionally after a confirmation dialog, then
 * shows the result and refreshes server data.
 */
export function ActionButton({
  action,
  children,
  confirm,
  confirmLabel = "Confirm",
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: {
  action: () => Promise<ActionResultLike>;
  children: ReactNode;
  confirm?: { title: string; description?: string };
  confirmLabel?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });

  return (
    <>
      <Button variant={variant} size={size} className={className} disabled={disabled || pending} onClick={() => (confirm ? setOpen(true) : run())}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </Button>
      {confirm ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              {confirm.description ? <AlertDialogDescription>{confirm.description}</AlertDialogDescription> : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  run();
                }}
                disabled={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null} {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
