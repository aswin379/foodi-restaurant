import type { Metadata } from "next"

export const SITE_NAME = "Foodi for Restaurants"
export const SITE_DESCRIPTION = "Manage your restaurant, orders, and daily business with Foodi."
export const SITE_LOGO = "/brand/foodi-logo.png"

/** Public origin from NEXT_PUBLIC_SITE_URL; the localhost fallback is for development only. */
export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")

/** Keeps a page out of search results. robots.txt must keep allowing crawlers so they can read this. */
export const noIndex: Metadata["robots"] = { index: false, follow: false }
