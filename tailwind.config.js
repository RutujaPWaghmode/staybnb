/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.{html,ejs}"],
  safelist: [
    // Rose colors
    'bg-rose-500',
    'bg-rose-600',
    'bg-rose-100',
    'bg-rose-50',
    'hover:bg-rose-500',
    'hover:bg-rose-600',
    'text-rose-500',
    'text-rose-600',
    'text-rose-700',
    'border-rose-500',
    'focus:ring-rose-500',
    'focus:border-rose-500',
    // Responsive utilities
    'sm:grid-cols-2',
    'md:grid-cols-2',
    'md:grid-cols-3',
    'lg:grid-cols-3',
    'lg:grid-cols-4',
    'xl:grid-cols-4',
    'sm:flex-row',
    'md:flex-row',
    'sm:p-6',
    'lg:p-8',
    'sm:gap-4',
    'lg:gap-6',
    'hidden',
    'sm:block',
    'md:block',
    'lg:block',
    'sm:hidden',
    'md:hidden',
    'lg:hidden',
    'w-full',
    'sm:w-auto',
    'md:w-auto',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}

