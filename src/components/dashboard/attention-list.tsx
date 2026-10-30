import Link from "next/link"
import { ArrowRight, CircleAlert, CircleCheck, CircleHelp } from "lucide-react"

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
      <div className="flex flex-col gap-4">
        {items.length ? (
          <ul className="flex flex-col gap-3" aria-label="Things that need attention">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 rounded-2xl border bg-card p-3.5 text-sm shadow-xs">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning-foreground">
                  <CircleAlert aria-hidden strokeWidth={1.75} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold break-words">
                    {item.title}
                    {modes[itemSource[item.id]] === "preview" ? (
                      <span className="ml-1 font-normal text-warning-foreground"> (preview)</span>
                    ) : null}
                  </span>
                  <span className="break-words text-muted-foreground">{item.description}</span>
                  <Link
                    href={item.href}
                    className="mt-1 inline-flex w-fit items-center gap-1 rounded-sm font-semibold text-primary-text outline-none hover:underline"
                  >
                    {item.linkLabel}
                    <ArrowRight aria-hidden className="size-3.5" />
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : unchecked.length === CHECK_COUNT ? (
          // Nothing could be checked: say so, never "all clear".
          <p className="rounded-xl border border-dashed bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
            These checks couldn&apos;t run, so nothing can be shown yet.
          </p>
        ) : (
          <p className="flex items-center gap-3 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-foreground">
            <CircleCheck aria-hidden className="size-5 shrink-0" />
            {unchecked.length ? "Nothing needs attention in the checks that loaded." : "Nothing needs attention right now."}
          </p>
        )}
        {unchecked.length ? (
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground" aria-label="Checks that couldn't run">
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
