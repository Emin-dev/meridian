import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The app is authed; keep API + auth surfaces out of crawlers.
      disallow: ["/api/", "/login"],
    },
    host: siteUrl,
  };
}
