import { CONTRAST_TARGETS } from "./contrast"

// The Foodi design tokens (light theme). This registry documents each token and
// is checked against src/app/globals.css by tokens.test.ts, so the page that
// shows the tokens, the CSS that defines them and the contrast tests can't
// drift apart. Dark mode is out of scope: there is no dark theme.
//
// Rules of use:
// - `primary` (#D63F08) is for fills and active controls. Text in the brand
//   colour (links, active labels) uses `primary-text`, because #D63F08 text on
//   the page background is only 4.31:1.
// - `brand-orange` (#F26A1B) is decorative: icons, illustrations and large
//   shapes, never small text and never behind text.
// - Interactive control borders use `input` (3:1). Card boundaries and dividers
//   use the lighter `border` and `border-soft`.

export type TokenGroup = "Brand" | "Surface and text" | "Lines" | "Action" | "Status"

export type DesignToken = {
  /** The CSS custom property, without the leading dashes (`--primary`). */
  name: string
  hex: string
  group: TokenGroup
  usage: string
}

const token = (name: string, hex: string, group: TokenGroup, usage: string): DesignToken => ({ name, hex, group, usage })

const statusTone = (
  tone: string,
  label: string,
  dot: string,
  foreground: string,
  soft: string,
  line: string
): DesignToken[] => [
  token(tone, dot, "Status", `${label}: dots and solid markers`),
  token(`${tone}-foreground`, foreground, "Status", `${label}: text on its soft fill`),
  token(`${tone}-soft`, soft, "Status", `${label}: badge and notice fill`),
  token(`${tone}-line`, line, "Status", `${label}: badge and notice border`),
]

export const designTokens: DesignToken[] = [
  token("primary", "#D63F08", "Brand", "Primary buttons, active controls, focus ring"),
  token("primary-foreground", "#FFFFFF", "Brand", "Text on primary"),
  token("primary-hover", "#B83306", "Brand", "Primary hover and pressed"),
  token("primary-text", "#B02F05", "Brand", "Links and active labels in the brand colour"),
  token("primary-soft", "#FFEBDF", "Brand", "Active navigation, selected rows, icon tiles"),
  token("primary-faint", "#FFF5EF", "Brand", "Hover surfaces"),
  token("primary-line", "#FFD9C4", "Brand", "Borders on a primary tint"),
  token("brand-orange", "#F26A1B", "Brand", "Decorative accents and icons only"),

  token("background", "#FBF7F4", "Surface and text", "App page background"),
  token("background-warm", "#FFF1DC", "Surface and text", "Warm end of the page gradient (cream), behind the shell"),
  token("card", "#FFFFFF", "Surface and text", "Cards, sidebar, dialogs, popovers"),
  token("muted", "#F6EFEA", "Surface and text", "Table headers and secondary fills"),
  token("foreground", "#1F1A17", "Surface and text", "Primary text"),
  token("muted-foreground", "#6B5F58", "Surface and text", "Secondary text"),
  token("faint-foreground", "#8A7C73", "Surface and text", "Disabled text and quiet decoration (never placeholder text, which must meet 4.5:1)"),
  token("star", "#C96F00", "Surface and text", "Filled rating stars"),

  token("border", "#E9DFD8", "Lines", "Card boundaries and dividers (decorative)"),
  token("border-soft", "#F0E8E2", "Lines", "Table row dividers (decorative)"),
  token("border-strong", "#DCCFC6", "Lines", "Outline button borders"),
  token("input", "#9A8B82", "Lines", "Borders of interactive controls (3:1)"),

  token("accent", "#FFEBDF", "Action", "Menu focus and active navigation fill"),
  token("accent-foreground", "#B02F05", "Action", "Text on the accent fill"),
  token("ring", "#D63F08", "Action", "Focus ring"),
  token("destructive", "#C4122F", "Action", "Destructive buttons and error text"),
  token("destructive-hover", "#A30F27", "Action", "Destructive hover"),
  token("destructive-foreground", "#FFFFFF", "Action", "Text on destructive"),

  ...statusTone("success", "Success", "#16A34A", "#166534", "#DCFCE7", "#BBF7D0"),
  ...statusTone("warning", "Warning", "#F59E0B", "#8A4B08", "#FEF0C7", "#FCD98A"),
  ...statusTone("info", "Info", "#3B82F6", "#1D4ED8", "#DBEAFE", "#BFDBFE"),
  ...statusTone("danger", "Danger", "#EF4444", "#B42318", "#FEE4E2", "#FECDCA"),
  ...statusTone("neutral", "Neutral", "#A8A29E", "#57534E", "#F1ECE8", "#E7E0DA"),
  ...statusTone("violet", "Scheduled", "#7C3AED", "#5B21B6", "#EDE9FE", "#DDD6FE"),
  ...statusTone("cyan", "Out for delivery", "#06B6D4", "#0E7490", "#CFFAFE", "#A5F3FC"),
]

