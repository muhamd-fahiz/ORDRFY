import type { ReactNode } from "react";
import { ordrfyFontVariables } from "@/lib/design/fonts";

interface StatusPageProps {
  eyebrow: string;
  title: string;
  message: string;
  action: ReactNode;
}

/**
 * Shared shell for error.tsx/not-found.tsx across all three surfaces (marketing/owner-app/
 * admin) -- self-contained font wiring (like app/app/login/page.tsx already does) rather
 * than relying on a parent layout, since a thrown error can originate above a surface's own
 * layout and Next.js doesn't run that layout's font wrapper in that case. One component so
 * a future redesign of "what an error page looks like" happens in one place, not six.
 */
export function StatusPage({ eyebrow, title, message, action }: StatusPageProps) {
  return (
    <main className={`${ordrfyFontVariables} flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-16 font-app text-ink`}>
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <span className="font-data text-xs font-bold tracking-[0.16em] text-pink">{eyebrow}</span>
        <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        <p className="text-sm text-ink-70">{message}</p>
        {action}
      </div>
    </main>
  );
}
