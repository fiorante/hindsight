/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Noto Sans", "Ubuntu", "Cantarell", "Helvetica Neue", "Arial", "sans-serif"],
      },
      colors: {
        // NASA JPL Stellar Design System colors
        stellar: {
          // Light mode colors
          'background': '#ffffff',
          'surface': '#f8fafc',
          'text-primary': '#1e293b',
          'text-secondary': '#64748b',
          'border': '#e2e8f0',
          // Accent shades chosen to satisfy WCAG AA contrast (>= 3:1 for non-text UI,
          // >= 4.5:1 for text) against both the dark navy chart bg (#020817) and the
          // dominant Martian bedrock terrain (#8B4513). Older #3b82f6 / #60a5fa
          // failed against the terrain.
          'accent': '#7dd3fc',

          // Dark mode colors based on NASA JPL Stellar design system
          'dark-background': '#020817',
          'dark-surface': '#0D1525',
          'dark-surface-elevated': '#1E293B',
          // Off-white shade from the navy palette — used for CTA button
          // backgrounds that previously used pure white (which is too bright
          // against the dark navy UI). Pairs with black text.
          'cta': '#cbd5e1',
          'dark-text-primary': '#f1f5f9',
          'dark-text-secondary': '#94a3b8',
          'dark-border': '#475569',
          'dark-accent': '#7dd3fc',

          // Status colors for both themes
          'success': '#10b981',
          'warning': '#f59e0b',
          // `error` and `fault-red` both resolve to the runtime CSS variable
          // `--fault-red` (declared in index.css, default #E84141, source-of-
          // truth constant FAULT_RED in src/constants/drivePresentation.ts).
          // The dev FaultRedPicker mutates this variable live; changing the
          // baked-in default requires editing FAULT_RED in one place.
          'error': 'var(--fault-red)',
          'info': '#7dd3fc',
          'fault-red': 'var(--fault-red)',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

