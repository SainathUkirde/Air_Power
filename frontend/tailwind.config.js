/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0f1316',
        surface:  '#161b1f',
        panel:    '#1e252a',
        border:   '#2a3238',
        amber:    '#e8a317',
        threat:   '#d64545',
        muted:    '#57606a',
        text:     '#c9d1d9',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { DEFAULT: '2px', sm: '2px', md: '2px', lg: '2px', xl: '2px', full: '9999px' },
    },
  },
  plugins: [],
}
