"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, type FieldValues, type Path, type PathValue, type UseFormReturn } from "react-hook-form";
import { MapPin } from "lucide-react";
import { lookupPincodeAction } from "@/app/actions/catalog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATE_NAMES } from "@/lib/india";

/** A form of any shape; transformed (resolver output) values are irrelevant to these inputs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyForm<T extends FieldValues> = UseFormReturn<T, any, any>;

function errorAt(errors: unknown, path: string): { message?: string } | undefined {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), errors) as
    | { message?: string }
    | undefined;
}

export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
  optional,
  className,
}: {
  form: AnyForm<T>;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  placeholder?: string;
  maxLength?: number;
  optional?: boolean;
  className?: string;
}) {
  const id = name.replace(/\./g, "-");
  const error = errorAt(form.formState.errors, name);
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        className="h-11"
        {...form.register(name as Path<T>)}
      />
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}

/** Indian address fields with PIN-code based city/state autofill. */
export function AddressFields<T extends FieldValues>({ form, prefix, section }: { form: AnyForm<T>; prefix: string; section: string }) {
  const p = (field: string) => (prefix ? `${prefix}.${field}` : field);
  const pincode = form.watch(p("pincode") as Path<T>) as string | undefined;
  const [detected, setDetected] = useState<string | null>(null);
  const lastLookup = useRef<string | null>(null);

  useEffect(() => {
    if (!pincode || !/^[1-9]\d{5}$/.test(pincode) || lastLookup.current === pincode) return;
    lastLookup.current = pincode;
    let active = true;
    lookupPincodeAction(pincode).then((info) => {
      if (!active || !info) {
        if (active) setDetected(null);
        return;
      }
      if (info.city && !form.getValues(p("city") as Path<T>)) {
        form.setValue(p("city") as Path<T>, info.city as PathValue<T, Path<T>>, { shouldValidate: true });
      }
      if (info.state) form.setValue(p("state") as Path<T>, info.state as PathValue<T, Path<T>>, { shouldValidate: true });
      setDetected([info.city, info.state].filter(Boolean).join(", "));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  const stateError = errorAt(form.formState.errors, p("state"));
  const stateId = `${section}-state`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField form={form} name={p("fullName")} label="Full name" autoComplete={`section-${section} name`} />
      <TextField form={form} name={p("phone")} label="Mobile number" type="tel" inputMode="tel" autoComplete={`section-${section} tel-national`} placeholder="10-digit mobile" maxLength={14} />
      <TextField form={form} name={p("line1")} label="House / flat no., building, street" autoComplete={`section-${section} address-line1`} className="sm:col-span-2" />
      <TextField form={form} name={p("line2")} label="Area, colony, locality" autoComplete={`section-${section} address-line2`} optional className="sm:col-span-2" />
      <TextField form={form} name={p("landmark")} label="Landmark" optional />
      <div className="space-y-1">
        <TextField form={form} name={p("pincode")} label="PIN code" inputMode="numeric" autoComplete={`section-${section} postal-code`} maxLength={6} />
        {detected ? (
          <p className="flex items-center gap-1 text-xs text-emerald-700">
            <MapPin className="size-3" aria-hidden /> {detected}
          </p>
        ) : null}
      </div>
      <TextField form={form} name={p("city")} label="City / town" autoComplete={`section-${section} address-level2`} />
      <Field data-invalid={!!stateError}>
        <FieldLabel htmlFor={stateId}>State / UT</FieldLabel>
        <Controller
          control={form.control}
          name={p("state") as Path<T>}
          render={({ field }) => (
            <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
              <SelectTrigger id={stateId} className="h-11 w-full" aria-invalid={!!stateError}>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {INDIAN_STATE_NAMES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={stateError ? [stateError] : undefined} />
      </Field>
    </div>
  );
}
