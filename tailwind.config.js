/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool Silver Premium — surface palette
        surface: {
          base: '#0c0d0f',
          1: '#151618',
          2: '#1c1d20',
          3: '#232428',
        },
        // CTA silver
        cta: {
          DEFAULT: '#e4e8ed',
          hover: '#f0f2f5',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      screens: {
        'xs': '360px',
        'sm': '481px',
        'md': '769px',
        'lg': '1025px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        'caption': ['0.6875rem', { lineHeight: '1rem' }],    // 11px
        'small': ['0.75rem', { lineHeight: '1rem' }],         // 12px
        'body': ['0.8125rem', { lineHeight: '1.25rem' }],     // 13px
        'section': ['0.9375rem', { lineHeight: '1.375rem' }], // 15px
        'title': ['1.5rem', { lineHeight: '1.875rem' }],      // 24px
        'stat': ['1.75rem', { lineHeight: '2rem' }],          // 28px
        // Keep standard Tailwind sizes for compatibility during migration
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      letterSpacing: {
        'heading': '-0.03em',
        'section': '-0.01em',
        'label': '0.06em',
      },
      boxShadow: {
        'card': '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2)',
        'card-hover': '0 0 0 1px rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.2)',
        'card-highlight': '0 0 0 1px rgba(228,232,237,0.15), 0 2px 4px rgba(0,0,0,0.2)',
        'modal': '0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4)',
        'input': '0 0 0 1px rgba(255,255,255,0.04)',
        'input-focus': '0 0 0 1px rgba(228,232,237,0.12)',
        'btn-primary': '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
      },
      minHeight: {
        '44': '11rem',
        '64': '16rem',
        '80': '20rem',
        '96': '24rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      zIndex: {
        '30': '30',  // sticky nav
        '40': '40',  // dropdowns
        '50': '50',  // modals
        '60': '60',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
