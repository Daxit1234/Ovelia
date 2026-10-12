import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/store/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/store/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Ovelia."
      footer={
        <>
          New to Ovelia? <AuthLink href="/register">Create an account</AuthLink>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
