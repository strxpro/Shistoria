/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // Preflight OFF: the site already has its own reset/typography in styles.css.
  // We only want Tailwind's utility classes, not its global base reset.
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
