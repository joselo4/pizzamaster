/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#F97316", // Naranja
        dark: "#121212",    // Fondo Oscuro
        card: "#1E1E1E",    // Tarjetas
      },
    },
  },
  plugins: [],
}