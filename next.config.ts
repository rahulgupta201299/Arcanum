import type { NextConfig } from "next";

import pkg from "./package.json";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  reactStrictMode: true,
  transpilePackages: ["three"],
  experimental: { optimizePackageImports: ["@react-three/drei"] },
};

export default nextConfig;
