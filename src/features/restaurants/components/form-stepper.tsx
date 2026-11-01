import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** Progress of the restaurant form, the same three steps as the admin "Add seller" form. */
export function FormStepper({ steps, step }: { steps: readonly string[]; step: number }) {
  return (
    <ol className="mx-auto flex w-full max-w-xl items-start" aria-label="Application progress">
      {steps.map((label, index) => {
        const done = index < step
        const active = index === step
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            {index > 0 ? (
              <span aria-hidden className={cn("absolute top-4 right-1/2 h-0.5 w-full", index <= step ? "bg-primary" : "bg-border")} />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-background text-sm font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground"
              )}
            >
              {done ? <Check aria-hidden className="size-4" /> : index + 1}
            </span>
            <span className={cn("text-xs font-medium sm:text-sm", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
