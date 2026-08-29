import { notFound } from "next/navigation";
import { ordrfyFontVariables } from "@/lib/design/fonts";

// Scoped to this route only, via the wrapper div's className below -- the root layout
// (app/layout.tsx) is untouched by the Carbon Pink design system (/admin/* now uses it too,
// wired separately in app/admin/layout.tsx per ADR-0021).
//
// Dev-only reference, not a real product screen: 404s outright in production so it's never
// a live, unauthenticated route in a real deployment, not just "nothing links to it."
// robots.txt disallows it too (app/robots.ts), but that only asks crawlers not to index it
// -- this is the actual access boundary.
export default function DesignPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className={`${ordrfyFontVariables} min-h-screen bg-paper font-app text-ink`}>
      {children}
    </div>
  );
}
