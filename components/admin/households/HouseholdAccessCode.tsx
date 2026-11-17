"use client"

import { useDocumentInfo } from "@payloadcms/ui"
import { useId, useState } from "react"
import type { UIFieldClientComponent } from "payload"

import { AdminButton } from "@/components/admin/AdminButton"

import styles from "./households.module.css"

type CodeAction = "reveal" | "rotate"

type AccessCodeResponse = {
  accessCode: string
}

function householdIdFromDocumentId(documentId: unknown): number | null {
  const householdId = typeof documentId === "number" ? documentId : typeof documentId === "string" ? Number(documentId) : NaN
  return Number.isSafeInteger(householdId) && householdId > 0 ? householdId : null
}

function isAccessCodeResponse(value: unknown): value is AccessCodeResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).accessCode === "string" &&
    (value as { accessCode: string }).accessCode.length > 0
  )
}

async function requestAccessCode(householdId: number, action: CodeAction): Promise<string> {
  const response = await fetch("/api/household-code", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ householdId, action }),
  })
  const responseBody: unknown = await response.json().catch(() => null)
  if (!response.ok || !isAccessCodeResponse(responseBody)) throw new Error("Code request failed")
  return responseBody.accessCode
}

function HouseholdCodeControls({ householdId }: { householdId: number | null }) {
  const headingId = useId()
  const [accessCode, setAccessCode] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<CodeAction | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [codeWasRotated, setCodeWasRotated] = useState(false)

  async function runCodeAction(action: CodeAction) {
    if (!householdId || loadingAction) return
    if (action === "rotate") {
      const confirmed = window.confirm("Lage en ny husstandskode? Den forrige koden blir ugyldig med én gang.")
      if (!confirmed) return
    }

    setAccessCode(null)
    setCodeWasRotated(false)
    setErrorMessage("")
    setStatusMessage("")
    setLoadingAction(action)
    try {
      setAccessCode(await requestAccessCode(householdId, action))
      setCodeWasRotated(action === "rotate")
    } catch {
      setErrorMessage(action === "rotate" ? "Kunne ikke lage en ny kode. Prøv igjen." : "Kunne ikke vise husstandskoden. Prøv igjen.")
    } finally {
      setLoadingAction(null)
    }
  }

  async function copyCode() {
    if (!accessCode) return
    try {
      await navigator.clipboard.writeText(accessCode)
      setStatusMessage("Husstandskoden er kopiert.")
    } catch {
      setStatusMessage("Kunne ikke kopiere automatisk. Marker og kopier koden manuelt.")
    }
  }

  return (
    <section className={styles.accessField} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>Husstandskode</h3>
      <p className={styles.description}>Koden vises bare når du ber om det. Den lagres ikke i dette skjemaet.</p>
      {!householdId ? <p className={styles.description}>Lagre husstanden før en kode kan vises eller lages.</p> : null}
      <div className={styles.actions}>
        <AdminButton
          variant="secondary"
          disabled={!householdId || Boolean(loadingAction)}
          loading={loadingAction === "reveal"}
          onClick={() => runCodeAction("reveal")}
        >
          Vis husstandskode
        </AdminButton>
        <AdminButton
          variant="danger"
          disabled={!householdId || Boolean(loadingAction)}
          loading={loadingAction === "rotate"}
          onClick={() => runCodeAction("rotate")}
        >
          Lag ny kode
        </AdminButton>
      </div>
      {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
      {codeWasRotated ? <p className={styles.warning} role="alert">Ny kode er laget. Den forrige koden er nå ugyldig.</p> : null}
      {accessCode ? (
        <div className={styles.invitationResult}>
          <output className={styles.code} aria-label="Husstandskode">{accessCode}</output>
          <div className={styles.actions}>
            <AdminButton variant="secondary" onClick={copyCode}>Kopier koden</AdminButton>
          </div>
        </div>
      ) : null}
      {statusMessage ? <p className={styles.status} role="status">{statusMessage}</p> : null}
    </section>
  )
}

const HouseholdAccessCode: UIFieldClientComponent = () => {
  const { id: documentId } = useDocumentInfo()
  const householdId = householdIdFromDocumentId(documentId)
  // Never carry a revealed code into another household's document view.
  return <HouseholdCodeControls key={householdId ?? "unsaved"} householdId={householdId} />
}

export default HouseholdAccessCode
