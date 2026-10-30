import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { contrastRatio } from "@/lib/design/contrast"
import { contrastPairs, designTokens, tokenHex, type TokenGroup } from "@/lib/design/tokens"

const GROUPS: TokenGroup[] = ["Brand", "Surface and text", "Lines", "Action", "Status"]

/** Every token with its HEX value and where it is used. The swatch carries no text, so it can't fail contrast itself. */
export function ColourTokens() {
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{group}</h3>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designTokens
              .filter((token) => token.group === group)
              .map((token) => (
                <li key={token.name} className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs">
                  <span
                    aria-hidden
                    className="size-12 shrink-0 rounded-lg border border-border-strong"
                    style={{ backgroundColor: token.hex }}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs font-medium break-all">--{token.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{token.hex}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{token.usage}</span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** The same pairs the unit tests enforce, with the ratio each one reaches. */
export function ContrastTable() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Pairing</TableHead>
            <TableHead className="hidden sm:table-cell">Sample</TableHead>
            <TableHead className="text-right">Ratio</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Needs</TableHead>
            <TableHead className="pr-4">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contrastPairs.map((pair) => {
            const ratio = contrastRatio(tokenHex(pair.foreground), tokenHex(pair.background))
            const passes = ratio >= pair.minimum
            return (
              <TableRow key={pair.label}>
                <TableCell className="pl-4 whitespace-normal">
                  <span className="font-medium">{pair.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {pair.foreground} on {pair.background}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {/* Shapes, not text: a sample of a deliberately low-contrast pairing must not be read as page text. */}
                  <span
                    aria-hidden
                    className="inline-flex h-7 w-14 items-center justify-center rounded-md border border-border-strong"
                    style={{ backgroundColor: tokenHex(pair.background) }}
                  >
                    <span className="h-2 w-8 rounded-full" style={{ backgroundColor: tokenHex(pair.foreground) }} />
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{ratio.toFixed(2)}:1</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{pair.minimum}:1</TableCell>
                <TableCell className="pr-4">
                  <Badge variant={passes ? "success" : "danger"}>{passes ? "Pass" : "Fail"}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

const typeScale = [
  { name: "Page title", spec: "28/36 · 700 · −0.02em", className: "text-[1.75rem] leading-9 font-bold tracking-tight", sample: "Orders today" },
  { name: "Section title", spec: "18/26 · 600", className: "text-lg leading-[1.625rem] font-semibold", sample: "Recent activity" },
  { name: "Card title", spec: "16/24 · 600", className: "text-base leading-6 font-semibold", sample: "Sample card title" },
  { name: "Body", spec: "14/20 · 400", className: "text-sm leading-5", sample: "Body text explains what a screen does and what happens next." },
  { name: "Table", spec: "13/18 · 400", className: "text-[0.8125rem] leading-[1.125rem]", sample: "Sample table cell text" },
  { name: "Label", spec: "12/16 · 600", className: "text-xs leading-4 font-semibold", sample: "Sample field label" },
  { name: "Metric", spec: "28/32 · 700 · tabular", className: "text-[1.75rem] leading-8 font-bold tabular-nums", sample: "1,111.00" },
  { name: "Code and references", spec: "Geist Mono 13/20", className: "font-mono text-[0.8125rem] leading-5", sample: "PREVIEW-CODE-11" },
]

export function TypeScale() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The interface uses Plus Jakarta Sans (weights 400 to 700). Geist Mono is kept for codes and technical references.
      </p>
      <dl className="divide-y rounded-xl border bg-card">
        {typeScale.map((row) => (
          <div key={row.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:items-baseline sm:gap-4">
            <dt className="flex flex-col">
              <span className="text-sm font-medium">{row.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{row.spec}</span>
            </dt>
            <dd className={row.className}>{row.sample}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const radii = [
  { label: "Controls", spec: "10px", className: "rounded-lg" },
  { label: "Cards", spec: "16px", className: "rounded-xl" },
  { label: "Dialogs", spec: "20px", className: "rounded-2xl" },
  { label: "Badges, pills", spec: "full", className: "rounded-full" },
]

const elevations = [
  { label: "Control", spec: "shadow-xs", className: "shadow-xs" },
  { label: "Card", spec: "shadow-sm", className: "shadow-sm" },
  { label: "Popover", spec: "shadow-md", className: "shadow-md" },
  { label: "Dialog", spec: "shadow-lg", className: "shadow-lg" },
]

export function ShapeAndElevation() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Corner radius</h3>
        <ul className="grid grid-cols-2 gap-4">
          {radii.map((radius) => (
            <li key={radius.label} className="flex flex-col gap-2">
              <span aria-hidden className={`h-16 border-2 border-primary-line bg-primary-soft ${radius.className}`} />
              <span className="text-sm font-medium">{radius.label}</span>
              <span className="font-mono text-xs text-muted-foreground">{radius.spec}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Elevation</h3>
        <ul className="grid grid-cols-2 gap-4">
          {elevations.map((elevation) => (
            <li key={elevation.label} className="flex flex-col gap-2">
              <span aria-hidden className={`h-16 rounded-xl border bg-card ${elevation.className}`} />
              <span className="text-sm font-medium">{elevation.label}</span>
              <span className="font-mono text-xs text-muted-foreground">{elevation.spec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
