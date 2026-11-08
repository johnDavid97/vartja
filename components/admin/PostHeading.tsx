"use client";

import { useDocumentInfo, useFormModified } from "@payloadcms/ui";
import { Eye } from "lucide-react";
import { AdminButton } from "./AdminButton";

export default function PostHeading() {
  const { id, data } = useDocumentInfo();
  const modified = useFormModified();
  const published = data?._status === "published";
  const status = !id ? "Utkast – ikke lagret" : modified ? "Ulagrede endringer" : published ? "Publisert" : "Utkast";
  return (
    <>
      <div className="wedding-post-heading">
        <h1>{id ? "Rediger innlegg" : "Nytt innlegg"}</h1>
        <span className={`wedding-status${published && !modified ? " wedding-status--published" : ""}`} role="status">{status}</span>
      </div>
      <AdminButton variant="ghost" size="sm" className="wedding-preview" disabled title="Forhåndsvisning kommer senere">
        <Eye size={19} aria-hidden="true" /><span>Forhåndsvis <small>Kommer</small></span>
      </AdminButton>
    </>
  );
}
