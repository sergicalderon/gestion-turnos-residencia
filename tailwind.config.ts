import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        line: "#dce3df",
        paper: "#f7f9f6",
        moss: "#51685c",
        mint: "#d9efe5",
        coral: "#c95d4f",
        saffron: "#d79c22"
      },
      boxShadow: {
        subtle: "0 1px 2px rgb(23 32 27 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
