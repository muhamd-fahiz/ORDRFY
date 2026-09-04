import { redirect } from "next/navigation";
import Link from "next/link";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const state = await getOwnerSessionState();

  switch (state.status) {
    case "ready":
      redirect("/app/today");
    case "no_membership_has_draft":
    case "no_membership_no_draft":
      redirect("/onboarding");
    case "signed_out":
    case "no_membership_admin_account":
      break;
  }

  return (
    <AuthPageShell>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Chats in. <span className="text-pink">Orders out.</span>
        </h1>
        <p className="mt-2 text-sm text-ink-70">Create your Ordrfy account.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-ink-70">
        Already have an account?{" "}
        <Link href="/app/login" className="text-ink underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
