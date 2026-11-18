"use client"

import { DefaultCell, useListDrawerContext } from "@payloadcms/ui"
import type { DefaultCellComponentProps } from "payload"

import { PublicationCell } from "@/components/admin/tables/Cells"
import { householdMemberPresentation } from "@/lib/household-admin-presentation"
import { HouseholdStatusBadge } from "./HouseholdStatusBadge"

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
  return <HouseholdStatusBadge value={cellData} />
}

export { PublicationCell as HouseholdDateCell }
