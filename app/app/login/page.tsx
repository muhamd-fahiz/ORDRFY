import { redirect } from "next/navigation";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { ordrfyFontVariables } from "@/lib/design/fonts";
import { LoginForm } from "./login-form";

export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const state = await getOwnerSessionState();

  switch (state.status) {
    case "ready":
      redirect("/app/today");
    case "signed_out":
    case "no_membership":
      break;
  }

  return (
    <main className={`${ordrfyFontVariables} flex min-h-screen flex-col justify-center bg-paper font-app`}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Chats in. <span className="text-pink">Orders out.</span>
          </h1>
          <p className="mt-2 text-sm text-ink-70">Sign in to your Ordrfy account.</p>
        </div>
        {error === "no_membership" && (
          <p className="rounded-lg bg-attention-soft p-2 text-sm text-attention">
            That account isn&apos;t linked to a business yet. Contact Ordrfy support.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
