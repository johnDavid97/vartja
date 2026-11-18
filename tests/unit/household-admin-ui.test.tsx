import { describe, expect, it } from "vitest"

import {
  householdListDescription,
  householdMemberPresentation,
  householdStatus,
  isHouseholdSummary,
  memberInitials,
} from "@/lib/household-admin-presentation"

describe("household admin UI presentation", () => {
  it("validates summaries and never invents totals when a summary is unavailable", () => {
    expect(isHouseholdSummary({ total: 6, pending: 3 })).toBe(true)
    expect(isHouseholdSummary({ total: 2, pending: 3 })).toBe(false)
    expect(isHouseholdSummary({ total: "6", pending: 3 })).toBe(false)
    expect(householdListDescription(6, { total: 6, pending: 3 })).toBe("6 husstander · 3 venter")
    expect(householdListDescription(2, null)).toBe("2 husstander i denne visningen")
    expect(householdListDescription(2, { total: 6, pending: 3 })).toBe(
      "2 av 6 husstander · 3 venter totalt",
    )
  })

  it("uses first and last initials and limits the visible avatar stack", () => {
    expect(memberInitials("Kari Nordmann")).toBe("KN")
    expect(memberInitials(" Ola ")).toBe("O")

    expect(householdMemberPresentation([
      { name: "Kari Nordmann" },
      { name: "Ola Nordmann" },
      { name: "Eva Nordmann" },
      { name: "Per Nordmann" },
    ])).toEqual({ count: 4, initials: ["KN", "ON", "EN"] })
    expect(householdMemberPresentation([{ wrong: "shape" }, null])).toEqual({ count: 0, initials: [] })
  })

  it("maps household statuses to the requested Norwegian labels and tones", () => {
    expect(householdStatus("pending")).toEqual({ label: "Venter", tone: "pending" })
    expect(householdStatus("approved")).toEqual({ label: "Godkjent", tone: "approved" })
    expect(householdStatus("revoked")).toEqual({ label: "Avslått", tone: "revoked" })
    expect(householdStatus({})).toEqual({ label: "Ukjent", tone: "unknown" })
  })
})
