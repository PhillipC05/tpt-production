import type { Config } from "tailwindcss";
import { uiTailwindBase } from "@tpt/ui/tailwind";

const config: Config = {
  ...uiTailwindBase,
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
