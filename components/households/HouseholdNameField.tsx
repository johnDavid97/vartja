"use client"

import { useEffect, useId, useRef } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_HOUSEHOLD_NAME_LENGTH, suggestHouseholdNames } from "@/features/households/domain/household-name"

import styles from "./household-name-field.module.css"

export interface HouseholdNameFieldProps {
  value: string
  onChange: (value: string) => void
  contactName: string
  additionalMemberNames: string[]
  disabled?: boolean
}

export function HouseholdNameField({
  value,
  onChange,
  contactName,
  additionalMemberNames,
  disabled = false,
}: HouseholdNameFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const suggestions = suggestHouseholdNames(contactName, additionalMemberNames)
  const preferredSuggestion = suggestions[0] ?? ""
  const previousSuggestion = useRef("")

  useEffect(() => {
    const previous = previousSuggestion.current
    if (preferredSuggestion === previous) return
    previousSuggestion.current = preferredSuggestion
    if (!disabled && preferredSuggestion && (value === "" || value === previous)) {
      onChange(preferredSuggestion)
    }
  }, [disabled, onChange, preferredSuggestion, value])

  return (
    <div className={styles.field}>
      <Label htmlFor={id}>Husstandsnavn</Label>
      <p id={hintId} className={styles.hint}>Dette navnet brukes ved innlogging og som navn ved kommentarer.</p>
      <Input
        id={id}
        name="displayName"
        type="text"
        required
        maxLength={MAX_HOUSEHOLD_NAME_LENGTH}
        value={value}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {suggestions.length > 0 ? (
        <div className={styles.suggestions} aria-label="Forslag til husstandsnavn">
          <span>Forslag:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled}
              aria-pressed={value === suggestion}
              onClick={() => onChange(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
