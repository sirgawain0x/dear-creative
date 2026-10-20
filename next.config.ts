import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["kokoro-js", "@huggingface/transformers", "onnxruntime-node"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      return config;
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": false,
    };
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });
    return config;
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
