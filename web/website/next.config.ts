import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Enable static exports
  distDir: "out", // Output directory for built files
  images: {
    unoptimized: true, // Required for static export
  },
  // Ensure trailing slashes for clean URLs when hosted on static hosting
  trailingSlash: true,
  // Temporarily disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Temporarily disable ESLint checking during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
