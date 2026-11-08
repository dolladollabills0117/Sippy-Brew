import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sippy/core"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }, { protocol: "https", hostname: "images.unsplash.com" }] },
};

export default nextConfig;
