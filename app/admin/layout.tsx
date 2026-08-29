import { ordrfyFontVariables } from "@/lib/design/fonts";

// Applies the Carbon Pink font variables/base tokens to every /admin/* route (login, MFA,
// and the protected businesses section) in one place, same pattern as the owner app's
// app/app/(protected)/layout.tsx and app/design-preview/layout.tsx. Added 2026-08-30 per
// ADR-0021 -- the admin panel previously rendered in the browser's default font with no
// wrapper at all.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${ordrfyFontVariables} min-h-screen bg-paper font-app text-ink`}>{children}</div>;
}
