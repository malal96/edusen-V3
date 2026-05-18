/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,html}'
  ],
  theme: {
    extend: {
      colors: {
        // Palette EduSen (vert/doré)
        green: {
          deep: '#1a4731',
          mid: '#2d7a4f',
          pale: '#e8f5ee',
          olive: '#5d8a5e'
        },
        gold: {
          DEFAULT: '#c9933a',
          light: '#fef3c7',
          dark: '#9a6b1e'
        },
        red: {
          soft: '#e05252'
        },
        text: {
          DEFAULT: '#2d3a2c',
          mid: '#5a6a55',
          muted: '#9aa399'
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f8faf5',
          dark: '#0a1f15'
        }
      },
      fontFamily: {
        head: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
};
