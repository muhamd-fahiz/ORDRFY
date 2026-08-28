import { ordrfyFontVariables } from "@/lib/design/fonts";

// Scoped to this route only, via the wrapper div's className below -- the root layout
// (app/layout.tsx) and every /admin/* page are untouched by the Carbon Pink design system.
export default function DesignPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${ordrfyFontVariables} min-h-screen bg-paper font-app text-ink`}>
      {children}
    </div>
  );
}
