import { Suspense } from "react"
import type { Metadata } from "next"

import { PublicMenu } from "@/features/public-menu/public-menu"
import { noIndex } from "@/lib/seo"

export const metadata: Metadata = { title: "Menu", robots: noIndex }

async function Menu({ params, searchParams }: PageProps<"/s/[slug]">) {
  const { slug } = await params
  const { loc } = await searchParams
  return <PublicMenu slug={slug} loc={typeof loc === "string" ? loc : undefined} />
}

// Public: opened by scanning a restaurant or table QR code. No login. The table comes only from the ?loc= token.
export default function PublicMenuPage(props: PageProps<"/s/[slug]">) {
  return (
    <Suspense>
      <Menu {...props} />
    </Suspense>
  )
}
