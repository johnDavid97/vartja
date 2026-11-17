"use client"

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HouseholdContactFields } from "@/components/households/HouseholdContactFields"
import { MemberListFields, type MemberFormRow } from "@/components/households/MemberListFields"
import { MAX_MEMBERS } from "@/features/households/domain/validation"

import styles from "./registration.module.css"

const invitationKeyPattern = /^[A-Za-z0-9_-]{32,512}$/

type RegistrationRequest = {
  invitationKey: string
  requestKey: string
  contactName: string
  email: string
  additionalMembers: Array<{ name: string }>
}

type RegistrationResult = {
  householdId: number
  accessCode: string
  status: "pending"
}

type ContactDetails = {
  contactName: string
  email: string
}

export function invitationKeyFromFragment(fragment: string): string | null {
  if (!fragment.startsWith("#")) return null
  const parameters = new URLSearchParams(fragment.slice(1))
  const invitationKeys = parameters.getAll("invitation")
  if (invitationKeys.length !== 1 || Array.from(parameters.keys()).some((key) => key !== "invitation")) return null
  const invitationKey = invitationKeys[0]
  return invitationKeyPattern.test(invitationKey) ? invitationKey : null
}

function isRegistrationResult(value: unknown): value is RegistrationResult {
  if (typeof value !== "object" || value === null) return false
  const result = value as Record<string, unknown>
  return (
    Number.isInteger(result.householdId) &&
    typeof result.accessCode === "string" &&
    result.accessCode.length > 0 &&
    result.status === "pending"
  )
}

async function submitRegistration(request: RegistrationRequest): Promise<RegistrationResult> {
  const response = await fetch("/api/household-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  const responseBody: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const serverMessage =
      typeof responseBody === "object" && responseBody !== null && typeof (responseBody as { error?: unknown }).error === "string"
        ? (responseBody as { error: string }).error
        : null
    throw new RegistrationResponseError(serverMessage ?? "Registreringen kunne ikke fullføres. Prøv igjen.")
  }
  if (!isRegistrationResult(responseBody)) {
    throw new Error("Ugyldig svar")
  }
  return responseBody
}

class RegistrationResponseError extends Error {}

function subscribeToFragmentChange(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange)
  return () => window.removeEventListener("hashchange", onStoreChange)
}

function getFragmentSnapshot() {
  return window.location.hash
}

function getServerFragmentSnapshot() {
  return ""
}

export function RegistrationSuccess({ accessCode }: { accessCode: string }) {
  const [copyMessage, setCopyMessage] = useState("")

  async function copyAccessCode() {
    try {
      await navigator.clipboard.writeText(accessCode)
      setCopyMessage("Koden er kopiert.")
    } catch {
      setCopyMessage("Kunne ikke kopiere automatisk. Marker og kopier koden manuelt.")
    }
  }

  return (
    <Card className={styles.successCard} role="status">
      <CardHeader>
        <CardTitle className={styles.successTitle}>Husstanden er registrert</CardTitle>
        <CardDescription>
          Registreringen venter på godkjenning fra brudeparet. Ta vare på koden mens dere venter.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.successContent}>
        <p className={styles.codeLabel}>Husstandskode</p>
        <output className={styles.accessCode}>{accessCode}</output>
        <div className={styles.successActions}>
          <Button type="button" onClick={copyAccessCode}>Kopier koden</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>Skriv ut</Button>
        </div>
        {copyMessage ? <p className={styles.copyMessage} aria-live="polite">{copyMessage}</p> : null}
        <p>Lagre, skriv ned eller skriv ut koden nå. Av sikkerhetsgrunner vises den ikke automatisk igjen.</p>
        <p>Innlogging med koden blir koblet til senere. Koden kan derfor ikke brukes til innlogging ennå.</p>
      </CardContent>
    </Card>
  )
}

export default function RegistrationForm() {
  const fragment = useSyncExternalStore(subscribeToFragmentChange, getFragmentSnapshot, getServerFragmentSnapshot)
  const invitationKey = invitationKeyFromFragment(fragment)
  const [contactDetails, setContactDetails] = useState<ContactDetails>({ contactName: "", email: "" })
  const [additionalMembers, setAdditionalMembers] = useState<MemberFormRow[]>([])
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const retryRequestKey = useRef<string | null>(null)

  function updateContactDetails(nextContactDetails: ContactDetails) {
    retryRequestKey.current = null
    setErrorMessage("")
    setContactDetails(nextContactDetails)
  }

  function updateAdditionalMembers(allMembers: MemberFormRow[]) {
    retryRequestKey.current = null
    setErrorMessage("")
    setAdditionalMembers(allMembers.slice(1))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!invitationKey || pending || result) return

    const requestKey = retryRequestKey.current ?? crypto.randomUUID()
    retryRequestKey.current = requestKey
    setPending(true)
    setErrorMessage("")

    try {
      const registrationResult = await submitRegistration({
        invitationKey,
        requestKey,
        contactName: contactDetails.contactName.trim(),
        email: contactDetails.email.trim(),
        additionalMembers: additionalMembers.map(({ name }) => ({ name: name.trim() })),
      })
      setResult(registrationResult)
    } catch (error) {
      // Preserve the request key even for HTTP failures: the server may have
      // committed before a gateway or connection returned an ambiguous error.
      setErrorMessage(
        error instanceof RegistrationResponseError
          ? error.message
          : "Vi fikk ikke bekreftet registreringen. Kontroller nettet og prøv igjen; samme forespørsel brukes trygt på nytt.",
      )
    } finally {
      setPending(false)
    }
  }

  if (!invitationKey) {
    return (
      <Card className={styles.messageCard}>
        <CardHeader>
          <CardTitle>Åpne lenken fra invitasjonen</CardTitle>
          <CardDescription>Registreringsskjemaet er bare tilgjengelig fra den komplette invitasjonslenken eller QR-koden.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (result) return <RegistrationSuccess accessCode={result.accessCode} />

  const members: MemberFormRow[] = [
    { rowKey: "registration-contact", name: contactDetails.contactName },
    ...additionalMembers,
  ]

  return (
    <Card className={styles.formCard}>
      <CardHeader>
        <CardTitle className={styles.title}>Registrer husstanden</CardTitle>
        <CardDescription>Kontaktpersonen blir automatisk første familiemedlem. Registreringen er ikke et svar på invitasjonen.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className={styles.form} onSubmit={handleSubmit} aria-busy={pending}>
          <HouseholdContactFields value={contactDetails} onChange={updateContactDetails} disabled={pending} />
          <MemberListFields
            value={members}
            onChange={updateAdditionalMembers}
            disabled={pending}
            maxMembers={MAX_MEMBERS}
            firstMemberLocked
            description="Kontaktpersonen er lagt til automatisk. Legg bare til de andre i husstanden. Feltene er valgfrie frem til du legger til en rad."
          />
          {errorMessage ? <p className={styles.submitError} role="alert">{errorMessage}</p> : null}
          <Button className={styles.submitButton} type="submit" size="lg" disabled={pending}>
            {pending ? "Registrerer …" : "Registrer husstanden"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
