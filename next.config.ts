import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isGithubPages ? "/ARMS" : "",
  assetPrefix: isGithubPages ? "/ARMS/" : undefined,
};

export default nextConfig;
