import { Suspense } from "react"
import type { Metadata } from "next"

import { PublicMenu } from "@/features/public-menu/public-menu"
import { noIndex } from "@/lib/seo"

export const metadata: Metadata = { title: "Menu", robots: noIndex }

async function Menu({ params }: PageProps<"/q/[token]">) {
  const { token } = await params
  return <PublicMenu loc={token} />
}

// Old QR links (/q/{token}), made before restaurants had a public slug, keep working: the restaurant comes from the token.
export default function LegacyQrPage(props: PageProps<"/q/[token]">) {
  return (
    <Suspense>
      <Menu {...props} />
    </Suspense>
  )
}
