// @vitest-environment node
import { describe, expect, it } from "vitest"

import { planFromApi } from "./api-mapping"

const expected = { currency: "INR" }
const inr = (amountMinor: number) => ({ amountMinor, currency: "INR" })
const fixedTerm = { label: "Fee per order", basis: "per_order", amount: inr(1111) }
const percentTerm = { label: "Percentage fee", basis: "percentage_of_order", rateBasisPoints: 1234 }
const plan = {
  id: "plan_1",
  name: "Test plan",
  model: "hybrid",
  status: "active",
  renewsOn: "2026-11-20",
  trialEndsOn: "2026-11-01",
  periodStart: "2026-10-20",
  periodEnd: "2026-11-19",
  notice: "Some wording from the service.",
  entitlements: [{ label: "Entitlement A", detail: "Detail" }, { label: "Entitlement B" }],
  feeTerms: [
    { ...fixedTerm, tax: { label: "Tax", treatment: "excluded", rateBasisPoints: 1111 } },
    { ...percentTerm, tax: { label: "Tax", treatment: "included" } },
    { label: "Period fee", basis: "per_period", amount: inr(111100) },
  ],
}
const rejects = (run: () => unknown) => expect(run).toThrow(expect.objectContaining({ kind: "unavailable" }))
const withTerm = (term: unknown) => ({ ...plan, feeTerms: [term] })

