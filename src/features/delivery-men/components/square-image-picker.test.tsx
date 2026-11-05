import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SquareImagePicker } from "./square-image-picker"

// The cropper itself needs a real canvas; here it is a stub that shows which image is being cropped and lets the
// test confirm or cancel it. The crop maths has its own test (crop-image.test.ts).
vi.mock("@/components/shared/image-crop-dialog", () => ({
  ImageCropDialog: ({
    file,
    title,
    description,
    onCancel,
    onConfirm,
  }: {
    file: File | null
    title: string
    description?: string
    onCancel: () => void
    onConfirm: (cropped: File) => void
  }) =>
    file ? (
      <div role="dialog" aria-label={title}>
        <p>Cropping {file.name}</p>
        {description ? <p>{description}</p> : null}
        <button onClick={() => onConfirm(new File(["sq"], `cropped-${file.name}.jpg`, { type: "image/jpeg" }))}>confirm crop</button>
        <button onClick={onCancel}>cancel crop</button>
      </div>
    ) : null,
}))

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview")
  URL.revokeObjectURL = vi.fn()
})

const image = (name: string, type = "image/png") => new File(["x"], name, { type })

function Harness({ max, initial = [], variant = "gallery" }: { max: number; initial?: File[]; variant?: "avatar" | "gallery" }) {
  const [files, setFiles] = useState<File[]>(initial)
  return (
    <>
      <SquareImagePicker variant={variant} id="pick" name="Identity image" max={max} files={files} onChange={setFiles} />
      <output data-testid="kept">{files.map((f) => f.name).join(",")}</output>
    </>
  )
}

const input = () => document.getElementById("pick") as HTMLInputElement
const pickFiles = (...files: File[]) => fireEvent.change(input(), { target: { files } })
const kept = () => screen.getByTestId("kept").textContent

describe("SquareImagePicker", () => {
  it("accepts images only", () => {
    render(<Harness max={5} />)
    expect(input().accept).toBe("image/jpeg,image/png,image/webp")
    expect(input().accept).not.toContain("pdf")
  })

  it("crops each picked image one at a time before keeping it", () => {
    render(<Harness max={5} />)
    pickFiles(image("a.png"), image("b.png"))
    expect(screen.getByText("Cropping a.png")).toBeInTheDocument()
    expect(screen.getByText(/Image 1 of 2/)).toBeInTheDocument()
    expect(kept()).toBe("")

    fireEvent.click(screen.getByText("confirm crop"))
    expect(screen.getByText("Cropping b.png")).toBeInTheDocument()
    expect(screen.getByText(/Image 2 of 2/)).toBeInTheDocument()
    fireEvent.click(screen.getByText("confirm crop"))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(kept()).toBe("cropped-a.png.jpg,cropped-b.png.jpg")
    expect(screen.getAllByRole("img")).toHaveLength(2)
  })

  it("skips an image whose crop is cancelled and keeps the rest", () => {
    render(<Harness max={5} />)
    pickFiles(image("a.png"), image("b.png"))
    fireEvent.click(screen.getByText("cancel crop"))
    fireEvent.click(screen.getByText("confirm crop"))
    expect(kept()).toBe("cropped-b.png.jpg")
  })

  it("refuses a PDF or an image over 5 MB without opening the cropper", () => {
    render(<Harness max={5} />)
    pickFiles(image("scan.pdf", "application/pdf"))
    expect(screen.getByRole("alert")).toHaveTextContent(/JPG, PNG or WebP/)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    pickFiles(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }))
    expect(screen.getByRole("alert")).toHaveTextContent(/5 MB/)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("stops at the limit", () => {
    render(<Harness max={2} initial={[image("one.jpg"), image("two.jpg")]} />)
    pickFiles(image("c.png"))
    expect(screen.getByRole("alert")).toHaveTextContent("You already added 2 images.")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("says how many more fit when too many are picked", () => {
    render(<Harness max={3} initial={[image("one.jpg"), image("two.jpg")]} />)
    pickFiles(image("c.png"), image("d.png"))
    expect(screen.getByRole("alert")).toHaveTextContent("You can add 1 more image.")
  })

  it("replaces the image when only one is allowed (profile photo)", () => {
    render(<Harness variant="avatar" max={1} initial={[image("old.jpg")]} />)
    pickFiles(image("new.png"))
    fireEvent.click(screen.getByText("confirm crop"))
    expect(kept()).toBe("cropped-new.png.jpg")
  })

  it("shows a clickable upload box that opens the file picker, and an Add image tile until the limit", () => {
    render(<Harness max={2} initial={[image("one.jpg")]} />)
    expect(screen.getByText("Add image").closest("label")).toHaveAttribute("for", "pick")
    expect(screen.getByText("1 of 2 added. Each image is cropped to a square.")).toBeInTheDocument()
    pickFiles(image("c.png"))
    fireEvent.click(screen.getByText("confirm crop"))
    expect(screen.queryByText("Add image")).not.toBeInTheDocument()
  })

  it("avatar: shows one large upload box, then the cropped photo with Change and Remove", () => {
    render(<Harness variant="avatar" max={1} />)
    expect(screen.getByText("Click to upload photo").closest("label")).toHaveAttribute("for", "pick")
    pickFiles(image("me.png"))
    fireEvent.click(screen.getByText("confirm crop"))
    expect(kept()).toBe("cropped-me.png.jpg")
    expect(screen.getByAltText("Identity image")).toBeInTheDocument()
    expect(screen.getByText("Click the photo to change it.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }))
    expect(kept()).toBe("")
    expect(screen.getByText("Click to upload photo")).toBeInTheDocument()
  })

  it("removes a kept image", () => {
    render(<Harness max={5} initial={[image("one.jpg"), image("two.jpg")]} />)
    fireEvent.click(screen.getByRole("button", { name: "Remove Identity image 1" }))
    expect(kept()).toBe("two.jpg")
  })
})
