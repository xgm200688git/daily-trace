import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      fs: false,
      path: false,
    };
    return config;
  },
  serverExternalPackages: ["node:crypto", "node:fs", "node:path"],
};

export default nextConfig;
