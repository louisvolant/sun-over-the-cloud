// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
       'fade-in': 'fadeIn 0.3s ease-in-out',
       'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
       'spin-slow': 'spin 3s linear infinite',
       'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#3B82F6", // Blue-500
        "primary-focus": "#2563EB", // Blue-600
        secondary: "#8B5CF6", // Purple-500
        "secondary-focus": "#7C3AED", // Purple-600
      },
      spacing: {
        'container': 'max-width: 80rem',
      },
    },
  },
  plugins: [],
} satisfies Config;