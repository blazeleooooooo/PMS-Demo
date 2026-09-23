import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    // Breakpoints (default Tailwind):
    // sm 640  phone landscape
    // md 768  iPad portrait
    // lg 1024 iPad landscape / desktop chrome (sidebar becomes persistent)
    // xl 1280 desktop
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],    // 13px (was 12px)
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],    // 15px (was 14px)
        base: ['1.0625rem', { lineHeight: '1.625rem' }],  // 17px (was 16px)
        lg: ['1.1875rem', { lineHeight: '1.8125rem' }],   // 19px (was 18px)
        xl: ['1.375rem', { lineHeight: '1.9375rem' }],    // 22px (was 20px)
        '2xl': ['1.625rem', { lineHeight: '2.125rem' }],  // 26px (was 24px)
        '3xl': ['2rem', { lineHeight: '2.375rem' }],      // 32px (was 30px)
        '4xl': ['2.375rem', { lineHeight: '2.625rem' }],  // 38px (was 36px)
        '5xl': ['3.125rem', { lineHeight: '1' }],         // 50px (was 48px)
        '6xl': ['3.875rem', { lineHeight: '1' }],         // 62px (was 60px)
        '7xl': ['4.625rem', { lineHeight: '1' }],         // 74px (was 72px)
        '8xl': ['6.125rem', { lineHeight: '1' }],         // 98px (was 96px)
        '9xl': ['8.125rem', { lineHeight: '1' }],         // 130px (was 128px)
      },
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        bw: {
          navy: "#1A2035",
          "navy-light": "#232B42",
          "navy-hover": "#2A3352",
          bg: "#F5F6FA",
          blue: "#3B82F6",
          amber: "#F59E0B",
          violet: "#7C3AED",
          red: "#EF4444",
          teal: "#0D9488",
          green: "#10B981",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
