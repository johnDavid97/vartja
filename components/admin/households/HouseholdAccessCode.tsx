"use client"

import { Copy, Eye, EyeOff } from "lucide-react"
import { useDocumentInfo } from "@payloadcms/ui"
import { useId, useState } from "react"
import type { UIFieldClientComponent } from "payload"

import { AdminButton } from "@/components/admin/AdminButton"

import styles from "./households.module.css"

type CodeAction = "reveal" | "rotate"
type AccessCodeResponse = { accessCode: string }

function householdIdFromDocumentId(documentId: unknown): number | null {
  const householdId = typeof documentId === "number" ? documentId : typeof documentId === "string" ? Number(documentId) : NaN
  return Number.isSafeInteger(householdId) && householdId > 0 ? householdId : null
}

function isAccessCodeResponse(value: unknown): value is AccessCodeResponse {
  return typeof value === "object" && value !== null
    && typeof (value as Record<string, unknown>).accessCode === "string"
    && (value as AccessCodeResponse).accessCode.length > 0
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

function formatMetadataDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function HouseholdCodeControls({ householdId, createdAt, updatedAt }: { householdId: number | null; createdAt: unknown; updatedAt: unknown }) {
  const headingId = useId()
  const [accessCode, setAccessCode] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<CodeAction | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [codeWasRotated, setCodeWasRotated] = useState(false)

  function hideCode() {
    setAccessCode(null)
    setStatusMessage("")
    setCodeWasRotated(false)
  }

  async function runCodeAction(action: CodeAction) {
    if (!householdId || loadingAction) return
    if (action === "rotate" && !window.confirm("Lage en ny husstandskode? Den forrige koden blir ugyldig med én gang.")) return
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

  const createdLabel = formatMetadataDate(createdAt)
  const updatedLabel = formatMetadataDate(updatedAt)

  return (
    <>
      <section className={styles.accessField} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.heading}>Husstandskode</h2>
        <p className={styles.description}>Familien bruker koden for å logge inn. Den vises bare når du ber om det.</p>
        {!householdId ? <p className={styles.description}>Lagre husstanden før en kode kan vises eller lages.</p> : null}
        <div className={styles.codeDisplay}>
          {accessCode
            ? <output className={styles.code} aria-label="Husstandskode">{accessCode}</output>
            : <div className={styles.maskedCode} aria-label="Husstandskoden er skjult">••••–••••–••••–••••</div>}
          <AdminButton
            className={styles.revealButton}
            variant="ghost"
            size="icon-sm"
            aria-label={accessCode ? "Skjul husstandskoden" : "Vis husstandskoden"}
            title={accessCode ? "Skjul kode" : "Vis kode"}
            disabled={!householdId || Boolean(loadingAction)}
            loading={loadingAction === "reveal"}
            onClick={accessCode ? hideCode : () => runCodeAction("reveal")}
          >
            {accessCode ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </AdminButton>
        </div>
        <div className={styles.actions}>
          <AdminButton variant="secondary" disabled={!accessCode || Boolean(loadingAction)} onClick={copyCode}>
            <Copy size={16} aria-hidden="true" />Kopier koden
          </AdminButton>
          <AdminButton variant="ghost" className={styles.rotateButton} disabled={!householdId || Boolean(loadingAction)} loading={loadingAction === "rotate"} onClick={() => runCodeAction("rotate")}>
            Lag ny kode
          </AdminButton>
        </div>
        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
        {codeWasRotated ? <p className={styles.warning} role="alert">Ny kode er laget. Den forrige koden er nå ugyldig.</p> : null}
        <p className={styles.immediateNote}>Visning og bytte loggføres separat. En ny kode gjelder med én gang og lagres ikke med «Lagre».</p>
        {statusMessage ? <p className={styles.status} role="status">{statusMessage}</p> : null}
      </section>
      {createdLabel || updatedLabel ? (
        <dl className={styles.metadata}>
          {createdLabel ? <div><dt>Opprettet</dt><dd>{createdLabel}</dd></div> : null}
          {updatedLabel ? <div><dt>Sist endret</dt><dd>{updatedLabel}</dd></div> : null}
        </dl>
      ) : null}
    </>
  )
}

const HouseholdAccessCode: UIFieldClientComponent = () => {
  const { id: documentId, data } = useDocumentInfo()
  const householdId = householdIdFromDocumentId(documentId)
  // The key clears the revealed secret when navigating between household documents.
  return <HouseholdCodeControls key={householdId ?? "unsaved"} householdId={householdId} createdAt={data?.createdAt} updatedAt={data?.updatedAt} />
}

export default HouseholdAccessCode
