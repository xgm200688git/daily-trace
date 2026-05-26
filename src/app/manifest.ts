import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "每日轨迹",
    short_name: "每日轨迹",
    description: "记录生活、工作任务，并自动生成日报和周报。",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#181411",
    orientation: "portrait",
    categories: ["productivity", "lifestyle"],
    lang: "zh-CN",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
