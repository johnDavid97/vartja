"use client"

import { DefaultCell, useListDrawerContext } from "@payloadcms/ui"
import type { DefaultCellComponentProps } from "payload"

import { PublicationCell } from "@/components/admin/tables/Cells"
import { householdMemberPresentation, householdStatus } from "@/lib/household-admin-presentation"

import styles from "./household-workspace.module.css"

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function HouseholdContactCell(props: DefaultCellComponentProps) {
  const row = record(props.rowData)
  const email = row && typeof row.email === "string" ? row.email : null
  const { isInDrawer, onSelect } = useListDrawerContext()
  const drawerProps = isInDrawer && props.link && onSelect && row && (typeof row.id === "string" || typeof row.id === "number") ? {
    link: false,
    onClick: () => onSelect({ collectionSlug: props.collectionSlug, doc: props.rowData, docID: String(row.id) }),
  } : {}

  return (
    <div className="admin-table-title">
      <DefaultCell {...props} {...drawerProps} />
      {email ? <span className="admin-table-title__description">{email}</span> : null}
    </div>
  )
}

export function HouseholdMembersCell({ cellData }: DefaultCellComponentProps) {
  const members = householdMemberPresentation(cellData)
  if (members.count === 0) return <span>—</span>

  return (
    <div className={styles.members} aria-label={`${members.count} ${members.count === 1 ? "person" : "personer"}`}>
      <span className={styles.avatars} aria-hidden="true">
        {members.initials.map((initials, index) => (
          <span className={styles.avatar} key={`${initials}-${index}`}>{initials}</span>
        ))}
      </span>
      <span>{members.count} {members.count === 1 ? "person" : "personer"}</span>
    </div>
  )
}

export function HouseholdStatusCell({ cellData }: DefaultCellComponentProps) {
  const status = householdStatus(cellData)
  return <span className={`${styles.status} ${styles[`status_${status.tone}`]}`}>{status.label}</span>
}

export { PublicationCell as HouseholdDateCell }
