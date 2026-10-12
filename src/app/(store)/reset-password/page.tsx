import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/store/auth/auth-forms";
import { AuthShell } from "@/components/store/auth/auth-shell";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="For your security, this link can be used only once.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
