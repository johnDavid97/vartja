"use client";

import { DefaultListView, useListQuery } from "@payloadcms/ui";
import type { ListViewClientProps } from "payload";
import { AdminTable } from "./AdminTable";

const labels: Record<string, { one: string; many: string; table: string }> = {
  "program-comments": { one: "kommentar", many: "kommentarer", table: "Kommentarer" },
  posts: { one: "innlegg", many: "innlegg", table: "Innlegg" },
  media: { one: "bilde", many: "bilder", table: "Bilder" },
  users: { one: "redaktør", many: "redaktører", table: "Redaktører" },
  households: { one: "husstand", many: "husstander", table: "Husstander og gjester" },
};

/** One list adapter for every visible collection, including relationship drawers.
 * Payload still owns queries, permissions, bulk actions, columns and pagination.
 */
export default function AdminList(props: ListViewClientProps) {
  const { data } = useListQuery();
  const label = labels[props.collectionSlug] ?? { one: "rad", many: "rader", table: "Oversikt" };
  const count = data?.totalDocs ?? 0;
  return (
    <div className="admin-list">
      <DefaultListView
        {...props}
        Description={props.Description ?? <span className="admin-list__count" aria-live="polite">{count} {count === 1 ? label.one : label.many}</span>}
        Table={<AdminTable label={label.table}>{props.Table}</AdminTable>}
        AfterListTable={<>
          {props.AfterListTable}
          {(data?.docs?.length ?? 0) > 0 && <p className="admin-list__hint">Trykk på en rad for å åpne den.</p>}
          {props.collectionSlug === "media" && <p className="admin-list__hint">Bilder deles med godkjente gjester. Forsidebildet er offentlig. Ikke last opp private dokumenter.</p>}
        </>}
      />
    </div>
  );
}
