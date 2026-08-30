import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { ResetPasswordForm } from "./reset-password-form";

export default function AdminResetPasswordPage() {
  return (
    <AuthPageShell>
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Set a new password</h1>
      </div>
      <ResetPasswordForm />
    </AuthPageShell>
  );
}
