import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace files relative to monorepo root so shared packages are included
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@tpt/ui"],
};

export default nextConfig;
