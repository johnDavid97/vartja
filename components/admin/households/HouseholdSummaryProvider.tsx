"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth, useDocumentEvents } from "@payloadcms/ui"
import { isHouseholdSummary } from "@/lib/household-admin-presentation"
import type { HouseholdSummary } from "@/features/households/application/GetHouseholdSummary"
import { HouseholdSummaryContext } from "./useHouseholdSummary"

export default function HouseholdSummaryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // Remount the session on identity changes: never reuse another administrator's state.
  return (
    <HouseholdSummarySession key={user ? `${user.collection}:${user.id}` : "anonymous"} enabled={Boolean(user)}>
      {children}
    </HouseholdSummarySession>
  )
}

function HouseholdSummarySession({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const pathname = usePathname()
  const tab = useSearchParams().get("tab") ?? "overview"
  const { mostRecentUpdate } = useDocumentEvents()
  const [summary, setSummary] = useState<HouseholdSummary | null>(null)
  const request = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    // Focus, polling and consumers can request a refresh simultaneously.
    if (!enabled || request.current) return
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await fetch("/api/household-summary", {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      })
      const body: unknown = await response.json().catch(() => null)
      if (!controller.signal.aborted && response.ok && isHouseholdSummary(body)) setSummary(body)
    } catch {
      // Retain the last confirmed count on failure, rather than inventing a zero.
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let active = true
    queueMicrotask(() => { if (active) void refresh() })
    const onFocus = () => void refresh()
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 60_000)
    window.addEventListener("focus", onFocus)
    return () => {
      active = false
      window.removeEventListener("focus", onFocus)
      window.clearInterval(poll)
      request.current?.abort()
      request.current = null
    }
  }, [enabled, pathname, tab, mostRecentUpdate, refresh])

  const value = useMemo(() => ({ summary, refresh }), [summary, refresh])
  return <HouseholdSummaryContext.Provider value={value}>{children}</HouseholdSummaryContext.Provider>
}
