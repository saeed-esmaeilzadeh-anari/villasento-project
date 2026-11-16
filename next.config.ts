import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Pin the Turbopack workspace root to THIS directory. Without it Next infers
  // the root by scanning parent dirs for lockfiles — with two lockfiles present
  // (bun.lock + package-lock.json) it can pick a WRONG parent root and then
  // watch/glob far outside the project.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
