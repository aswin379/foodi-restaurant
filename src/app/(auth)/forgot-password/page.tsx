import type { Metadata } from "next"
import Image from "next/image"

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

import { BrandPanel } from "../login/brand-panel"

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your Foodi restaurant password.",
  robots: { index: false },
}

export default function ForgotPasswordPage() {
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
            <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground">Reset your password</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Enter your email and we&apos;ll send you a 6-digit code.
            </p>
            <div className="mt-8">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </main>

      <BrandPanel />
    </div>
  )
}
