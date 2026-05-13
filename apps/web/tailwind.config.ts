import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
      },
      colors: {
        ink: "#0a0a0a",
        accent: "#2563eb",
        muted: "#6b7280",
      },
    },
  },
  plugins: [],
} satisfies Config;
