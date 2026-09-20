import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.GITHUB_PAGES === "1" ? "/threadmark" : undefined,
  reactStrictMode: true,
  agentRules: false,
};

export default nextConfig;
