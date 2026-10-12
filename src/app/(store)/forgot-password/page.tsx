import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/store/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/store/auth/auth-shell";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you use for Ovelia and we'll send you a secure link."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
