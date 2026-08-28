import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Admin panel only (Phase 1) -- stays as-is. The admin UI is deliberately
        // functional-only (CLAUDE.md "what NOT to build in V1"), never restyled with the
        // owner-app/marketing design system below.
        brand: {
          DEFAULT: "#0F5C5C",
          foreground: "#FFFFFF",
        },
        status: {
          paid: "#16A34A",
          pending: "#D97706",
          overdue: "#DC2626",
          info: "#2563EB",
        },

        // Owner app + marketing site design system ("Carbon Pink" -- approved 2026-08-28).
        // Namespaced separately from brand/status above so the two surfaces never collide.
        ink: {
          DEFAULT: "#14171F",
          70: "#3C3F49",
          40: "#8B8D97",
          15: "#E4E3E0",
        },
        paper: {
          DEFAULT: "#FAF9F7",
          raised: "#FFFFFF",
        },
        pink: {
          DEFAULT: "#E0117F",
          strong: "#B10E63",
        },
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
    },
  },
  plugins: [],
};

export default config;
