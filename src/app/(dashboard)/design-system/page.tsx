import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/dashboard/page-header"
import { ContrastTable, ColourTokens, ShapeAndElevation, TypeScale } from "@/components/design-system/foundations"
import { BadgeGallery, ButtonGallery, FormGallery, SurfaceGallery } from "@/components/design-system/gallery"
import { OverlayDemos } from "@/components/design-system/overlay-demos"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { designSystemAvailable } from "@/lib/design/availability"

export const metadata: Metadata = {
  title: "Design system",
}

export default function DesignSystemPage() {
  // A review tool, not a product page: unavailable unless explicitly enabled, and always unavailable in production.
  if (!designSystemAvailable()) notFound()

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Design system"
        description="The Foodi tokens and shared components, for visual review. Everything here is sample content: no customer, order or financial data."
      />
      <PreviewNotice detail="This page exists only in preview mode and is not available in production." />

      <Section id="colour" title="Colour" description="Light theme only. Brand text uses primary-text; the brand orange is decorative.">
        <ColourTokens />
      </Section>
      <Section id="contrast" title="Contrast" description="Every pairing the system promises, checked against WCAG 2.2 AA. The same pairs are enforced by unit tests.">
        <ContrastTable />
      </Section>
      <Section id="typography" title="Typography" description="Plus Jakarta Sans for the interface, Geist Mono for codes.">
        <TypeScale />
      </Section>
      <Section id="shape" title="Shape and elevation" description="Controls 10px, cards 16px, dialogs 20px, soft low-contrast shadows.">
        <ShapeAndElevation />
      </Section>
      <Section id="buttons" title="Buttons" description="Default 40px; semibold; darker on hover.">
        <ButtonGallery />
      </Section>
      <Section id="badges" title="Badges and statuses" description="Soft fills with darker text, all above 4.5:1.">
        <BadgeGallery />
      </Section>
      <Section id="forms" title="Form controls" description="Control borders #9A8B82 (3:1). One solid focus ring everywhere.">
        <FormGallery />
      </Section>
      <Section id="surfaces" title="Surfaces" description="Metric tiles, cards, tables, notices, empty and loading states.">
        <SurfaceGallery />
      </Section>
      <Section id="overlays" title="Overlays" description="Dialogs, confirmations, sheets, menus, popovers, tooltips and toasts. Nothing is saved.">
        <OverlayDemos />
      </Section>
    </div>
  )
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div>
        <h2 id={`${id}-heading`} className="text-lg leading-[1.625rem] font-semibold">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}
