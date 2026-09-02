import { ordrfyFontVariables } from "@/lib/design/fonts";

// Same pattern as app/admin/layout.tsx and app/app/(protected)/layout.tsx: wires the Carbon
// Pink font variables for this route group only, leaving the root layout (app/layout.tsx)
// untouched for whatever the (marketing) group doesn't cover. Horizontal-overflow protection
// on the root wrapper matches the design handoff's own note about the pricing card's hard
// shadow not causing horizontal scroll at narrow widths -- uses `clip`, not `hidden`: a real
// bug found live (the sticky marketing header stopped sticking on scroll) traced to
// `overflow-x: hidden` on this ancestor, which -- per the CSS overflow spec -- forces a
// computed `overflow-y: auto` too, turning this div into a scroll container that
// MarketingHeader's `position: sticky` then resolves against instead of the viewport.
// `overflow: clip` clips the same visual overflow without establishing a scroll container,
// so it doesn't have this side effect on sticky descendants.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${ordrfyFontVariables} min-h-screen overflow-x-clip bg-ink font-app text-paper`}>{children}</div>
  );
}
