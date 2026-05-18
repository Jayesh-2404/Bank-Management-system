import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f7f9",
        ink: "#111827",
        muted: "#64748b",
        line: "#dfe4ea",
        teal: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          500: "#079678",
          600: "#047b63",
          700: "#047857",
          800: "#065f46"
        },
        amber: {
          400: "#f7b731",
          500: "#e59f00"
        },
        slate: {
          950: "#0a0f1e",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b"
        }
      },
      boxShadow: {
        soft: "0 2px 8px rgba(15, 23, 42, 0.04)",
        panel: "0 4px 20px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
