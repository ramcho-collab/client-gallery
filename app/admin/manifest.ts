import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "254Oslo Admin — Madness Lunar",
    short_name: "254Oslo Admin",
    description: "254Oslo — Madness Lunar Gallery Admin",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#006600",
    theme_color: "#006600",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
