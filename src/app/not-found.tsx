import Image from "next/image"
import Link from "next/link"
import { SearchX } from "lucide-react"

import { ErrorCard } from "@/components/shared/error-card"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-gradient-to-br from-background to-background-warm px-5 py-10">
      <Image src="/brand/foodi-logo.png" alt="Foodi" width={1953} height={493} priority className="h-9 w-auto" />
      <ErrorCard icon={SearchX} title="Page not found" description="We couldn't find that page. It may have moved, or the address may be wrong.">
        <Button asChild>
          <Link href="/dashboard">Go to the dashboard</Link>
        </Button>
      </ErrorCard>
    </main>
  )
}
