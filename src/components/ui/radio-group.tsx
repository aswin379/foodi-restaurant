"use client"

import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])

function RadioGroup({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        // Arrow keys move focus and select the newly focused option (WAI-ARIA
        // radio group). Radix only selects if the key is still held down when its
        // roving focus moves (in a timeout), so a quick tap could move focus
        // without selecting. Radix still decides where focus goes (skipping
        // disabled options, wrapping, orientation, direction); this selects
        // whatever option it moved to, through the option's own click.
        // (Radix's roving focus has already called preventDefault on the arrow key.)
        if (!ARROW_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        const group = event.currentTarget
        const from = event.target
        setTimeout(() => {
          const option = document.activeElement
          if (
            option instanceof HTMLButtonElement &&
            option !== from &&
            option.getAttribute("role") === "radio" &&
            group.contains(option) &&
            option.getAttribute("aria-checked") !== "true" &&
            !option.disabled
          ) {
            option.click()
          }
        })
      }}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
