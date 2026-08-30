import { redirect } from "next/navigation";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const state = await getAdminSessionState();

  // Already signed in with a real session -- send them wherever that session actually needs
  // to go next, rather than showing the login form again.
  switch (state.status) {
    case "needs_mfa_enrollment":
      redirect("/admin/mfa/enroll");
    case "needs_mfa_challenge":
      redirect("/admin/mfa/challenge");
    case "ready":
      redirect("/admin/businesses");
    case "signed_out":
    case "not_admin":
      break;
  }

  return (
    <AuthPageShell>
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Ordrfy Admin</h1>
        <p className="font-app text-sm text-ink-70">Sign in with your admin account.</p>
      </div>
      {error === "not_admin" && (
        <p className="rounded-lg bg-attention-soft p-2 font-app text-sm text-attention">
          That account is not an admin account.
        </p>
      )}
      <LoginForm />
    </AuthPageShell>
  );
}
