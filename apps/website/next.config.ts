import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitSha = (() => {
  if (process.env.NEXT_PUBLIC_GIT_SHA) return process.env.NEXT_PUBLIC_GIT_SHA;
  try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "dev"; }
})();

const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString().split("T")[0];

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
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
};

export default nextConfig;
