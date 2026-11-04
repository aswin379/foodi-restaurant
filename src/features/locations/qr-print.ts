import QRCode from "qrcode"

const OPTIONS = { width: 512, margin: 2, errorCorrectionLevel: "M" as const }

/** PNG data URL of a QR code for `url`. The URL (and so the image) is identical every time for the same token. */
export function toQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, OPTIONS)
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/** Saves the QR code as a PNG. Never changes the token. */
export async function downloadQr(url: string, name: string): Promise<void> {
  const link = document.createElement("a")
  link.href = await toQrDataUrl(url)
  link.download = `${slug(name) || "qr-code"}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export type PrintCard = {
  /** Restaurant name. */
  title: string
  /** "Table 5", "Room 101", "Seat A-14" or "Scan to order". */
  heading: string
  url: string
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch)

/** Prints one labelled card per QR code (two columns, never split across pages) from a hidden frame. */
export async function printCards(cards: PrintCard[]): Promise<void> {
  const images = await Promise.all(cards.map((card) => toQrDataUrl(card.url)))
  const body = cards
    .map(
      (card, i) => `<section class="card">
  <h1>${escapeHtml(card.title)}</h1>
  <h2>${escapeHtml(card.heading)}</h2>
  <img src="${images[i]}" alt="" />
  <p class="hint">Scan to view the menu and order</p>
</section>`,
    )
    .join("\n")

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR codes</title><style>
    @page { margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; color: #111; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .card { border: 1px solid #999; border-radius: 6mm; padding: 6mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    h1 { font-size: 14pt; margin: 0 0 2mm; }
    h2 { font-size: 22pt; margin: 0 0 2mm; }
    img { width: 60mm; height: 60mm; }
    .hint { margin: 2mm 0 0; font-size: 10pt; color: #555; }
  </style></head><body><div class="grid">${body}</div></body></html>`

  await new Promise<void>((resolve) => {
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
    frame.onload = () => {
      const win = frame.contentWindow
      if (win) {
        win.focus()
        win.print()
      }
      // The frame is removed a minute later, once the print dialog is long gone.
      setTimeout(() => frame.remove(), 60_000)
      resolve()
    }
    frame.srcdoc = html
    document.body.appendChild(frame)
  })
}
