import type { MetadataRoute } from "next";
import { config } from "@/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.partyName,
    short_name: config.shortName,
    description: `${config.tagline} · ${config.location}`,
    start_url: "/schedule",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: config.brand.canvas,
    theme_color: config.brand.canvas,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
