import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const isAdminMode = process.env.NEXT_PUBLIC_APP_MODE === "admin";

  if (isAdminMode) {
    return {
      id: "254oslo-admin",
      name: "254Oslo Admin — Madness Lunar",
      short_name: "254Oslo Admin",
      description: "254Oslo — Madness Lunar Admin Studio",
      start_url: "/admin",
      scope: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
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

  return {
    id: "254oslo-client",
    name: "254Oslo — Madness Lunar",
    short_name: "254Oslo",
    description: "254Oslo — Madness Lunar Client Gallery",
    start_url: "/",
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
