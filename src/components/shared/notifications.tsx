"use client"

import { useSyncExternalStore } from "react"
import { CircleAlert, CircleCheck, FlaskConical } from "lucide-react"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { PREVIEW_ONLY_LABEL } from "@/lib/data-source/preview-copy"
import type { ActionResult } from "@/lib/data-source/result"

export type NotificationInput =
  | {
      kind: "success"
      title: string
      description?: string
      /**
       * A simulated change. The preview label is added here, not by callers,
       * so a preview success can never be shown without it (G1).
       */
      preview: boolean
    }
  | { kind: "error"; title: string; description?: string }

type Notification = NotificationInput & { id: number }

const MAX_VISIBLE = 3
let notifications: Notification[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function notify(input: NotificationInput) {
  notifications = [...notifications, { ...input, id: nextId++ }].slice(-MAX_VISIBLE)
  emit()
}

function dismiss(id: number) {
  notifications = notifications.filter((notification) => notification.id !== id)
  emit()
}

/** Shows the outcome of a Server Action, with the preview label when simulated. */
export function notifyActionResult(
  result: ActionResult<unknown>,
  messages: { success: string; failure?: string }
) {
  if (result.ok) {
    notify({ kind: "success", title: messages.success, preview: result.preview })
  } else {
    notify({
      kind: "error",
      title: messages.failure ?? "Nothing was changed",
      description: result.message,
    })
  }
}

/** Test helper. */
export function clearNotifications() {
  notifications = []
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Snapshots must be stable references, or React re-renders forever.
const NO_NOTIFICATIONS: Notification[] = []
const getSnapshot = () => notifications
const getServerSnapshot = () => NO_NOTIFICATIONS

/** Mounted once, in the dashboard shell. */
export function Notifications() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <ToastProvider swipeDirection="right" duration={6000}>
      {items.map((item) => (
        <Toast
          key={item.id}
          variant={item.kind === "error" ? "destructive" : "default"}
          // Errors interrupt; successes are announced politely.
          type={item.kind === "error" ? "foreground" : "background"}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id)
          }}
        >
          {item.kind === "error" ? (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : item.preview ? (
            <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
          ) : (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          )}
          <div className="grid gap-1">
            <ToastTitle>{item.title}</ToastTitle>
            {item.description ? (
              <ToastDescription>{item.description}</ToastDescription>
            ) : null}
            {item.kind === "success" && item.preview ? (
              <ToastDescription className="font-medium text-amber-800">
                {PREVIEW_ONLY_LABEL}
              </ToastDescription>
            ) : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
