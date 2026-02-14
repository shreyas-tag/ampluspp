/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f8fd',
          100: '#e7f0fb',
          500: '#1f4e79',
          600: '#173a5b'
        }
      },
      boxShadow: {
        soft: '0 8px 24px rgba(15, 23, 42, 0.07)'
      }
    }
  },
  plugins: []
};
