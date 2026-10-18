import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./constants/**/*.{js,ts,jsx,tsx,mdx}",
    "./mock/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          25: "#f4f8ff",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#0f172a",
        },
        /**
         * 接近微信小程序设计稿的基色
         * @see 页面灰底 / 主副文案 / 线色 / 链接色 / 主色
         */
        wx: {
          page: "#f0f2f5",
          line: "rgba(15, 23, 42, 0.08)",
          text: "#111827",
          subtext: "#6b7280",
          link: "#1d4ed8",
          brand: "#07c160",
          cells: "#fcfcfd",
          tap: "rgba(15, 23, 42, 0.04)",
        },
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.10)",
        wx: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)",
        device:
          "0 16px 48px -8px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.75)",
        /** 企业向卡片：略偏蓝的投影，层次更明显 */
        surface:
          "0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 16px 32px -12px rgba(30, 64, 175, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04)",
        surfaceLg:
          "0 8px 10px -3px rgba(15, 23, 42, 0.08), 0 24px 44px -16px rgba(37, 99, 235, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.04)",
        tab: "0 -6px 24px -2px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)",
      },
      borderRadius: {
        wx: "10px",
        saas: "16px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
