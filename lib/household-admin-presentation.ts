import type { HouseholdSummary } from "@/features/households/application/GetHouseholdSummary"

export type HouseholdStatusPresentation = {
  label: string
  tone: "pending" | "approved" | "revoked" | "unknown"
}

export function isHouseholdSummary(value: unknown): value is HouseholdSummary {
  if (typeof value !== "object" || value === null) return false
  const summary = value as Record<string, unknown>
  return (
    Number.isInteger(summary.total) &&
    Number(summary.total) >= 0 &&
    Number.isInteger(summary.pending) &&
    Number(summary.pending) >= 0 &&
    Number(summary.pending) <= Number(summary.total)
  )
}

export function householdStatus(value: unknown): HouseholdStatusPresentation {
  if (value === "pending") return { label: "Venter", tone: "pending" }
  if (value === "approved") return { label: "Godkjent", tone: "approved" }
  if (value === "revoked") return { label: "Avslått", tone: "revoked" }
  return { label: "Ukjent", tone: "unknown" }
}

export function memberInitials(name: unknown): string {
  if (typeof name !== "string") return "?"
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const initials = words.length === 1 ? words[0][0] : `${words[0][0]}${words.at(-1)?.[0] ?? ""}`
  return initials.toLocaleUpperCase("nb-NO")
}

export function householdMemberPresentation(value: unknown): { count: number; initials: string[] } {
  if (!Array.isArray(value)) return { count: 0, initials: [] }
  const names = value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return []
    const name = (item as Record<string, unknown>).name
    return typeof name === "string" && name.trim() ? [name.trim()] : []
  })
  return { count: names.length, initials: names.slice(0, 3).map(memberInitials) }
}

export function householdListDescription(
  visible: number,
  summary: HouseholdSummary | null,
): string {
  const visibleLabel = `${visible} ${visible === 1 ? "husstand" : "husstander"} i denne visningen`
  if (!summary) return visibleLabel
  if (visible === summary.total) {
    return `${visible} ${visible === 1 ? "husstand" : "husstander"} · ${summary.pending} venter`
  }
  return `${visible} av ${summary.total} husstander · ${summary.pending} venter totalt`
}
