"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type FormEvent } from "react"

import { AdminButton, adminButtonStyles } from "@/components/admin/AdminButton"
import { HouseholdContactFields } from "@/components/households/HouseholdContactFields"
import { MemberListFields, type MemberFormRow } from "@/components/households/MemberListFields"
import { MAX_MEMBERS } from "@/features/households/domain/validation"

import styles from "./household-workspace.module.css"

type ContactDetails = { contactName: string; email: string }
type CreateResult = { householdId: number }
type CreateRequest = {
  requestKey: string
  contactName: string
  email: string
  additionalMembers: Array<{ name: string }>
}

class CreateResponseError extends Error {
  constructor(message: string, readonly ambiguous: boolean) {
    super(message)
  }
}

function isCreateResult(value: unknown): value is CreateResult {
  if (typeof value !== "object" || value === null) return false
  const id = (value as Record<string, unknown>).householdId
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
}

async function createHousehold(body: CreateRequest): Promise<CreateResult> {
  const response = await fetch("/api/household-admin", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const responseBody: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const serverMessage = typeof responseBody === "object" && responseBody !== null &&
      typeof (responseBody as Record<string, unknown>).error === "string"
      ? String((responseBody as Record<string, unknown>).error)
      : "Husstanden kunne ikke opprettes. Kontroller feltene og prøv igjen."
    throw new CreateResponseError(serverMessage, response.status >= 500)
  }
  if (!isCreateResult(responseBody)) throw new CreateResponseError("Vi fikk ikke bekreftet at husstanden ble opprettet.", true)
  return responseBody
}

export default function HouseholdCreateForm() {
  const router = useRouter()
  const [contact, setContact] = useState<ContactDetails>({ contactName: "", email: "" })
  const [additionalMembers, setAdditionalMembers] = useState<MemberFormRow[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const submittedRequest = useRef<CreateRequest | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [completed, setCompleted] = useState(false)
  const submitting = useRef(false)
  const fieldsLocked = pending || uncertain || completed

  function changed() {
    submittedRequest.current = null
    setError("")
  }

  function updateContact(next: ContactDetails) {
    if (fieldsLocked || submitting.current) return
    changed()
    setContact(next)
  }

  function updateMembers(allMembers: MemberFormRow[]) {
    if (fieldsLocked || submitting.current) return
    changed()
    setAdditionalMembers(allMembers.slice(1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || completed || submitting.current) return
    submitting.current = true
    setPending(true)
    setError("")
    try {
      // Retry the exact submitted snapshot, not the current editable form values.
      submittedRequest.current ??= {
        requestKey: crypto.randomUUID(),
        contactName: contact.contactName.trim(),
        email: contact.email.trim(),
        additionalMembers: additionalMembers.map(({ name }) => ({ name: name.trim() })),
      }
      const result = await createHousehold(submittedRequest.current)
      setCompleted(true)
      router.push(`/admin/collections/households/${encodeURIComponent(String(result.householdId))}`)
    } catch (caught) {
      // A later 4xx cannot prove that an earlier, ambiguous attempt was not saved.
      const outcomeUncertain = uncertain || !(caught instanceof CreateResponseError) || caught.ambiguous
      setUncertain(outcomeUncertain)
      if (!outcomeUncertain) submittedRequest.current = null
      const message = caught instanceof CreateResponseError ? caught.message : "Vi fikk ikke kontakt med serveren."
      setError(`${message} ${outcomeUncertain
        ? "Prøv igjen – samme forespørsel brukes trygt på nytt."
        : "Rett eventuelle feil og prøv på nytt."}`)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const members: MemberFormRow[] = [
    { rowKey: "admin-contact", name: contact.contactName },
    ...additionalMembers,
  ]

  return (
    <section className={styles.createPanel} aria-labelledby="new-household-heading">
      <header className={styles.createHeader}>
        <h1 id="new-household-heading">Ny husstand</h1>
        <p>Legg inn kontaktpersonen og alle som hører til husstanden.</p>
      </header>
      <form className={styles.createForm} onSubmit={submit} aria-busy={pending}>
        <HouseholdContactFields value={contact} onChange={updateContact} disabled={fieldsLocked} />
        <MemberListFields
          value={members}
          onChange={updateMembers}
          disabled={fieldsLocked}
          maxMembers={MAX_MEMBERS}
          buttonClassName={adminButtonStyles({ variant: "secondary", size: "sm" })}
          firstMemberLocked
          description="Kontaktpersonen er første familiemedlem. Legg til de andre i husstanden under."
        />
        <div className={styles.approvalNotice}>
          Husstanden og alle familiemedlemmene du legger inn her blir automatisk godkjent.
        </div>
        {uncertain ? <p role="status">Feltene er låst til vi vet om husstanden ble opprettet. Prøv igjen før du gjør endringer, eller sjekk oversikten før du oppretter på nytt.</p> : null}
        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
        <div className={styles.formActions}>
          <AdminButton type="submit" loading={pending} disabled={pending || completed}>
            {pending ? "Oppretter …" : "Opprett husstand"}
          </AdminButton>
          <Link href="/admin/collections/households?tab=overview" className={adminButtonStyles({ variant: "secondary" })}>
            Avbryt
          </Link>
        </div>
      </form>
    </section>
  )
}
