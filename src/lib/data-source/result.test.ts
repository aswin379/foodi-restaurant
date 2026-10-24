// @vitest-environment node
import { describe, expect, it } from "vitest"

import { ServiceError } from "./errors"
import { ACTION_FAILURE_MESSAGES, runAction, toActionFailure } from "./result"

describe("runAction", () => {
  it("marks preview successes as simulated", async () => {
    await expect(runAction("preview", async () => "done")).resolves.toEqual({
      ok: true,
      data: "done",
      preview: true,
    })
  })

  it("marks API successes as real", async () => {
    await expect(runAction("api", async () => 1)).resolves.toEqual({ ok: true, data: 1, preview: false })
  })

  it("turns a missing API into a not_configured failure", async () => {
    const result = await runAction("api", async () => {
      throw new ServiceError("not_configured")
    })
    expect(result).toEqual({
      ok: false,
      reason: "not_configured",
      message: ACTION_FAILURE_MESSAGES.not_configured,
    })
  })

  it("keeps server field errors", async () => {
    const result = await runAction("api", async () => {
      throw new ServiceError("validation", "bad", { name: "Name is taken" })
    })
    expect(result).toMatchObject({ ok: false, reason: "validation", fieldErrors: { name: "Name is taken" } })
  })
})

describe("toActionFailure", () => {
  it("reports unknown errors as unavailable without exposing their text", () => {
    const failure = toActionFailure(new Error("ECONNREFUSED 10.0.0.5:5432 secret"))
    expect(failure).toEqual({ ok: false, reason: "unavailable", message: ACTION_FAILURE_MESSAGES.unavailable })
    expect(failure.message).not.toContain("secret")
  })

  it("never describes a failure as saved", () => {
    for (const message of Object.values(ACTION_FAILURE_MESSAGES)) {
      expect(message.toLowerCase()).not.toMatch(/\bsaved\b/)
    }
  })
})
