"use client"

import { useId } from "react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { HouseholdInput } from "@/features/households/domain/models"
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH } from "@/features/households/domain/validation"

import styles from "./household-fields.module.css"

type HouseholdContactDetails = Pick<HouseholdInput, "contactName" | "email">

export interface HouseholdContactFieldsProps {
  value: HouseholdContactDetails
  onChange: (contactDetails: HouseholdContactDetails) => void
  disabled?: boolean
  errors?: Partial<Record<keyof HouseholdContactDetails, string>>
  className?: string
}

export function HouseholdContactFields({
  value: contactDetails,
  onChange: onContactDetailsChange,
  disabled = false,
  errors = {},
  className,
}: HouseholdContactFieldsProps) {
  const fieldsetId = useId()
  const contactNameId = `${fieldsetId}-contact-name`
  const emailId = `${fieldsetId}-email`
  const contactNameErrorId = `${contactNameId}-error`
  const emailErrorId = `${emailId}-error`

  function updateContactField(fieldName: keyof HouseholdContactDetails, fieldValue: string) {
    if (disabled) return
    onContactDetailsChange({ ...contactDetails, [fieldName]: fieldValue })
  }

  return (
    <fieldset className={cn(styles.fieldset, className)} disabled={disabled}>
      <legend className={styles.legend}>Kontaktopplysninger</legend>
      <p className={styles.description}>
        E-postadressen er kontaktinformasjon. Du trenger ikke bekrefte den, og vi sender ingen e-post nå.
      </p>

      <div className={styles.fields}>
        <div className={styles.field}>
          <Label htmlFor={contactNameId}>Navn på kontaktperson</Label>
          <Input
            id={contactNameId}
            name="contactName"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            required
            autoComplete="name"
            value={contactDetails.contactName}
            onChange={(event) => updateContactField("contactName", event.currentTarget.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.contactName) || undefined}
            aria-describedby={errors.contactName ? contactNameErrorId : undefined}
          />
          {errors.contactName ? (
            <p id={contactNameErrorId} className={styles.error}>
              {errors.contactName}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <Label htmlFor={emailId}>E-postadresse</Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            maxLength={MAX_EMAIL_LENGTH}
            required
            inputMode="email"
            autoComplete="email"
            value={contactDetails.email}
            onChange={(event) => updateContactField("email", event.currentTarget.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? emailErrorId : undefined}
          />
          {errors.email ? (
            <p id={emailErrorId} className={styles.error}>
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>
    </fieldset>
  )
}
