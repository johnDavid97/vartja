"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, type FunctionComponent } from "react"
import type { BeforeListClientProps } from "payload"

import { AdminButton } from "@/components/admin/AdminButton"

import styles from "./households.module.css"

type InvitationDetails = {
  registrationUrl: string
  qrDataUrl: string
}

function isInvitationDetails(value: unknown): value is InvitationDetails {
  if (typeof value !== "object" || value === null) return false
  const details = value as Record<string, unknown>
  return (
    typeof details.registrationUrl === "string" &&
    details.registrationUrl.length > 0 &&
    typeof details.qrDataUrl === "string" &&
    details.qrDataUrl.startsWith("data:image/png;base64,")
  )
}

async function requestInvitationDetails(): Promise<InvitationDetails> {
  const response = await fetch("/api/household-invitation", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  const responseBody: unknown = await response.json().catch(() => null)
  if (!response.ok || !isInvitationDetails(responseBody)) throw new Error("Invitation request failed")
  return responseBody
}

const HouseholdInvitationPanel: FunctionComponent<BeforeListClientProps> = () => {
  const [details, setDetails] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [copyMessage, setCopyMessage] = useState("")

  async function showInvitation() {
    setLoading(true)
    setErrorMessage("")
    setCopyMessage("")
    try {
      setDetails(await requestInvitationDetails())
    } catch {
      setErrorMessage("Kunne ikke hente invitasjonslenken. Prøv igjen.")
    } finally {
      setLoading(false)
    }
  }

  async function copyUrl() {
    if (!details) return
    try {
      await navigator.clipboard.writeText(details.registrationUrl)
      setCopyMessage("Invitasjonslenken er kopiert.")
    } catch {
      setCopyMessage("Kunne ikke kopiere automatisk. Marker og kopier lenken manuelt.")
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="household-invitation-heading">
      <nav className={styles.navigation} aria-label="Brukeradministrasjon">
        <Link href="/admin/collections/households" aria-current="page">Husstander og gjester</Link>
        <Link href="/admin/collections/users">Administratorer</Link>
      </nav>
      <h2 id="household-invitation-heading" className={styles.heading}>Felles invitasjon til registrering</h2>
      <p className={styles.description}>
        Bruk samme QR-kode på alle invitasjonene. Last ned den endelige koden etter at nettsiden har fått sitt domene.
        En nedlastet QR-kode endrer ikke adresse av seg selv.
      </p>
      <div className={styles.actions}>
        <AdminButton onClick={showInvitation} loading={loading}>Vis invitasjonslenke</AdminButton>
      </div>
      {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
      {details ? (
        <div className={styles.invitationResult}>
          <p className={styles.description}>Adressen i QR-koden: <strong>{new URL(details.registrationUrl).origin}</strong></p>
          <label className={styles.label}>
            Registreringslenke
            <input className={styles.readonlyInput} type="text" readOnly value={details.registrationUrl} />
          </label>
          <div className={styles.actions}>
            <AdminButton variant="secondary" onClick={copyUrl}>Kopier lenken</AdminButton>
            <a className={styles.openLink} href={details.registrationUrl} target="_blank" rel="noopener noreferrer">Åpne registreringsskjema</a>
          </div>
          {copyMessage ? <p className={styles.status} role="status">{copyMessage}</p> : null}
          {/* The authenticated server creates this PNG; no invitation value is sent to a QR service. */}
          <Image
            className={styles.qrImage}
            src={details.qrDataUrl}
            alt="QR-kode til registreringsskjemaet"
            width={280}
            height={280}
            unoptimized
          />
          <a className={styles.downloadLink} href={details.qrDataUrl} download="invitasjon-registrering.png">Last ned QR-kode som PNG</a>
        </div>
      ) : null}
    </section>
  )
}

export default HouseholdInvitationPanel
