"use client"

import Image from "next/image"
import { Copy, Download, ExternalLink, Eye, EyeOff, TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { AdminButton, adminButtonStyles } from "@/components/admin/AdminButton"
import {
  parseHouseholdInvitationDetails,
  presentHouseholdInvitation,
  type HouseholdInvitationDetails,
} from "@/lib/household-invitation-presentation"

import styles from "./invitation.module.css"

async function requestInvitationDetails(signal: AbortSignal): Promise<HouseholdInvitationDetails> {
  const response = await fetch("/api/household-invitation", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    signal,
  })
  const responseBody: unknown = await response.json().catch(() => null)
  const details = parseHouseholdInvitationDetails(responseBody)
  if (!response.ok || !details) throw new Error("Invitation request failed")
  return details
}

export default function HouseholdInvitationPanel() {
  const [details, setDetails] = useState<HouseholdInvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [copyMessage, setCopyMessage] = useState("")
  const [urlIsVisible, setUrlIsVisible] = useState(false)
  const requestNumber = useRef(0)
  const activeController = useRef<AbortController | null>(null)

  const loadInvitation = useCallback(async () => {
    const currentRequest = ++requestNumber.current
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller

    setLoading(true)
    setErrorMessage("")
    setCopyMessage("")
    setUrlIsVisible(false)
    setDetails(null)

    try {
      const nextDetails = await requestInvitationDetails(controller.signal)
      if (currentRequest === requestNumber.current && !controller.signal.aborted) {
        setDetails(nextDetails)
      }
    } catch {
      if (currentRequest === requestNumber.current && !controller.signal.aborted) {
        setErrorMessage("Kunne ikke hente invitasjonen. Prøv igjen.")
      }
    } finally {
      if (currentRequest === requestNumber.current && !controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void loadInvitation() })
    return () => {
      active = false
      requestNumber.current += 1
      activeController.current?.abort()
    }
  }, [loadInvitation])

  async function copyUrl() {
    if (!details) return
    try {
      await navigator.clipboard.writeText(details.registrationUrl)
      setCopyMessage("Invitasjonslenken er kopiert.")
    } catch {
      setCopyMessage("Kunne ikke kopiere automatisk. Vis, marker og kopier lenken manuelt.")
    }
  }

  const presentation = details ? presentHouseholdInvitation(details.registrationUrl) : null
  const svgDownloadUrl = details
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(details.qrSvg)}`
    : ""

  return (
    <section className={styles.panel} aria-labelledby="household-invitation-heading">
      <header className={styles.header}>
        <h1 id="household-invitation-heading" className={styles.heading}>Felles invitasjon</h1>
        <p className={styles.intro}>
          Én lenke og én QR-kode som alle gjestene bruker for å registrere husstanden sin. Bruk den samme QR-koden på alle invitasjonene.
        </p>
      </header>

      {loading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          Henter invitasjon …
        </div>
      ) : null}

      {errorMessage ? (
        <div className={styles.error} role="alert">
          <p>{errorMessage}</p>
          <AdminButton variant="secondary" onClick={() => void loadInvitation()}>Prøv igjen</AdminButton>
        </div>
      ) : null}

      {details && presentation ? (
        <>
          {presentation.isLocal ? (
            <aside className={styles.warning} aria-label="Lokalt domene">
              <TriangleAlert aria-hidden="true" size={24} />
              <div>
                <strong>Nettsiden bruker en lokal adresse</strong>
                <p>
                  QR-koden peker nå til <code>{presentation.host}</code> og kan ikke brukes av gjestene. Last ned den endelige koden når et offentlig domene er på plass – en nedlastet QR-kode endrer ikke adresse av seg selv.
                </p>
              </div>
            </aside>
          ) : null}

          <div className={styles.cards}>
            <article className={styles.linkCard}>
              <div>
                <h3 className={styles.cardHeading}>Registreringslenke</h3>
                <p className={styles.cardDescription}>
                  Del lenken på e-post eller melding. Adressen er maskert i feltet for diskresjon; QR-koden inneholder den samme lenken og kan skannes direkte.
                </p>
              </div>

              <div className={styles.addressGroup}>
                <label className={styles.label} htmlFor="household-invitation-url">Adresse</label>
                <div className={styles.addressField}>
                  <input
                    id="household-invitation-url"
                    className={styles.addressInput}
                    type="text"
                    readOnly
                    value={urlIsVisible ? details.registrationUrl : presentation.maskedUrl}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <AdminButton
                    className={styles.visibilityButton}
                    variant="plain"
                    size="icon"
                    onClick={() => setUrlIsVisible((visible) => !visible)}
                    aria-label={urlIsVisible ? "Skjul invitasjonsnøkkelen" : "Vis invitasjonsnøkkelen"}
                    aria-pressed={urlIsVisible}
                  >
                    {urlIsVisible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                  </AdminButton>
                </div>
              </div>

              <div className={styles.actions}>
                <AdminButton onClick={() => void copyUrl()}>
                  <Copy aria-hidden="true" size={18} />
                  Kopier lenken
                </AdminButton>
                <a
                  className={adminButtonStyles({ variant: "secondary" })}
                  href={details.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Åpne registreringsskjema
                  <ExternalLink aria-hidden="true" size={17} />
                </a>
              </div>
              {copyMessage ? <p className={styles.copyStatus} role="status">{copyMessage}</p> : null}

              <div className={styles.steps}>
                <h4>Slik fungerer det</h4>
                <ol>
                  <li>Gjesten åpner lenken eller skanner QR-koden.</li>
                  <li>De fyller inn navn på alle i husstanden.</li>
                  <li>Husstanden vises under Husstander med status «Venter», klar for godkjenning.</li>
                </ol>
              </div>
            </article>

            <article className={styles.qrCard}>
              <h3 className={styles.cardHeading}>QR-kode</h3>
              <Image
                className={styles.qrImage}
                src={details.qrDataUrl}
                alt="QR-kode til registreringsskjemaet"
                width={512}
                height={512}
                unoptimized
              />
              <p className={styles.domainCaption}>Peker til {presentation.host}</p>
              <a
                className={adminButtonStyles({ variant: "secondary", className: styles.downloadButton })}
                href={details.qrDataUrl}
                download="invitasjon-registrering.png"
              >
                <Download aria-hidden="true" size={18} />
                Last ned som PNG
              </a>
              {svgDownloadUrl ? (
                <a className={styles.svgDownload} href={svgDownloadUrl} download="invitasjon-registrering.svg">
                  Last ned som SVG (for trykk)
                </a>
              ) : null}
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}
