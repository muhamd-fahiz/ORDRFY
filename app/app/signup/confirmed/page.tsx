import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { ConfirmedClient } from "./confirmed-client";

export default function SignupConfirmedPage() {
  return (
    <AuthPageShell>
      <div>
        <h1 className="font-display text-xl font-bold text-ink">One moment...</h1>
      </div>
      <ConfirmedClient />
    </AuthPageShell>
  );
}
