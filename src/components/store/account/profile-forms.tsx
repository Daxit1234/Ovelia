"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BadgeCheck, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { normalizeIndianMobile } from "@/lib/india";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
  marketingOptIn: z.boolean(),
});

export function ProfileForm({ initial, email, emailVerified }: { initial: z.infer<typeof profileSchema>; email: string; emailVerified: boolean }) {
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: initial });
  const marketingOptIn = useWatch({ control: form.control, name: "marketingOptIn" });
  const [sending, startSending] = useTransition();
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateProfileAction(values);
    if (result.ok) {
      toast.success(result.message);
      form.reset(values);
    } else toast.error(result.error);
  });
  const resendVerification = () =>
    startSending(async () => {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
      if (error) toast.error(error.message || "Could not send the email");
      else toast.success("Verification email sent");
    });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Email</p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {email}
          {emailVerified ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <BadgeCheck className="size-4" aria-hidden /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <MailWarning className="size-4" aria-hidden /> Not verified
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={resendVerification} disabled={sending}>
                Resend link
              </Button>
            </span>
          )}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
          <Input id="profile-name" autoComplete="name" className="h-11" {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="profile-phone">Mobile number</FieldLabel>
          <Input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel-national" className="h-11" {...form.register("phone")} />
          <FieldError errors={[errors.phone]} />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox checked={marketingOptIn} onCheckedChange={(c) => form.setValue("marketingOptIn", c === true, { shouldDirty: true })} />
        Email me offers and product updates
      </label>
      <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
        {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
      </Button>
    </form>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error: changeError } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (changeError) {
      setError(changeError.message || "Could not change your password.");
      return;
    }
    toast.success("Password changed. You've been signed out on other devices.");
    form.reset();
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <Field data-invalid={!!errors.currentPassword}>
        <FieldLabel htmlFor="current-password">Current password</FieldLabel>
        <Input id="current-password" type="password" autoComplete="current-password" className="h-11" {...form.register("currentPassword")} />
        <FieldError errors={[errors.currentPassword]} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.newPassword}>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input id="new-password" type="password" autoComplete="new-password" className="h-11" {...form.register("newPassword")} />
          <FieldError errors={[errors.newPassword]} />
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
          <Input id="confirm-password" type="password" autoComplete="new-password" className="h-11" {...form.register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
      </div>
      <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Change password
      </Button>
    </form>
  );
}
