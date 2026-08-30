import Link from "next/link";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Reset your password</h1>
        <p className="mt-2 text-sm text-ink-70">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/app/login" className="text-xs text-ink-70 underline-offset-2 hover:underline">
        &larr; Back to sign in
      </Link>
    </AuthPageShell>
  );
}
