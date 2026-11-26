import type { NextConfig } from "next";

/**
 * Unwritten POC app. Local only, all viewer state on the device.
 *
 * Cache Components (and Partial Prefetching, which requires it) are left OFF on
 * purpose: this app has no server data, and with them on every route is kept
 * mounted-but-hidden after navigation (a hidden <video> keeps playing) and any
 * clock read during prerender is a build error. See docs/contracts.md, section
 * "Next.js settings".
 */
const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
