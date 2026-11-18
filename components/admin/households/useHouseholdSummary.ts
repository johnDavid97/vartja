"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth, useDocumentEvents } from "@payloadcms/ui"

import { isHouseholdSummary } from "@/lib/household-admin-presentation"
import type { HouseholdSummary } from "@/features/households/application/GetHouseholdSummary"

export function useHouseholdSummary() {
  const { user } = useAuth()
  const pathname = usePathname()
  const { mostRecentUpdate } = useDocumentEvents()
  const [summary, setSummary] = useState<HouseholdSummary | null>(null)
  const request = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller

    try {
      const response = await fetch("/api/household-summary", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
      const body: unknown = await response.json().catch(() => null)
      if (response.ok && isHouseholdSummary(body)) setSummary(body)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // Keep the last confirmed value. In particular, never turn an error into a false zero.
      }
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      request.current?.abort()
      request.current = null
      return
    }

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
    }
  }, [pathname, refresh, user])

  useEffect(() => {
    if (!user || !mostRecentUpdate) return
    let active = true
    queueMicrotask(() => { if (active) void refresh() })
    return () => { active = false }
  }, [mostRecentUpdate, refresh, user])

  return { summary: user ? summary : null, refresh }
}
