import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Phone testing over a Cloudflare quick tunnel (APP_URL=https://<random>.trycloudflare.com).
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The seeded "Gmail inbox" is read from disk at runtime by the receipts pipeline.
  outputFileTracingIncludes: {
    "/api/receipts/sync": ["./supabase/seeds/receipts/**"],
  },
  // Native / WASM image decoders stay out of the server bundle.
  serverExternalPackages: ["sharp", "heic-convert"],
};

export default nextConfig;
