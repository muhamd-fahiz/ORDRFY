import { redirect } from "next/navigation";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { EnrollForm } from "./enroll-form";

export default async function MfaEnrollPage() {
  const state = await getAdminSessionState();

  switch (state.status) {
    case "signed_out":
      redirect("/admin/login");
    case "not_admin":
      redirect("/admin/login?error=not_admin");
    case "needs_mfa_challenge":
      redirect("/admin/mfa/challenge");
    case "ready":
      redirect("/admin/businesses");
    case "needs_mfa_enrollment":
      break;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <div>
        <h1 className="text-xl font-semibold">Set up two-factor authentication</h1>
        <p className="text-sm text-neutral-500">
          Admin accounts require an authenticator app (e.g. Google Authenticator, Authy) before
          you can continue.
        </p>
      </div>
      <EnrollForm />
    </main>
  );
}
