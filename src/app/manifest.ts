import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ovelia — Home & Car Cleaning Essentials",
    short_name: "Ovelia",
    description: "Dishwash, floor, kitchen, bathroom, glass and car care essentials.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b4d3b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
