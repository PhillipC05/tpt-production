import { uiTailwindBase } from "./src/tailwind";

const config = {
  ...uiTailwindBase,
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;