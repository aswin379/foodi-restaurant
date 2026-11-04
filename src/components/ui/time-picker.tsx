"use client"

import * as React from "react"
import { Check, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format12Hour, parseClockInput, to12Hour, to24Hour, type Period } from "@/lib/time/clock12"
import { cn } from "@/lib/utils"

export interface TimePickerProps {
  id?: string
  /** "HH:mm" (24-hour). The picker shows it as a 12-hour time but always reports "HH:mm". */
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean | "true" | "false"
  "aria-describedby"?: string
  placeholder?: string
  step?: number
}

const PRESETS = ["09:00", "11:00", "12:00", "15:00", "18:00", "22:00", "23:30", "00:00"]
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = ["00", "15", "30", "45"]
const PERIODS: Period[] = ["AM", "PM"]

export function TimePicker({
  id,
  value = "",
  onChange,
  disabled = false,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  placeholder = "e.g. 6:00 PM",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  // While typing, the raw text is shown; otherwise the stored "HH:mm" is shown as a 12-hour time.
  const [draft, setDraft] = React.useState<string | null>(null)
  const hourScrollRef = React.useRef<HTMLDivElement>(null)
  const minuteScrollRef = React.useRef<HTMLDivElement>(null)

  const display = draft ?? format12Hour(value)
  const current = to12Hour(value) ?? { hour: 9, minute: "00", period: "AM" as Period }

  // Scroll active hour & minute into view when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        const activeHour = hourScrollRef.current?.querySelector<HTMLElement>("[data-active='true']")
        activeHour?.scrollIntoView({ block: "center", behavior: "smooth" })

        const activeMin = minuteScrollRef.current?.querySelector<HTMLElement>("[data-active='true']")
        activeMin?.scrollIntoView({ block: "center", behavior: "smooth" })
      }, 50)
    }
  }, [open])

  // Everything below hands "HH:mm" (24-hour) to onChange, whatever is shown.
  const pick = (time: string) => {
    setDraft(null)
    onChange?.(time)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setDraft(text)
    const parsed = parseClockInput(text)
    if (parsed) onChange?.(parsed)
  }

  const optionClass = (selected: boolean) =>
    cn(
      "rounded-md py-1 text-center text-xs tabular-nums font-medium transition-colors",
      selected ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-foreground hover:bg-neutral-100"
    )

  return (
    <div className={cn("relative flex items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex w-full items-center">
          <input
            id={id}
            type="text"
            value={display}
            placeholder={placeholder}
            disabled={disabled}
            onChange={handleInputChange}
            onBlur={() => setDraft(null)}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "border-input bg-card placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-lg border py-1 pr-8 pl-2.5 text-sm tabular-nums shadow-xs transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
              disabled && "pointer-events-none opacity-50"
            )}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-0.5 top-0.5 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
              aria-label="Open time picker"
            >
              <Clock className="size-4" />
            </Button>
          </PopoverTrigger>
        </div>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-80 p-3 shadow-xl rounded-2xl border bg-popover"
        >
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-primary" />
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {value ? format12Hour(value) : "9:00 AM"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium hover:bg-neutral-100"
                onClick={() => setOpen(false)}
              >
                <Check className="size-3.5 mr-1 text-emerald-600" /> Done
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
                Presets
              </span>
              <div className="grid grid-cols-4 gap-1">
                {PRESETS.map((slot) => {
                  const isSelected = slot === value
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => pick(slot)}
                      className={cn(
                        "rounded-md py-1 text-center text-xs tabular-nums font-medium transition-colors border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {format12Hour(slot)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Hour, minute and AM/PM */}
            <div className="grid grid-cols-3 gap-2 border-t pt-2.5">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 text-center">
                  Hour
                </span>
                <div
                  ref={hourScrollRef}
                  className="flex flex-col gap-1 max-h-44 overflow-y-auto px-1 pr-1.5 [scrollbar-width:thin]"
                >
                  {HOURS_12.map((h) => {
                    const isSelected = h === current.hour
                    return (
                      <button
                        key={h}
                        type="button"
                        data-active={isSelected ? "true" : undefined}
                        onClick={() => pick(to24Hour(h, current.minute, current.period))}
                        className={optionClass(isSelected)}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col border-l pl-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 text-center">
                  Minute
                </span>
                <div
                  ref={minuteScrollRef}
                  className="flex flex-col gap-1 max-h-44 overflow-y-auto px-1 pr-1.5 [scrollbar-width:thin]"
                >
                  {MINUTES.map((m) => {
                    const isSelected = m === current.minute
                    return (
                      <button
                        key={m}
                        type="button"
                        data-active={isSelected ? "true" : undefined}
                        onClick={() => pick(to24Hour(current.hour, m, current.period))}
                        className={optionClass(isSelected)}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col border-l pl-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 text-center">
                  AM/PM
                </span>
                <div className="flex flex-col gap-1 px-1">
                  {PERIODS.map((period) => {
                    const isSelected = period === current.period
                    return (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => pick(to24Hour(current.hour, current.minute, period))}
                        className={optionClass(isSelected)}
                      >
                        {period}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
