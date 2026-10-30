import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { Separator } from "@/components/ui/separator"
import { authLinks } from "@/lib/auth/routes"

import { BrandPanel } from "./brand-panel"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your restaurant on Foodi.",
}

const footerLinkClass =
  "rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"

export default function LoginPage() {
  const hasLegalLinks = Boolean(authLinks.terms || authLinks.privacy)

  return (
    <div className="grid min-h-dvh bg-gradient-to-br from-background to-background-warm md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <main className="flex min-w-0 flex-col px-5 py-8 sm:px-10 sm:py-10 lg:px-16 xl:px-24">
        <header>
          <Image
            src="/brand/foodi-logo.png"
            alt="Foodi"
            width={1953}
            height={493}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </header>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[440px] rounded-3xl bg-card p-6 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-accent px-3 py-1 text-xs font-medium tracking-wide text-accent-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />
              Restaurant Partner
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-[2.25rem]">
              Welcome back
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Sign in to manage your restaurant, orders, and daily business.
            </p>

            <div className="mt-8">
              <LoginForm />
            </div>

            {authLinks.restaurantOnboarding ? (
              <>
                <Separator className="my-8" />
                <p className="text-center text-sm text-muted-foreground">
                  New to Foodi?{" "}
                  <Link
                    href={authLinks.restaurantOnboarding}
                    className="font-medium text-primary-text underline-offset-4 hover:underline"
                  >
                    Partner with us
                  </Link>
                </p>
              </>
            ) : null}
          </div>
        </div>

        {hasLegalLinks ? (
          <footer className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {authLinks.terms ? (
              <Link href={authLinks.terms} className={footerLinkClass}>
                Terms of Service
              </Link>
            ) : null}
            {authLinks.privacy ? (
              <Link href={authLinks.privacy} className={footerLinkClass}>
                Privacy Policy
              </Link>
            ) : null}
          </footer>
        ) : null}
      </main>

      <BrandPanel />
    </div>
  )
}
