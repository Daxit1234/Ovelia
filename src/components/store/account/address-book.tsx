"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from "@/app/actions/account";
import { AddressFields } from "@/components/store/checkout/address-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SavedAddress } from "@/lib/services/addresses";
import { savedAddressSchema } from "@/lib/validation/checkout";
import type { z } from "zod";

type FormValues = z.input<typeof savedAddressSchema>;
const EMPTY: FormValues = { label: "home", isDefault: false, fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: undefined as never, pincode: "" };

export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ resolver: zodResolver(savedAddressSchema), defaultValues: EMPTY });
  const [watchedLabel, watchedDefault] = useWatch({ control: form.control, name: ["label", "isDefault"] });

  const open = (address: SavedAddress | "new") => {
    form.reset(address === "new" ? { ...EMPTY, isDefault: addresses.length === 0 } : { ...address });
    setEditing(address);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveAddressAction(values, editing && editing !== "new" ? editing.id : undefined);
    if (!result.ok) {
      if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setEditing(null);
    router.refresh();
  });

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="flex flex-col gap-3 rounded-3xl border bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <MapPin className="size-4 text-brand-teal" aria-hidden /> {a.fullName}
              </p>
              <div className="flex gap-1.5">
                <Badge variant="outline" className="capitalize">
                  {a.label}
                </Badge>
                {a.isDefault ? <Badge>Default</Badge> : null}
              </div>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {[a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : null].filter(Boolean).join(", ")}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              +91 {a.phone}
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => open(a)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              {!a.isDefault ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDefaultAddressAction(a.id))}>
                  <Star className="size-3.5" /> Make default
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => run(() => deleteAddressAction(a.id))}>
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => open("new")}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed bg-white/60 p-5 font-semibold text-brand-green hover:border-brand-teal"
        >
          <Plus className="size-6" aria-hidden /> Add a new address
        </button>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add address" : "Edit address"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <AddressFields form={form} prefix="" section="book" />
            <div className="flex flex-wrap items-center gap-6">
              <RadioGroup value={watchedLabel} onValueChange={(v) => form.setValue("label", v as FormValues["label"])} className="flex gap-4" aria-label="Address type">
                {(["home", "work", "other"] as const).map((label) => (
                  <Label key={label} className="flex items-center gap-2 font-normal capitalize">
                    <RadioGroupItem value={label} /> {label}
                  </Label>
                ))}
              </RadioGroup>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={watchedDefault} onCheckedChange={(c) => form.setValue("isDefault", c === true)} /> Set as default
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save address
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
