import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#197fe6',
        'primary-dark': '#1466b8',
        'primary-light': 'rgba(25,127,230,0.1)',
        'text-main': '#0e141b',
        'text-sub': '#4e7397',
        border: '#e7edf3',
        bg: '#f6f7f8',
      },
      fontFamily: {
        sans: ['var(--font-noto)', 'Inter', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
