import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Allow isolated builds (e.g. ARMS_DIST_DIR=.next-isolated) when .next is contended.
  distDir: process.env.ARMS_DIST_DIR || ".next",
  basePath: isGithubPages ? "/ARMS" : "",
  assetPrefix: isGithubPages ? "/ARMS/" : undefined,
};

export default nextConfig;
