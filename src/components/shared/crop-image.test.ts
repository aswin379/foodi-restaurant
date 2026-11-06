// @vitest-environment node
import { describe, expect, it } from "vitest"

import { MAX_OUTPUT_PX, cropPlan } from "./crop-image"

describe("cropPlan", () => {
  it("keeps the crop size when it is already small, and shifts the image by the crop origin", () => {
    expect(cropPlan({ x: 100, y: 40, width: 300, height: 300 }, 800, 600)).toEqual({
      size: 300,
      dx: -100,
      dy: -40,
      dw: 800,
      dh: 600,
    })
  })

  it("scales a big crop down so its longest side is at most the cap, always square", () => {
    const plan = cropPlan({ x: 0, y: 0, width: 4000, height: 4000 }, 4000, 3000)
    expect(plan.size).toBe(MAX_OUTPUT_PX)
    expect(plan.dw).toBe(MAX_OUTPUT_PX)
    expect(plan.dh).toBe(MAX_OUTPUT_PX * 0.75)
  })

  it("lets the frame reach outside the image (zoomed out to fit a whole ID card), leaving the border for padding", () => {
    // A 1000x600 card in a 1000x1000 frame: the frame starts 200px above the image.
    const plan = cropPlan({ x: 0, y: -200, width: 1000, height: 1000 }, 1000, 600)
    expect(plan.dy).toBe(200)
    expect(plan.dy + plan.dh).toBeLessThanOrEqual(plan.size)
  })
})
