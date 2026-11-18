"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Gutter, useAuth, useListDrawerContext, useListQuery } from "@payloadcms/ui"
import type { ListViewClientProps } from "payload"

import AdminList from "@/components/admin/tables/AdminList"
import HouseholdCreateForm from "./HouseholdCreateForm"
import HouseholdInvitationPanel from "./HouseholdInvitationPanel"
import { useHouseholdSummary } from "./useHouseholdSummary"
import { householdListDescription } from "@/lib/household-admin-presentation"

import styles from "./household-workspace.module.css"

function HouseholdOverview({ props }: { props: ListViewClientProps }) {
  const { data } = useListQuery()
  const { summary } = useHouseholdSummary()
  const visible = data?.totalDocs ?? 0

  return (
    <AdminList
      {...props}
      Description={<span className="admin-list__count" aria-live="polite">{householdListDescription(visible, summary)}</span>}
    />
  )
}

export default function HouseholdWorkspace(props: ListViewClientProps) {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { isInDrawer } = useListDrawerContext()
  const requestedTab = searchParams.get("tab")
  const tab = requestedTab === "invitation" || requestedTab === "new" ? requestedTab : "overview"

  // Relationship drawers must retain their original permissions and compact shared list.
  if (isInDrawer) return <AdminList {...props} />

  const listProps = user ? {
    ...props,
    hasCreatePermission: true,
    newDocumentURL: "/admin/collections/households?tab=new",
  } : props

  return (
    <div className={styles.workspace}>
      <Gutter><nav className={styles.tabs} aria-label="Husstander">
        <Link
          href="/admin/collections/households?tab=overview"
          aria-current={tab === "overview" || tab === "new" ? "page" : undefined}
        >
          Oversikt
        </Link>
        <Link
          href="/admin/collections/households?tab=invitation"
          aria-current={tab === "invitation" ? "page" : undefined}
        >
          Felles invitasjon
        </Link>
      </nav></Gutter>

      {tab === "invitation" ? <Gutter><HouseholdInvitationPanel /></Gutter> : null}
      {tab === "new" ? <Gutter><HouseholdCreateForm /></Gutter> : null}
      {tab === "overview" ? <HouseholdOverview props={listProps} /> : null}
    </div>
  )
}