describe("planFromApi", () => {
  it("maps a complete plan as supplied", () => {
    expect(planFromApi(plan, expected)).toEqual({
      ...plan,
      entitlements: [{ label: "Entitlement A", detail: "Detail" }, { label: "Entitlement B", detail: null }],
      feeTerms: [
        { ...fixedTerm, rateBasisPoints: null, tax: { label: "Tax", treatment: "excluded", rateBasisPoints: 1111 } },
        { ...percentTerm, amount: null, tax: { label: "Tax", treatment: "included", rateBasisPoints: null } },
        { label: "Period fee", basis: "per_period", amount: inr(111100), rateBasisPoints: null, tax: null },
      ],
    })
  })

  it("keeps every optional value null, never a default, and needs only an id, a name and the two lists", () => {
    expect(planFromApi({ id: "plan_2", name: "Bare", entitlements: [], feeTerms: [] }, expected)).toEqual({
      id: "plan_2",
      name: "Bare",
      model: null,
      status: null,
      renewsOn: null,
      trialEndsOn: null,
      periodStart: null,
      periodEnd: null,
      notice: null,
      entitlements: [],
      feeTerms: [],
    })
  })

  it("derives nothing: no total, no status from a date, no tax amount", () => {
    const mapped = planFromApi({ ...plan, renewsOn: "2000-01-01", status: null }, expected)
    expect(mapped.status).toBeNull()
    expect(Object.keys(mapped).sort()).toEqual(
      ["entitlements", "feeTerms", "id", "model", "name", "notice", "periodEnd", "periodStart", "renewsOn", "status", "trialEndsOn"]
    )
    expect(JSON.stringify(mapped.feeTerms)).not.toMatch(/total|taxAmount|inclusive/i)
  })

  it("reads only known fields: payment, card, bank, UPI and tax-ID details never reach the model", () => {
    const mapped = planFromApi(
      {
        ...plan,
        card: "0000111122223333",
        upi: "someone@bank",
        bankAccount: "000011112222",
        taxId: "TAX-0000",
        restaurantId: "r1",
        feeTerms: [{ ...fixedTerm, cardOnFile: "0000111122223333" }],
      },
      expected
    )
    expect(JSON.stringify(mapped)).not.toMatch(/0000111122223333|someone@bank|000011112222|TAX-0000|restaurantId|cardOnFile/)
  })

  it.each(["commission", "subscription", "hybrid"])("accepts the proposed model %s", (model) => {
    expect(planFromApi({ ...plan, model }, expected).model).toBe(model)
  })

  it.each(["active", "trialing", "past_due", "expired", "cancelled"])("accepts the proposed status %s", (status) => {
    expect(planFromApi({ ...plan, status }, expected).status).toBe(status)
  })

  it.each([
    ["an unknown model", { model: "freemium" }],
    ["a model in another case", { model: "Hybrid" }],
    ["an unknown status", { status: "paid" }],
    ["a status in another case", { status: "ACTIVE" }],
    ["a numeric status", { status: 1 }],
    ["a bad plan id", { id: "a/b" }],
    ["a missing plan id", { id: undefined }],
    ["a blank name", { name: "  " }],
    ["a very long name", { name: "x".repeat(200) }],
    ["a missing entitlements list", { entitlements: undefined }],
    ["a missing fee terms list", { feeTerms: undefined }],
    ["a non-array fee terms list", { feeTerms: "x" }],
    ["too many entitlements", { entitlements: Array(51).fill({ label: "x" }) }],
    ["too many fee terms", { feeTerms: Array(21).fill(fixedTerm) }],
    ["a blank notice", { notice: " " }],
    ["a very long notice", { notice: "x".repeat(400) }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => planFromApi({ ...plan, ...patch }, expected))
  })

  it.each([
    ["a timestamp as renewal date", { renewsOn: "2026-11-20T00:00:00Z" }],
    ["a date that does not exist", { renewsOn: "2026-02-30" }],
    ["a bad month", { trialEndsOn: "2026-13-01" }],
    ["a text date", { periodStart: "next week" }],
    ["a period that ends before it starts", { periodStart: "2026-11-20", periodEnd: "2026-11-19" }],
  ])("refuses %s", (_label, patch) => {
    rejects(() => planFromApi({ ...plan, ...patch }, expected))
  })

  it("accepts a period with only one end, and a one-day period", () => {
    expect(planFromApi({ ...plan, periodEnd: undefined }, expected).periodEnd).toBeNull()
    expect(planFromApi({ ...plan, periodStart: "2026-10-20", periodEnd: "2026-10-20" }, expected).periodStart).toBe("2026-10-20")
  })

  describe("fee terms", () => {
    it.each([
      ["a fixed fee with no amount", { label: "x", basis: "per_order" }],
      ["a fixed fee that also has a rate", { ...fixedTerm, rateBasisPoints: 100 }],
      ["a per-period fee with a rate only", { label: "x", basis: "per_period", rateBasisPoints: 100 }],
      ["a percentage with no rate", { label: "x", basis: "percentage_of_order" }],
      ["a percentage that also has an amount", { ...percentTerm, amount: inr(1) }],
      ["an unknown basis", { ...fixedTerm, basis: "flat" }],
      ["a blank label", { ...fixedTerm, label: "" }],
      ["a fractional amount", { ...fixedTerm, amount: inr(10.5) }],
      ["a negative amount", { ...fixedTerm, amount: inr(-1) }],
      ["an unsafe amount", { ...fixedTerm, amount: inr(2 ** 60) }],
      ["a string amount", { ...fixedTerm, amount: { amountMinor: "100", currency: "INR" } }],
      ["another currency", { ...fixedTerm, amount: { amountMinor: 100, currency: "USD" } }],
      ["a missing currency", { ...fixedTerm, amount: { amountMinor: 100 } }],
      ["a fractional rate", { ...percentTerm, rateBasisPoints: 12.5 }],
      ["a negative rate", { ...percentTerm, rateBasisPoints: -1 }],
      ["a rate over 100 percent", { ...percentTerm, rateBasisPoints: 10_001 }],
      ["a rate as a string", { ...percentTerm, rateBasisPoints: "1234" }],
      ["a term that is not an object", "fee"],
    ])("refuses %s", (_label, term) => {
      rejects(() => planFromApi(withTerm(term), expected))
    })

    it("accepts a zero amount, a zero rate and the 100 percent limit", () => {
      expect(planFromApi(withTerm({ ...fixedTerm, amount: inr(0) }), expected).feeTerms[0].amount).toEqual(inr(0))
      expect(planFromApi(withTerm({ ...percentTerm, rateBasisPoints: 0 }), expected).feeTerms[0].rateBasisPoints).toBe(0)
      expect(planFromApi(withTerm({ ...percentTerm, rateBasisPoints: 10_000 }), expected).feeTerms[0].rateBasisPoints).toBe(10_000)
    })

    it.each([
      ["an unknown treatment", { label: "Tax", treatment: "exempt" }],
      ["a missing treatment", { label: "Tax" }],
      ["a blank tax label", { label: " ", treatment: "excluded" }],
      ["a fractional tax rate", { label: "Tax", treatment: "excluded", rateBasisPoints: 18.5 }],
      ["a tax rate over 100 percent", { label: "Tax", treatment: "excluded", rateBasisPoints: 10_001 }],
      ["a negative tax rate", { label: "Tax", treatment: "excluded", rateBasisPoints: -1 }],
      ["a tax that is not an object", "Tax"],
    ])("refuses %s", (_label, tax) => {
      rejects(() => planFromApi(withTerm({ ...fixedTerm, tax }), expected))
    })

    it("accepts both proposed tax treatments and keeps a missing tax rate null", () => {
      for (const treatment of ["excluded", "included"] as const) {
        expect(planFromApi(withTerm({ ...fixedTerm, tax: { label: "Tax", treatment } }), expected).feeTerms[0].tax).toEqual({
          label: "Tax",
          treatment,
          rateBasisPoints: null,
        })
      }
    })
  })

  describe("entitlements", () => {
    it.each([
      ["a blank label", { label: "" }],
      ["a missing label", {}],
      ["a blank detail", { label: "x", detail: " " }],
      ["a very long detail", { label: "x", detail: "x".repeat(300) }],
      ["an entitlement that is not an object", "x"],
    ])("refuses %s", (_label, entitlement) => {
      rejects(() => planFromApi({ ...plan, entitlements: [entitlement] }, expected))
    })
  })

  it("never repeats a refused value in the error", () => {
    try {
      planFromApi(withTerm({ ...fixedTerm, amount: { amountMinor: "0000111122223333", currency: "INR" } }), expected)
      expect.unreachable()
    } catch (error) {
      expect(String((error as Error).message)).not.toMatch(/0000/)
    }
  })

  it.each([null, "x", 1, [], undefined])("refuses %j as a plan", (value) => {
    rejects(() => planFromApi(value, expected))
  })
})
