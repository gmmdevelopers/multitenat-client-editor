import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.1.197",
    "salud-bienestar.multitenant.test",
  ],
  transpilePackages: ["@multitenant/design-system"],
};

export default nextConfig;
