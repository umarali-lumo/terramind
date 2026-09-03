import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server (bound to localhost) to serve HMR/fonts/pages when the
  // browser visits via 127.0.0.1 — otherwise Next 16 blocks them as cross-origin.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
