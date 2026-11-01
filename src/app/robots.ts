import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/seo"

// Everything stays crawlable on purpose: private pages are excluded with a
// page-level noindex, which crawlers can only honour if they may fetch the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  }
}
