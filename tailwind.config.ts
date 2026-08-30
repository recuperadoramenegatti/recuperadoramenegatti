import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1536px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Paleta de identidade Menegatti
        menegatti: {
          bg: '#0A0F1E',
          card: '#111827',
          elevated: '#1A2332',
          amber: '#F59E0B',
          amberDark: '#D97706',
          blue: '#3B82F6',
          green: '#10B981',
          greenDark: '#059669',
          red: '#EF4444',
          purple: '#8B5CF6',
          indigo: '#6366F1',
        },
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-ia': 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        'gradient-sucesso': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-alerta': 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
        'gradient-azul': 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      },
      boxShadow: {
        // Segue o tema: no claro a sombra é suave, no escuro é profunda.
        card: 'var(--sombra-cartao)',
        'card-hover': 'var(--sombra-cartao-hover, var(--sombra-cartao))',
        glow: '0 0 0 1px rgba(245,158,11,0.25), 0 8px 32px rgba(245,158,11,0.15)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-badge': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-badge': 'pulse-badge 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease-out both',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
