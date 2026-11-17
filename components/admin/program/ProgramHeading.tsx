"use client";

import { useDocumentInfo, useFormModified } from "@payloadcms/ui";
import { Eye } from "lucide-react";
import { AdminButton } from "../AdminButton";

export default function ProgramHeading() {
  const { data, hasPublishedDoc } = useDocumentInfo();
  const modified = useFormModified();
  const published = data?._status === "published" && !modified;
  return <>
    <div className="wedding-post-heading program-heading"><h1>Program</h1><span role="status" className={`wedding-status${published ? " wedding-status--published" : ""}`}>{modified ? "Ulagrede endringer" : published ? "Publisert" : hasPublishedDoc ? "Upubliserte endringer" : "Utkast"}</span></div>
    <AdminButton variant="ghost" size="sm" className="wedding-preview" disabled title="Forhåndsvisning kommer senere"><Eye size={19} /><span>Forhåndsvis <small>Kommer</small></span></AdminButton>
  </>;
}
