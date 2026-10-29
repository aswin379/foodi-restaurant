import Link from "next/link"
import { CircleCheck, CircleAlert, CircleHelp } from "lucide-react"

import { attentionItems, type AttentionInput } from "@/lib/dashboard/attention"
import { isServiceError } from "@/lib/data-source/errors"
import { getAvailabilityStatus, hoursMode } from "@/lib/hours/service"
import { listMenuItems, menuMode } from "@/lib/menu/service"
import { getOrderBoard, getOrdersContext, ordersMode } from "@/lib/orders/service"
import { formatInstant } from "@/lib/time/format"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge } from "./dashboard-states"

// Names of the sold-out items shown in the alert; the total comes from the list's totalItems.
const SOLD_OUT_NAMES = 3

type Source = "hours" | "orders" | "menu"

const sourceLabels: Record<Source, string> = {
  hours: "Pause status",
  orders: "Waiting, late and unavailable-item orders",
  menu: "Sold-out menu items",
}

const CHECK_COUNT = Object.keys(sourceLabels).length

const itemSource = { paused: "hours", waiting: "orders", late: "orders", unavailable_lines: "orders", sold_out: "menu" } as const

const listOf = (words: readonly string[]) =>
  words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words.join("")

function uncheckedReason(error: unknown) {
  if (isServiceError(error) && error.kind === "not_configured") return "not connected yet"
  if (isServiceError(error) && error.kind === "forbidden") return "you don't have permission to see this"
  return "couldn't be loaded"
}

async function loadAttention(previewScenarios: { orders?: unknown; menu?: unknown; hours?: unknown }) {
  const [status, board, soldOut, context] = await Promise.allSettled([
    getAvailabilityStatus(previewScenarios.hours),
    getOrderBoard(previewScenarios.orders),
    listMenuItems(
      { filter: "sold_out", search: "", categoryId: null, page: 1, pageSize: SOLD_OUT_NAMES },
      previewScenarios.menu
    ),
    getOrdersContext(),
  ])
  // Read after the data, so waiting and late are judged against the moment it was loaded.
  const nowMs = Date.now()
  const input: AttentionInput = {
    pause: status.status === "fulfilled" ? status.value.pause : null,
    board: board.status === "fulfilled" ? board.value : null,
    soldOut:
      soldOut.status === "fulfilled"
        ? { count: soldOut.value.totalItems, names: soldOut.value.items.map((item) => item.name) }
        : null,
    nowMs,
  }
  const unchecked = (
    [
      ["hours", status],
      ["orders", board],
      ["menu", soldOut],
    ] as const
  ).flatMap(([source, result]) => (result.status === "rejected" ? [{ source, reason: uncheckedReason(result.reason) }] : []))
  return {
    items: attentionItems(input),
    unchecked,
    checkedAt: context.status === "fulfilled" ? formatInstant(new Date(nowMs).toISOString(), context.value, "time") : null,
  }
}

/**
 * Things to act on now (B5a, B5-D3). Each check reads its own module; a
 * check that can't load is listed as not checked, never as "all clear".
 */
export async function AttentionList({
  previewScenarios,
}: {
  previewScenarios: { orders?: unknown; menu?: unknown; hours?: unknown }
}) {
  const { items, unchecked, checkedAt } = await loadAttention(previewScenarios)
  const modes: Record<Source, string> = { hours: hoursMode(), orders: ordersMode(), menu: menuMode() }
  const previewSources = (["hours", "orders", "menu"] as const).filter((source) => modes[source] === "preview")

  return (
    <DashboardSection
      id="attention"
      title="Needs attention"
      description="Pause, waiting and late orders, unavailable items and sold-out dishes."
      badge={previewSources.length ? <PreviewDataBadge source={`sample ${listOf(previewSources)}`} /> : undefined}
    >
      <div className="flex flex-col gap-3">
        {items.length ? (
          <ul className="flex flex-col gap-2" aria-label="Things that need attention">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2.5 text-sm">
                <span className="flex items-start gap-2 font-medium">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <span className="min-w-0 break-words">
                    {item.title}
                    {modes[itemSource[item.id]] === "preview" ? (
                      <span className="ml-1 font-normal text-amber-900"> (preview)</span>
                    ) : null}
                  </span>
                </span>
                <span className="pl-6 break-words text-muted-foreground">{item.description}</span>
                <Link
                  href={item.href}
                  className="ml-6 w-fit rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {item.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        ) : unchecked.length === CHECK_COUNT ? (
          // Nothing could be checked: say so, never "all clear".
          <p className="text-sm text-muted-foreground">These checks couldn&apos;t run, so nothing can be shown yet.</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-700" />
            {unchecked.length ? "Nothing needs attention in the checks that loaded." : "Nothing needs attention right now."}
          </p>
        )}
        {unchecked.length ? (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground" aria-label="Checks that couldn't run">
            {unchecked.map(({ source, reason }) => (
              <li key={source} className="flex items-start gap-1.5">
                <CircleHelp aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Not checked: {sourceLabels[source]} ({reason}).
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {checkedAt ? <p className="text-xs text-muted-foreground">Checked at {checkedAt}.</p> : null}
      </div>
    </DashboardSection>
  )
}
