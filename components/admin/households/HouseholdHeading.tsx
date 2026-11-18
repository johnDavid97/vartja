"use client";

import { useDocumentInfo, useFormModified } from "@payloadcms/ui";
import { HouseholdStatusBadge } from "./HouseholdStatusBadge";

/** Keep Payload's native save, validation and document controls. */
export default function HouseholdHeading() {
  const { data } = useDocumentInfo();
  const modified = useFormModified();
  return (
    <div className="household-editor-heading">
      <div>
        <h1>Rediger husstand</h1>
        <p>{typeof data?.contactName === "string" ? data.contactName : "Kontaktperson og familiemedlemmer"}</p>
      </div>
      <HouseholdStatusBadge value={modified ? "pending" : data?.status} label={modified ? "Ulagrede endringer" : undefined} live />
    </div>
  );
}
