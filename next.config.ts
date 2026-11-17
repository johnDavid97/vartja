import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
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
