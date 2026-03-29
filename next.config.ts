import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["node:crypto", "node:fs", "node:path"],
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
