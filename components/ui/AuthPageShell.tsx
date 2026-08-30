import type { ReactNode } from "react";
import { ordrfyFontVariables } from "@/lib/design/fonts";
import { Logo } from "./Logo";
import { Copyright } from "./Copyright";

interface AuthPageShellProps {
  children: ReactNode;
}

/**
 * Shared shell for every unauthenticated auth page (login, forgot-password, reset-password
 * -- owner and admin both): self-contained font wiring (these pages sit outside any layout
 * that would otherwise provide it), the logo lockup, and a copyright line. Centering uses
 * explicit items-center on the flex container rather than relying only on the inner block's
 * mx-auto -- found genuinely off-center in a real browser at a wide viewport with mx-auto
 * alone, so this is the more robust of the two mechanisms, not a stylistic preference.
 */
export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main className={`${ordrfyFontVariables} flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10 font-app`}>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo variant="lockup" tone="on-paper" size="md" />
        {children}
      </div>
      <div className="mt-10">
        <Copyright tone="on-paper" />
      </div>
    </main>
  );
}
