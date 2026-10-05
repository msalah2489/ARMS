import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0f1612",
          900: "#16211b",
          800: "#1e2d25",
          700: "#2a3d33",
        },
        aroma: {
          50: "#f4f7f3",
          100: "#e4ece2",
          200: "#c5d6c0",
          400: "#6f9a68",
          500: "#4f7a48",
          600: "#3d6238",
          700: "#314e2e",
        },
        sand: {
          50: "#fbf7f0",
          100: "#f3eadb",
          200: "#e6d3b3",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        panel: "0 18px 40px -24px rgba(15, 22, 18, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
