"use client"

import { useId, type ReactNode } from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MemberInput } from "@/features/households/domain/models"
import { MAX_MEMBERS, MAX_NAME_LENGTH } from "@/features/households/domain/validation"

import { createAvailableMemberRowKey } from "./member-row-key"
import styles from "./household-fields.module.css"

/** Presentation identity only. Strip rowKey when mapping the form to a domain DTO. */
export interface MemberFormRow extends MemberInput {
  rowKey: string
}

export interface MemberListFieldsProps {
  value: readonly MemberFormRow[]
  onChange: (members: MemberFormRow[]) => void
  disabled?: boolean
  maxMembers?: number
  errors?: readonly (string | undefined)[]
  className?: string
  buttonClassName?: string
  description?: ReactNode
  firstMemberLocked?: boolean
}

export function MemberListFields({
  value: members,
  onChange: onMembersChange,
  disabled = false,
  maxMembers = MAX_MEMBERS,
  errors = [],
  className,
  buttonClassName,
  description,
  firstMemberLocked = false,
}: MemberListFieldsProps) {
  const fieldsetId = useId()
  if (!Number.isInteger(maxMembers) || maxMembers < 1 || maxMembers > MAX_MEMBERS) {
    throw new RangeError(`maxMembers must be an integer between 1 and ${MAX_MEMBERS}.`)
  }
  const hasReachedMemberLimit = members.length >= maxMembers
  const canRemoveMember = !disabled && members.length > 1
  const descriptionId = `${fieldsetId}-description`
  const countId = `${fieldsetId}-count`

  function updateMemberName(editedMemberIndex: number, memberName: string) {
    if (disabled || (firstMemberLocked && editedMemberIndex === 0)) return
    const updatedMembers = members.map((member, memberIndex) =>
      memberIndex === editedMemberIndex ? { ...member, name: memberName } : member,
    )
    onMembersChange(updatedMembers)
  }

  function removeMember(removedMemberIndex: number) {
    if (!canRemoveMember || (firstMemberLocked && removedMemberIndex === 0)) return
    const remainingMembers = members.filter((_, memberIndex) => memberIndex !== removedMemberIndex)
    onMembersChange(remainingMembers)
  }

  function addMember() {
    if (disabled || hasReachedMemberLimit) return

    // The parent owns row identity alongside the controlled value. Rejected or
    // delayed updates cannot desynchronise a second internal list of row keys.
    const newMember: MemberFormRow = {
      rowKey: createAvailableMemberRowKey(`${fieldsetId}-new`, members.map((member) => member.rowKey)),
      name: "",
    }
    onMembersChange([...members, newMember])
  }

  return (
    <fieldset
      className={cn(styles.fieldset, className)}
      disabled={disabled}
      aria-describedby={`${descriptionId} ${countId}`}
    >
      <legend className={styles.legend}>Familiemedlemmer</legend>
      <p id={descriptionId} className={styles.description}>
        {description ?? "Legg til alle i husstanden, også kontaktpersonen. Registrering av husstanden er ikke et svar på invitasjonen."}
      </p>

      <ol className={styles.memberList}>
        {members.map((member, memberIndex) => {
          const inputId = `${fieldsetId}-${member.rowKey}-name`
          const memberError = errors[memberIndex]
          const errorId = `${inputId}-error`

          return (
            <li className={styles.memberRow} key={member.rowKey}>
              <div className={cn(styles.field, styles.memberField)}>
                {firstMemberLocked && memberIndex === 0 ? (
                  <span className={styles.lockedLabel}>Kontaktperson (familiemedlem 1)</span>
                ) : (
                  <Label htmlFor={inputId}>Navn på familiemedlem {memberIndex + 1}</Label>
                )}
                {firstMemberLocked && memberIndex === 0 ? (
                  <p id={inputId} className={styles.lockedContact}>
                    {member.name || "Kontaktpersonens navn vises her"}
                  </p>
                ) : (
                  <Input
                    id={inputId}
                    name={`members.${memberIndex}.name`}
                    type="text"
                    maxLength={MAX_NAME_LENGTH}
                    required
                    autoComplete="name"
                    value={member.name}
                    onChange={(event) => updateMemberName(memberIndex, event.currentTarget.value)}
                    disabled={disabled}
                    aria-invalid={Boolean(memberError) || undefined}
                    aria-describedby={memberError ? errorId : undefined}
                  />
                )}
                {memberError ? (
                  <p id={errorId} className={styles.error}>
                    {memberError}
                  </p>
                ) : null}
              </div>
              <Button
                className={buttonClassName}
                type="button"
                variant="outline"
                onClick={() => removeMember(memberIndex)}
                disabled={!canRemoveMember || (firstMemberLocked && memberIndex === 0)}
                aria-label={`Fjern familiemedlem ${memberIndex + 1}${member.name ? `: ${member.name}` : ""}`}
              >
                Fjern
              </Button>
            </li>
          )
        })}
      </ol>

      <div className={styles.actions}>
        <Button className={buttonClassName} type="button" variant="secondary" onClick={addMember} disabled={disabled || hasReachedMemberLimit}>
          Legg til familiemedlem
        </Button>
        <p id={countId} className={styles.count} aria-live="polite">
          {members.length} av {maxMembers} familiemedlemmer lagt til
        </p>
      </div>
    </fieldset>
  )
}
