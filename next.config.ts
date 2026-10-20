import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.grove.storage",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.paragraph.xyz",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "paragraph.xyz",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withMDX = createMDX({});

export default withBotId(withMDX(nextConfig));
