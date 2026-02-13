import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Archival Editorial Theme
        parchment: {
          DEFAULT: '#F5F0E6',
          light: '#FFFEF8',
          dark: '#E8E3D5',
        },
        ink: {
          DEFAULT: '#3D3229',
          light: '#5A4F43',
          dark: '#2A231C',
        },
        wax: {
          red: '#8B2323',
          'red-light': '#A63535',
          'red-dark': '#6B1A1A',
        },
        faded: {
          DEFAULT: '#7D7469',
          light: '#9C8F80',
          dark: '#635A52',
        },
        cream: '#FFFEF8',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Source Serif 4', 'Georgia', 'serif'],
        ui: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-lg': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-md': ['2rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75' }],
        'body-md': ['1rem', { lineHeight: '1.75' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6' }],
        'ui-lg': ['1rem', { lineHeight: '1.5' }],
        'ui-md': ['0.875rem', { lineHeight: '1.5' }],
        'ui-sm': ['0.75rem', { lineHeight: '1.5' }],
      },
      spacing: {
        'section': '4rem',
        'section-sm': '2rem',
      },
      borderRadius: {
        'archival': '0.125rem', // Subtle, period-appropriate rounding
      },
      boxShadow: {
        'letter': '0 2px 8px rgba(61, 50, 41, 0.08), 0 1px 3px rgba(61, 50, 41, 0.12)',
        'letter-hover': '0 4px 16px rgba(61, 50, 41, 0.12), 0 2px 6px rgba(61, 50, 41, 0.16)',
      },
    },
  },
  plugins: [],
} satisfies Config
