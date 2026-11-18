"use client"

import { createContext, useContext } from "react"
import type { HouseholdSummary } from "@/features/households/application/GetHouseholdSummary"

export const HouseholdSummaryContext = createContext<{
  summary: HouseholdSummary | null
  refresh: () => Promise<void>
} | null>(null)

/** All consumers share the authenticated admin provider's state and refresh lifecycle. */
export function useHouseholdSummary() {
  const context = useContext(HouseholdSummaryContext)
  if (!context) throw new Error("Household summary requires HouseholdSummaryProvider")
  return context
}
