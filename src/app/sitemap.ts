import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/seo"

// Only public pages belong here; the dashboard and print pages are noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/login", siteUrl).toString(), changeFrequency: "yearly", priority: 1 }]
}
