"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLink, safeNext } from "@/components/store/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { normalizeIndianMobile } from "@/lib/india";

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

function PasswordInput({ id, register, autoComplete, invalid }: { id: string; register: UseFormRegisterReturn; autoComplete: string; invalid: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} aria-invalid={invalid} className="h-11 pr-11" {...register} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/* ---------------- Sign in ---------------- */

const loginSchema = z.object({ email: z.email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email: values.email, password: values.password, rememberMe: true });
    if (signInError) {
      setError(signInError.status === 429 ? "Too many attempts. Please wait a minute and try again." : signInError.message || "Invalid email or password.");
      return;
    }
    toast.success("Welcome back!");
    router.push(next);
    router.refresh();
  });
  const errors = form.formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {params.get("reset") === "1" ? (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="size-4 text-emerald-700" />
          <AlertDescription>Your password was reset. Please sign in with your new password.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="login-email">Email</FieldLabel>
        <Input id="login-email" type="email" autoComplete="email" className="h-11" aria-invalid={!!errors.email} {...form.register("email")} />
        <FieldError errors={[errors.email]} />
      </Field>
      <Field data-invalid={!!errors.password}>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <AuthLink href="/forgot-password">Forgot password?</AuthLink>
        </div>
        <PasswordInput id="login-password" register={form.register("password")} autoComplete="current-password" invalid={!!errors.password} />
        <FieldError errors={[errors.password]} />
      </Field>
      <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null} Sign in
      </Button>
    </form>
  );
}

/* ---------------- Register ---------------- */

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: z.email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
    password,
    confirmPassword: z.string(),
    marketingOptIn: z.boolean(),
    acceptTerms: z.boolean().refine((v) => v, "Please accept the terms to continue"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "", marketingOptIn: false, acceptTerms: false },
  });
  const [marketingOptIn, acceptTerms] = useWatch({ control: form.control, name: ["marketingOptIn", "acceptTerms"] });
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      phone: normalizeIndianMobile(values.phone) ?? undefined,
      marketingOptIn: values.marketingOptIn,
    });
    if (signUpError) {
      setError(signUpError.status === 429 ? "Too many attempts. Please try again shortly." : signUpError.message || "Could not create your account.");
      return;
    }
    toast.success("Account created! Check your inbox to confirm your email.");
    router.push(next);
    router.refresh();
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="reg-name">Full name</FieldLabel>
        <Input id="reg-name" autoComplete="name" className="h-11" aria-invalid={!!errors.name} {...form.register("name")} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="reg-email">Email</FieldLabel>
        <Input id="reg-email" type="email" autoComplete="email" className="h-11" aria-invalid={!!errors.email} {...form.register("email")} />
        <FieldError errors={[errors.email]} />
      </Field>
      <Field data-invalid={!!errors.phone}>
        <FieldLabel htmlFor="reg-phone">
          Mobile number <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id="reg-phone" type="tel" inputMode="tel" autoComplete="tel-national" className="h-11" aria-invalid={!!errors.phone} {...form.register("phone")} />
        <FieldError errors={[errors.phone]} />
      </Field>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="reg-password">Password</FieldLabel>
        <PasswordInput id="reg-password" register={form.register("password")} autoComplete="new-password" invalid={!!errors.password} />
        <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
        <FieldError errors={[errors.password]} />
      </Field>
      <Field data-invalid={!!errors.confirmPassword}>
        <FieldLabel htmlFor="reg-confirm">Confirm password</FieldLabel>
        <PasswordInput id="reg-confirm" register={form.register("confirmPassword")} autoComplete="new-password" invalid={!!errors.confirmPassword} />
        <FieldError errors={[errors.confirmPassword]} />
      </Field>
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox aria-label="Send me offers and product updates by email" checked={marketingOptIn} onCheckedChange={(c) => form.setValue("marketingOptIn", c === true)} className="mt-0.5" />
        <span>Send me offers and product updates by email (optional)</span>
      </label>
      <div>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox aria-label="I agree to the Terms and Privacy Policy" checked={acceptTerms} onCheckedChange={(c) => form.setValue("acceptTerms", c === true, { shouldValidate: true })} className="mt-0.5" />
          <span>
            I agree to the <AuthLink href="/policies/terms">Terms</AuthLink> and <AuthLink href="/policies/privacy">Privacy Policy</AuthLink>
          </span>
        </label>
        <FieldError errors={[errors.acceptTerms]} className="mt-1" />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null} Create account
      </Button>
    </form>
  );
}

/* ---------------- Forgot password ---------------- */

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.email("Enter a valid email") })), defaultValues: { email: "" } });
  const onSubmit = form.handleSubmit(async ({ email }) => {
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
    if (error && error.status === 429) {
      toast.error("Too many requests. Please try again in a few minutes.");
      return;
    }
    // Always show the same message so we don't reveal which emails are registered.
    setSent(true);
  });
  if (sent) {
    return (
      <Alert className="border-emerald-200 bg-emerald-50">
        <CheckCircle2 className="size-4 text-emerald-700" />
        <AlertDescription>If an account exists for that email, we&apos;ve sent a link to reset your password. The link is valid for 1 hour.</AlertDescription>
      </Alert>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field data-invalid={!!form.formState.errors.email}>
        <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
        <Input id="forgot-email" type="email" autoComplete="email" className="h-11" {...form.register("email")} />
        <FieldError errors={[form.formState.errors.email]} />
      </Field>
      <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null} Send reset link
      </Button>
    </form>
  );
}

/* ---------------- Reset password ---------------- */

const resetSchema = z.object({ password, confirmPassword: z.string() }).refine((v) => v.password === v.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const invalid = params.get("error") === "INVALID_TOKEN" || !token;
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirmPassword: "" } });
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return;
    const { error: resetError } = await authClient.resetPassword({ newPassword: values.password, token });
    if (resetError) {
      setError(resetError.message || "This reset link is invalid or has expired.");
      return;
    }
    router.push("/login?reset=1");
  });
  if (invalid) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This password reset link is invalid or has expired. <AuthLink href="/forgot-password">Request a new link</AuthLink>.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="reset-password">New password</FieldLabel>
        <PasswordInput id="reset-password" register={form.register("password")} autoComplete="new-password" invalid={!!errors.password} />
        <FieldError errors={[errors.password]} />
      </Field>
      <Field data-invalid={!!errors.confirmPassword}>
        <FieldLabel htmlFor="reset-confirm">Confirm new password</FieldLabel>
        <PasswordInput id="reset-confirm" register={form.register("confirmPassword")} autoComplete="new-password" invalid={!!errors.confirmPassword} />
        <FieldError errors={[errors.confirmPassword]} />
      </Field>
      <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null} Update password
      </Button>
    </form>
  );
}
