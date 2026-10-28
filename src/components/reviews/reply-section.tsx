"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, type ZoneAndLocale } from "@/lib/orders/format"
import { canReply } from "@/lib/reviews/rules"
import {
  REVIEW_REPLY_MAX_LENGTH,
  replyCharactersLeft,
  validateReply,
} from "@/lib/reviews/validation"
import { replyPublicationLabels, type ReviewReply } from "@/lib/reviews/types"

import { useReviewCommand } from "./use-review-command"

/**
 * The restaurant's reply to a review (R5, R6). With no reply, a form; once a
 * reply exists, the reply itself, with no edit, delete or second-reply
 * control. The publication status is shown only when the source supplies one
 * (R7): nothing here says a reply is visible to customers or approved unless
 * the source says so.
 */
export function ReplySection({
  reviewId,
  reply,
  context,
}: {
  reviewId: string
  reply: ReviewReply | null
  context: ZoneAndLocale
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const hadReply = useRef(reply !== null)

  // When the form is replaced by the saved reply, move focus there instead of losing it.
  useEffect(() => {
    if (reply !== null && !hadReply.current) headingRef.current?.focus()
    hadReply.current = reply !== null
  }, [reply])

  return (
    <section aria-labelledby="reply-heading" className="flex flex-col gap-4">
      <h2 id="reply-heading" ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
        Your reply
      </h2>
      {canReply({ reply }) ? (
        <ReplyForm reviewId={reviewId} />
      ) : reply ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap">{reply.text}</p>
          <p className="text-xs text-muted-foreground">
            Replied <time dateTime={reply.repliedAt}>{formatDateTime(reply.repliedAt, context)}</time>
            {reply.publication ? <> · {replyPublicationLabels[reply.publication]}</> : null}
          </p>
        </div>
      ) : null}
    </section>
  )
}

function ReplyForm({ reviewId }: { reviewId: string }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const command = useReviewCommand(reviewId)
  const [text, setText] = useState("")
  const [localError, setLocalError] = useState<string>()

  const left = replyCharactersLeft(text)
  const error = localError ?? command.fieldErrors.text
  // A failure that isn't about the text (offline, refused, a reply already exists) is shown as a general alert.
  const generalFailure = command.result && !command.result.ok && !command.fieldErrors.text ? command.result : null

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (command.pending) return
        const checked = validateReply(text)
        setLocalError(checked.ok ? undefined : checked.error)
        if (!checked.ok) return
        command.run({ type: "reply", text: checked.text }, "Reply submitted")
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-text`}>Write a reply</Label>
        <Textarea
          id={`${id}-text`}
          name="text"
          rows={5}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setLocalError(undefined)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          placeholder="Thank the customer, or respond to what they said."
        />
        <p id={hintId} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>A reply can&apos;t be edited or deleted after you send it.</span>
          <span className={left < 0 ? "font-medium text-destructive" : undefined}>
            {left >= 0
              ? `${left.toLocaleString("en")} of ${REVIEW_REPLY_MAX_LENGTH.toLocaleString("en")} characters left`
              : `${(-left).toLocaleString("en")} ${left === -1 ? "character" : "characters"} over the ${REVIEW_REPLY_MAX_LENGTH.toLocaleString("en")} limit`}
          </span>
        </p>
        {error ? (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

      <Button type="submit" className="w-fit" aria-disabled={command.pending || undefined}>
        {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Send reply
      </Button>
    </form>
  )
}
