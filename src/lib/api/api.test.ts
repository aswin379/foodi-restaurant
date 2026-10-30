// @vitest-environment node
import { describe, expect, it } from "vitest"

import { ORDER_TYPES } from "@/lib/domain/order-types"

import { createIdempotencyKey, IDEMPOTENCY_FIELD, readIdempotencyKey } from "./idempotency"
import {
  fromApiDeliveryMode,
  fromApiOrderType,
  toApiDeliveryMode,
  toApiOrderType,
} from "./mapping"
import { getApiTransport } from "./transport"

describe("transport", () => {
  it("reports not_configured until a backend is connected", async () => {
    await expect(getApiTransport().request({ method: "GET", path: "anything" })).rejects.toMatchObject({
      kind: "not_configured",
    })
  })
})

describe("mapping", () => {
  it("round-trips every PRD order type", () => {
    for (const type of ORDER_TYPES) {
      expect(fromApiOrderType(toApiOrderType(type))).toBe(type)
    }
  })

  it("uses the PRD name takeaway, not pickup", () => {
    expect(toApiOrderType("takeaway")).toBe("takeaway")
    expect(() => fromApiOrderType("pickup")).toThrow(expect.objectContaining({ kind: "unavailable" }))
  })

  it("rejects unknown API values instead of guessing", () => {
    expect(() => fromApiOrderType("drive_thru")).toThrow(expect.objectContaining({ kind: "unavailable" }))
    expect(() => fromApiDeliveryMode("courier")).toThrow(expect.objectContaining({ kind: "unavailable" }))
    expect(fromApiDeliveryMode(toApiDeliveryMode("restaurant"))).toBe("restaurant")
  })
})

describe("idempotency", () => {
  it("creates distinct keys that read back from form data", () => {
    const first = createIdempotencyKey()
    expect(first).not.toBe(createIdempotencyKey())

    const formData = new FormData()
    formData.set(IDEMPOTENCY_FIELD, first)
    expect(readIdempotencyKey(formData)).toBe(first)
  })

  it("rejects missing or malformed keys", () => {
    const formData = new FormData()
    expect(readIdempotencyKey(formData)).toBeNull()
    formData.set(IDEMPOTENCY_FIELD, "1234")
    expect(readIdempotencyKey(formData)).toBeNull()
  })
})
