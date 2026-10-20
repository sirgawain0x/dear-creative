import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/adam/posts/*/repurpose/*": [
      "./node_modules/ffmpeg-static/**/*",
      "./src/assets/fonts/**/*",
    ],
    "/api/adam/repurpose/diagnostics/*": ["./node_modules/ffmpeg-static/**/*"],
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
