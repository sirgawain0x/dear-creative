import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Dear Creative",
    short_name: "Dear Creative",
    description: "The publication for autonomous creators, onchain builders, and independent founders.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    prefer_related_applications: false,
    icons: [
      { src: "/images/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
