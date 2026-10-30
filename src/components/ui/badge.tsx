import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary-hover",
        secondary:
          "border-primary-line bg-primary-soft text-primary-text [a&]:hover:bg-primary-line",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive-hover",
        outline:
          "border-border-strong text-foreground [a&]:hover:bg-primary-faint [a&]:hover:text-primary-text",
        success: "border-success-line bg-success-soft text-success-foreground",
        warning: "border-warning-line bg-warning-soft text-warning-foreground",
        info: "border-info-line bg-info-soft text-info-foreground",
        danger: "border-danger-line bg-danger-soft text-danger-foreground",
        neutral: "border-neutral-line bg-neutral-soft text-neutral-foreground",
        violet: "border-violet-line bg-violet-soft text-violet-foreground",
        cyan: "border-cyan-line bg-cyan-soft text-cyan-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
