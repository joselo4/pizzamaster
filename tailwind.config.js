/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#F97316", // Naranja
        dark: "#121212",    // Fondo Oscuro
        card: "#1E1E1E",    // Tarjetas
        // Colores personalizados de la UI para garantizar el contraste
        zinc: {
          450: "#8b8b93",
          550: "#62626a",
          650: "#494950",
          850: "#202023",
          955: "#0d0d0f",
        },
        slate: {
          355: "#b2c0d1",
          550: "#56657a",
          650: "#3d4b5f",
          955: "#080c16",
        },
        orange: {
          355: "#fca658",
          650: "#d64c0c",
          655: "#cf480c",
        },
        purple: {
          605: "#882be2",
        },
        green: {
          655: "#159143",
        },
        yellow: {
          605: "#b57606",
        },
        gray: {
          850: "#18202e",
        },
      },
    },
  },
  plugins: [],
}