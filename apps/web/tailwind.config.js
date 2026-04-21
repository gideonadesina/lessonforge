/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        dark: {
          50: "#f8f8f8",
          100: "#e3e3e3",
          900: "#1a1a1a",
        },
      },
    },
  },
  plugins: [],
};

