import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the app can be
  // shipped as an npm package and launched with `npx agentsessions`.
  output: "standalone",
};

export default nextConfig;
