/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Usibras dark forest green — primary brand colour
        brand: {
          50:  '#eef4e9',
          100: '#d3e6c8',
          200: '#aed19f',
          300: '#85bb72',
          400: '#63a54d',
          500: '#548b3d',
          600: '#456836', // main brand — matches logo text
          700: '#35502a',
          800: '#26391d',
          900: '#172311',
          950: '#0c1409',
        },
        // Usibras lime green — accent (small icon piece, highlights)
        ocean: {
          50:  '#f3fbea',
          100: '#e1f5c5',
          200: '#c5ec92',
          300: '#a7e05d',
          400: '#8fd33b',
          500: '#8DC63F', // main accent
          600: '#72a031',
          700: '#587b25',
          800: '#3e5619',
          900: '#25330e',
          950: '#131c06',
        },
        // Cream page background from manual
        cream: {
          50:  '#f8f9f4',
          100: '#eef0e4',
          200: '#E8EBDA', // main background
          300: '#d4d9c5',
          400: '#b8c0a3',
          500: '#9ba584',
        },
        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        success: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
        warning: { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        error:   { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
      },
      animation: {
        'fade-in':       'fadeIn 0.3s ease-out',
        'slide-up':      'slideUp 0.4s ease-out',
        'slide-in-right':'slideInRight 0.3s ease-out',
        'scale-in':      'scaleIn 0.2s ease-out',
        'pulse-soft':    'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:      { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:      { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pulseSoft:    { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
};