export const tokenHex = (name: string) => {
  const found = designTokens.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`Unknown design token: ${name}`)
  return found.hex
}

export type ContrastPair = { label: string; foreground: string; background: string; minimum: number }

const pair = (label: string, foreground: string, background: string, minimum: number): ContrastPair => ({
  label,
  foreground,
  background,
  minimum,
})

const { text, ui } = CONTRAST_TARGETS
const tones = ["success", "warning", "info", "danger", "neutral", "violet", "cyan"] as const

/** Every pairing the system promises, with the WCAG 2.2 AA minimum it must meet. */
export const contrastPairs: ContrastPair[] = [
  pair("Primary button text", "primary-foreground", "primary", text),
  pair("Primary button text, hover", "primary-foreground", "primary-hover", text),
  pair("Brand text on the page", "primary-text", "background", text),
  pair("Brand text on a card", "primary-text", "card", text),
  pair("Brand text on a soft tint", "primary-text", "primary-soft", text),
  pair("Brand text on a faint tint", "primary-text", "primary-faint", text),
  pair("Active navigation text", "accent-foreground", "accent", text),
  pair("Primary fill against a card (controls, ring)", "primary", "card", ui),
  pair("Primary fill against the page (controls, ring)", "primary", "background", ui),
  pair("Body text on the page", "foreground", "background", text),
  pair("Body text on a card", "foreground", "card", text),
  pair("Body text on a muted fill", "foreground", "muted", text),
  pair("Body text on the warm gradient end", "foreground", "background-warm", text),
  pair("Secondary text on the warm gradient end", "muted-foreground", "background-warm", text),
  pair("Brand text on the warm gradient end", "primary-text", "background-warm", text),
  pair("Secondary text on the page", "muted-foreground", "background", text),
  pair("Secondary text on a card", "muted-foreground", "card", text),
  pair("Secondary text on a muted fill", "muted-foreground", "muted", text),
  pair("Secondary text on the accent fill", "muted-foreground", "accent", text),
  pair("Secondary button text, hover", "primary-text", "primary-line", text),
  pair("Placeholder on a card (uses secondary text)", "muted-foreground", "card", text),
  pair("Control border against a card", "input", "card", ui),
  pair("Control border against the page", "input", "background", ui),
  pair("Destructive button text", "destructive-foreground", "destructive", text),
  pair("Destructive button text, hover", "destructive-foreground", "destructive-hover", text),
  pair("Error text on a card", "destructive", "card", text),
  pair("Error text on the page", "destructive", "background", text),
  pair("Star against a card", "star", "card", ui),
  pair("Brand orange against a card (icons)", "brand-orange", "card", ui),
  ...tones.map((tone) => pair(`${tone} text on its soft fill`, `${tone}-foreground`, `${tone}-soft`, text)),
  ...tones.map((tone) => pair(`${tone} text on a card`, `${tone}-foreground`, "card", text)),
]

/** The order statuses of the Orders module and the tone each one wears (the existing mapping, now in tokens). */
export const orderStatusTones = [
  { status: "Scheduled", tone: "violet" },
  { status: "Pending", tone: "warning" },
  { status: "Accepted", tone: "info" },
  { status: "Ready", tone: "success" },
  { status: "Out for delivery", tone: "cyan" },
  { status: "Completed", tone: "neutral" },
  { status: "Rejected", tone: "danger" },
  { status: "Cancelled", tone: "danger" },
] as const
