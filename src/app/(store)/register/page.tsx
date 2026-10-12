import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/store/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/store/auth/auth-shell";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: true } };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Track orders, save addresses and check out faster."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
