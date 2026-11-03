import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
          bg: "var(--destructive-bg)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
          bg: "var(--warning-bg)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
          bg: "var(--info-bg)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(15, 27, 45, 0.05)",
        card: "0 1px 3px 0 rgba(15, 27, 45, 0.06), 0 1px 2px -1px rgba(15, 27, 45, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
