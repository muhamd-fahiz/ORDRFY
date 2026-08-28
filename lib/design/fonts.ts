import { Unbounded, Hanken_Grotesk, Space_Mono } from "next/font/google";

// Self-hosted by Next.js (next/font) -- no runtime request to Google Fonts, no layout
// shift. Each exposes a CSS variable consumed by tailwind.config.ts's fontFamily.display/
// app/data, so a font swap later is a one-line edit here, not a hunt through components.

export const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-unbounded",
  display: "swap",
});

export const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const ordrfyFontVariables = `${unbounded.variable} ${hankenGrotesk.variable} ${spaceMono.variable}`;
