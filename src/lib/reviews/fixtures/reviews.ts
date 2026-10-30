import type { ReplyPublicationStatus, Review, ReviewModerationStatus, ReviewRating } from "../types"

// Sample reviews for PREVIEW mode only. Names are made up and every review is
// labelled as sample data in the UI; nothing here reaches production. Order
// links point at completed sample orders from the orders fixtures
// (src/lib/orders/fixtures/orders.ts); a test keeps them in step.

const HOUR = 3_600_000
const order = (number: number) => ({ id: `prv-${number}`, reference: `PRV-${number}` })

type Row = {
  rating: ReviewRating
  text: string | null
  name: string | null
  reply?: { text: string; publication?: ReplyPublicationStatus }
  order?: number
  moderation?: ReviewModerationStatus
  report?: { reason: string }
}

// Newest first. The mix is chosen so each state has a sample:
// - rating only: 3, 6, 13, 15, 23; no reviewer name: 8, 20
// - replied: 2, 7, 11, 14, 18, 22, 25, 28 (a reply status is supplied for 7 and 11 only)
// - a status supplied by the source: 7 (published), 10 (under review)
// - already reported by this restaurant: 17
// - linked to an order: 1, 4, 7, 12, 14, 19, 22, 28
const ROWS: Row[] = [
  { rating: 5, text: "Fresh and well packed. The dosa was still crisp when it arrived.", name: "Aarav K.", order: 1016 },
  { rating: 4, text: "Good portions. Delivery took a little longer than expected.", name: "Meera S.", reply: { text: "Thanks for the feedback, Meera. We're working on our delivery times." } },
  { rating: 5, text: null, name: "Rohan P." },
  { rating: 2, text: "The biryani was lukewarm and the raita was missing.", name: "Isha N.", order: 1017 },
  { rating: 5, text: "The best filter coffee in the area.", name: "Vikram R." },
  { rating: 3, text: null, name: "Ananya D." },
  {
    rating: 1,
    text: "The order arrived 50 minutes late and the packaging had leaked.",
    name: "Kabir M.",
    reply: { text: "We're sorry about this. Please contact us so we can make it right.", publication: "published" },
    order: 1018,
    moderation: "published",
  },
  { rating: 4, text: "Lovely paneer tikka.", name: null },
  { rating: 5, text: "Great service for a dine-in meal.", name: "Sana Q." },
  { rating: 3, text: "Average. Nothing special, but fine.", name: "Dev T.", moderation: "under_review" },
  { rating: 5, text: "Quick and tasty!", name: "Priya L.", reply: { text: "Thank you, Priya!", publication: "pending_approval" } },
  { rating: 2, text: "Too salty for me.", name: "Nikhil B.", order: 1020 },
  { rating: 4, text: null, name: "Tara G." },
  { rating: 5, text: "Consistently good. Our regular order.", name: "Imran A.", reply: { text: "Thank you for being a regular!" }, order: 1021 },
  { rating: 1, text: null, name: "Leena V." },
  { rating: 4, text: "Nice biryani, a little pricey.", name: "Harsh J." },
  { rating: 1, text: "Terrible!!! Do not order. Visit my site for better food.", name: "Promo Account", report: { reason: "spam_or_fake" } },
  { rating: 3, text: "Okay overall.", name: "Gautam R.", reply: { text: "Thanks for the feedback." } },
  { rating: 5, text: "Perfect.", name: "Sneha M.", order: 1023 },
  { rating: 4, text: "Good value.", name: null },
  { rating: 2, text: "Waited a long time for the order.", name: "Zoya H." },
  { rating: 5, text: "Great dal makhani.", name: "Rahul C.", reply: { text: "Glad you enjoyed it." }, order: 1024 },
  { rating: 5, text: null, name: "Kavya P." },
  { rating: 4, text: "A pleasant experience.", name: "Manoj D." },
  { rating: 3, text: "Could use more spice.", name: "Nisha W.", reply: { text: "We'll pass that on to the kitchen." } },
  { rating: 5, text: "Excellent.", name: "Omar F." },
  { rating: 1, text: "The food was cold.", name: "Pooja S." },
  { rating: 4, text: "Reliable.", name: "Yash K.", reply: { text: "Thank you." }, order: 1025 },
]

/** Built when the preview store starts, so the dates are relative to now. */
export function buildFixtureReviews(now: number): Review[] {
  return ROWS.map((row, index) => {
    // About nine hours apart, the newest a few hours ago.
    const createdAt = now - (3 + index * 9) * HOUR
    return {
      id: `prv-rev-${String(index + 1).padStart(3, "0")}`,
      rating: row.rating,
      text: row.text,
      reviewerName: row.name,
      createdAt: new Date(createdAt).toISOString(),
      reply: row.reply
        ? { text: row.reply.text, repliedAt: new Date(createdAt + 2 * HOUR).toISOString(), publication: row.reply.publication ?? null }
        : null,
      moderation: row.moderation ?? null,
      report: row.report ? { reportedAt: new Date(createdAt + 4 * HOUR).toISOString(), reason: row.report.reason, note: null } : null,
      order: row.order ? order(row.order) : null,
    }
  })
}
