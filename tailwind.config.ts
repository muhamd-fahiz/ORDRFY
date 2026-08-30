import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Product-wide design system ("Carbon Pink" -- approved 2026-08-28, extended to the
        // admin panel 2026-08-30 per ADR-0021, superseding ADR-0016's "admin stays untouched"
        // decision). The admin panel's original brand/status tokens were deleted, not kept
        // alongside these -- they had no remaining callers once every admin page was
        // restyled, and CLAUDE.md's structure discipline says obsolete things get removed,
        // not left in "just in case."
        ink: {
          DEFAULT: "#14171F",
          70: "#3C3F49",
          40: "#8B8D97",
          15: "#E4E3E0",
          // raised added for the marketing site (ADR-0022) -- incoming chat-bubble surface,
          // one step lighter than ink.DEFAULT.
          raised: "#1F1C1A",
        },
        paper: {
          DEFAULT: "#FAF9F7",
          raised: "#FFFFFF",
          // warm added for the marketing site (ADR-0022) -- foreground text/icon color on a
          // pink background, distinct from paper.DEFAULT which is a background tone.
          warm: "#FFF9F2",
        },
        pink: {
          DEFAULT: "#E0117F",
          strong: "#B10E63",
          // hover added for the marketing site (ADR-0022) -- brightens on hover, the opposite
          // direction from pink.strong's darken-on-hover used elsewhere in the product. Two
          // different hover directions for the same base color is why this is its own token
          // rather than reusing pink.strong for marketing too.
          hover: "#FF2B95",
        },
        // highlight added for the marketing site (ADR-0022) -- the due-date badge yellow on
        // the order-slip device. Not part of the original Carbon Pink palette (ADR-0016).
        highlight: "#FFD84D",
        confirmed: {
          DEFAULT: "#1C8A56",
          soft: "#E4F4EC",
        },
        attention: {
          DEFAULT: "#9A6317",
          soft: "#FBF0DC",
        },
        vertical: {
          fashion: "#C0356B",
          tutor: "#3454D1",
          service: "#0E8074",
          baker: "#B5651D",
          gift: "#7B4FA3",
        },
      },
      fontFamily: {
        display: ["var(--font-unbounded)", "Arial Black", "sans-serif"],
        app: ["var(--font-hanken)", "-apple-system", "Segoe UI", "sans-serif"],
        data: ["var(--font-space-mono)", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      spacing: {
        "1": "8px",
        "2": "16px",
        "3": "24px",
        "4": "32px",
      },
      keyframes: {
        // The marketing verticals tab switch (ADR-0022) -- always paired with the
        // motion-safe: variant at the call site, per the handoff's own accessibility notes
        // ("honour prefers-reduced-motion by dropping the slipin animation").
        slipin: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        slipin: "slipin 280ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
