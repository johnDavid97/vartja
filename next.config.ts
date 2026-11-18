import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Protected media must be fetched by the visitor's browser with its session cookie.
  // Disable the public image optimizer/cache rather than proxying private files through it.
  images: { unoptimized: true },
  // Keep a single Payload runtime across config/RSC and REST chunks. Bundled copies
  // break instanceof checks and strip field-validation details in production.
  serverExternalPackages: ["payload"],
  async redirects() {
    return [{ source: "/tidsplan", destination: "/news", permanent: true }];
  },
  experimental: {
    agentFeedback: false,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // Keep CSS Modules' class-name exports; the Tailwind loader emits global CSS.
        condition: { all: [{ not: "foreign" }, { not: { path: "*.module.css" } }] },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withPayload(nextConfig);
