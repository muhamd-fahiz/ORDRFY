import { redirect } from "next/navigation";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { ChallengeForm } from "./challenge-form";

export default async function MfaChallengePage() {
  const state = await getAdminSessionState();

  switch (state.status) {
    case "signed_out":
      redirect("/admin/login");
    case "not_admin":
      redirect("/admin/login?error=not_admin");
    case "needs_mfa_enrollment":
      redirect("/admin/mfa/enroll");
    case "ready":
      redirect("/admin/businesses");
    case "needs_mfa_challenge":
      break;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <div>
        <h1 className="font-display text-xl font-bold">Enter your authenticator code</h1>
        <p className="font-app text-sm text-ink-70">Open your authenticator app and enter the current code.</p>
      </div>
      <ChallengeForm />
    </main>
  );
}
