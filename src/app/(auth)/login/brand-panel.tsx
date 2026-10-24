import Image from "next/image"
import { ClipboardList, Store, UtensilsCrossed } from "lucide-react"

// Hero photography for the brand panel. No licensed restaurant photo exists in
// the repository yet: add one under `public/images/` and set it here, e.g.
// { src: "/images/login-hero.jpg", alt: "" }. Until then the panel renders a
// dark, photo-free background.
const heroImage: { src: string; alt: string } | null = null

const highlights = [
  { icon: ClipboardList, label: "Keep track of incoming orders" },
  { icon: UtensilsCrossed, label: "Keep your menu up to date" },
  { icon: Store, label: "Run your restaurant's day from one place" },
]

export function BrandPanel() {
  return (
    <aside
      aria-label="About Foodi for restaurants"
      className="hidden p-3 md:sticky md:top-0 md:block md:h-dvh"
    >
      <div className="relative isolate flex h-full flex-col justify-end overflow-hidden rounded-[1.75rem] bg-stone-950 p-8 text-white lg:p-12 xl:p-14">
        {heroImage ? (
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 45vw"
            className="-z-20 object-cover object-center"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 -z-20 bg-[radial-gradient(120%_80%_at_85%_0%,oklch(0.45_0.09_60/0.45),transparent_60%),radial-gradient(90%_70%_at_0%_100%,oklch(0.42_0.1_165/0.5),transparent_65%)]"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/5"
        />

        <div className="max-w-xl">
          <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight text-balance lg:text-[2.75rem] xl:text-5xl">
            More time for the food. Less time on the busywork.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75 lg:mt-5 lg:text-base">
            Foodi brings your orders, menu, and day-to-day restaurant operations
            together, so your team can focus on the guests in front of them.
          </p>

          <ul className="mt-8 hidden gap-3 lg:grid">
            {highlights.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 text-sm text-white/90"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur-sm">
                  <Icon aria-hidden className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
