import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          blue: "#0052FF",
          dark: "#0A0B0D",
          light: "#E3E7EF",
        },
      },
      fontFamily: {
        game: ['"Press Start 2P"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
