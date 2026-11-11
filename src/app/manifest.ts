import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golf scorecard",
    short_name: "Scorecard",
    description: "A simple digital scorecard for your round of golf.",
    start_url: "/?course=north-course",
    display: "standalone",
    background_color: "#f1f3ef",
    theme_color: "#2f6857",
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