"use client";

import Link from "next/link";
import { useDocumentInfo } from "@payloadcms/ui";

export default function PostCommentsDescription() {
  const { id } = useDocumentInfo();
  return <div className="wedding-field-hint">
    <p>Gjelder publiserte innlegg for gjester. Publiser endringen for å åpne eller stenge nye kommentarer; eksisterende kommentarer beholdes.</p>
    {id && <p><Link href={`/admin/collections/program-comments?where[source][equals]=post&where[postId][equals]=${encodeURIComponent(String(id))}`}>Se og moderer innleggets kommentarer</Link></p>}
    {id && <p><Link href={`/news/${encodeURIComponent(String(id))}`}>Åpne innlegget for å svare som brudeparet</Link></p>}
  </div>;
}
