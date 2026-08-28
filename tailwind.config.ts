import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
