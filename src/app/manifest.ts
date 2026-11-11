import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Course Card",
    short_name: "Course Card",
    description: "A simple digital scorecard for your round of golf.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f3ef",
    theme_color: "#123c2b",
    orientation: "portrait",
    icons: [
      {
        src: "/golf-ball.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
