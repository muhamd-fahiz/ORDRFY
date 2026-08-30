import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ordrfy",
  description: "Chats in. Orders out.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning on <html>/<body> only -- the standard, narrow fix for a real
    // mobile Safari report where the hydration mismatch's own call stack pointed at the
    // <html> element itself (not any page content), which matches Next.js's own documented
    // cause: a browser (or an installed extension) can add attributes to these two elements
    // before React hydrates, which no app code controls. This does NOT suppress hydration
    // warnings anywhere else in the tree -- it's scoped to exactly these two elements.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
