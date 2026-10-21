import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import { optimizedImageRemotePatterns } from "./src/lib/images/optimized-remote-image-allowlist";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: optimizedImageRemotePatterns,
  },
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/adam/posts/*/repurpose/*": [
      "./node_modules/ffmpeg-static/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/sharp/**/*",
      "./src/assets/fonts/**/*",
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
