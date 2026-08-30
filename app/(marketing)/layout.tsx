import { ordrfyFontVariables } from "@/lib/design/fonts";

// Same pattern as app/admin/layout.tsx and app/app/(protected)/layout.tsx: wires the Carbon
// Pink font variables for this route group only, leaving the root layout (app/layout.tsx)
// untouched for whatever the (marketing) group doesn't cover. overflow-x-hidden on the root
// wrapper matches the design handoff's own note about the pricing card's hard shadow not
// causing horizontal scroll at narrow widths.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${ordrfyFontVariables} min-h-screen overflow-x-hidden bg-ink font-app text-paper`}>{children}</div>
  );
}
