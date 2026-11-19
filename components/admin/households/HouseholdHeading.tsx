"use client";

import { useDocumentInfo, useFormFields, useFormModified } from "@payloadcms/ui";
import { deriveHouseholdStatus } from "@/features/households/domain/member-policy";
import type { MemberStatus } from "@/features/households/domain/models";
import { HouseholdStatusBadge } from "./HouseholdStatusBadge";
import { memberFieldsSignature, membersFromSignature } from "./householdFormPresentation";

function savedMemberStatuses(data: Record<string, unknown> | undefined): { status: MemberStatus }[] {
  if (!Array.isArray(data?.members)) return [];
  return data.members.flatMap((member) => {
    if (!member || typeof member !== "object") return [];
    const status = (member as { status?: unknown }).status;
    return status === "pending" || status === "approved" || status === "revoked" ? [{ status }] : [];
  });
}

/** Keep Payload's native save, validation and document controls. */
export default function HouseholdHeading() {
  const { data } = useDocumentInfo();
  const modified = useFormModified();
  const liveDisplayName = useFormFields(([fields]) => fields.displayName?.value);
  const memberSignature = useFormFields(([fields]) => memberFieldsSignature(fields));
  const liveMembers = membersFromSignature(memberSignature);
  const members = liveMembers.length > 0 ? liveMembers : savedMemberStatuses(data);
  const status = members.length > 0 ? deriveHouseholdStatus(members) : "pending";
  const heading = typeof liveDisplayName === "string" && liveDisplayName.trim()
    ? liveDisplayName
    : typeof data?.displayName === "string" && data.displayName.trim()
      ? data.displayName
      : typeof data?.contactName === "string" ? data.contactName : "Rediger husstand";

  return (
    <div className="household-editor-heading">
      <h1>{heading}</h1>
      <HouseholdStatusBadge value={status} live />
      {modified ? <span className="household-editor-heading__modified" role="status">Ikke lagret</span> : null}
    </div>
  );
}
