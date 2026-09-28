import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#0B0F17",
          surface: "#111827",
          border: "#1E293B",
          muted: "#64748B",
          text: "#E2E8F0",
          cyan: "#00F2FE",
          teal: "#23D5AB",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grid-vault":
          "linear-gradient(to right, rgba(0,242,254,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,242,254,0.04) 1px, transparent 1px)",
        "gradient-radial-vault":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(35,213,171,0.15), transparent)",
        "gradient-wallet":
          "linear-gradient(135deg, #23D5AB 0%, #00F2FE 100%)",
        "gradient-neon":
          "linear-gradient(135deg, #00F2FE 0%, #23D5AB 100%)",
      },
      boxShadow: {
        neon: "0 0 24px rgba(0, 242, 254, 0.25)",
        "neon-sm": "0 0 12px rgba(35, 213, 171, 0.2)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
