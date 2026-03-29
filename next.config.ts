import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["node:crypto", "node:fs", "node:path"],
};

export default nextConfig;
