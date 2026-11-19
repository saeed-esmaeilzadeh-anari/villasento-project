import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,

  experimental: {
    cpus: 8,
  },

  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;