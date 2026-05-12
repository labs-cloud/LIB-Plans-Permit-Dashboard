import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        lib: {
          black: '#000000',
          softblack: '#231F20',
          orange: '#F47832',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro',
          'Inter',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
