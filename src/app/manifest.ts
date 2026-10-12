import type { MetadataRoute } from "next";

// Lets members add the site to their home screen; iPhones only allow Web Push for installed sites.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flowly Pilates",
    short_name: "Flowly",
    description: "Reformer ders programı ve rezervasyonların.",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f1edda",
    theme_color: "#f1edda",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
