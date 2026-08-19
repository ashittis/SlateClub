import type { MetadataRoute } from "next";

/**
 * PWA manifest. Only reachable now that the root layout is a server component —
 * the previous `"use client"` root silently dropped this along with every OG tag.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaset — your film diary",
    short_name: "Kaset",
    description:
      "Log the films you watch. Discover what's next. See what your friends watch.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#F4F1EA",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
