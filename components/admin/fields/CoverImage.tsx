"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FieldError, useConfig, useField, useForm, useListDrawer } from "@payloadcms/ui";
import { ImageIcon, X } from "lucide-react";
import type { UploadFieldClientComponent } from "payload";
import type { Media } from "@/payload-types";

export const CoverImage: UploadFieldClientComponent = ({ path, readOnly, field }) => {
  const { config } = useConfig();
  const { setProcessing } = useForm();
  const { value, setValue, disabled } = useField<number | Media | null>({ path });
  const [preview, setPreview] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const locked = readOnly || field.admin?.readOnly || disabled;
  const endpoint = `${config.serverURL || ""}${config.routes.api}/media`;
  const imageId = typeof value === "object" ? value?.id : value;
  const image = imageId && preview?.id === imageId ? preview : null;
  const [ListDrawer, , { openDrawer, closeDrawer }] = useListDrawer({ collectionSlugs: ["media"] });

  useEffect(() => {
    if (!imageId) return;
    const controller = new AbortController();
    fetch(`${endpoint}/${imageId}`, { signal: controller.signal, credentials: "include" })
      .then(async (response) => { if (!response.ok) throw new Error("Kunne ikke hente bildet. Velg et annet bilde eller prøv igjen."); return response.json() as Promise<Media>; })
      .then(setPreview)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [endpoint, imageId]);

  async function upload(file: File) {
    if (locked || busy.current) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Velg et JPG-, PNG- eller WebP-bilde."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Bildet kan være maks 10 MB."); return; }
    busy.current = true;
    setUploading(true);
    setProcessing(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("_payload", JSON.stringify({ alt: file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ") }));
      const response = await fetch(endpoint, { method: "POST", credentials: "include", body: data });
      if (!response.ok) throw new Error("Kunne ikke laste opp bildet. Prøv igjen.");
      const { doc }: { doc: Media } = await response.json();
      setPreview(doc);
      setValue(doc.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke laste opp bildet.");
    } finally {
      busy.current = false;
      setUploading(false);
      setProcessing(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="field-type wedding-cover" role="group" aria-label="Forsidebilde">
      <div className="wedding-cover__label">Forsidebilde <span>(valgfritt)</span></div>
      <FieldError path={path} />
      <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Velg forsidebilde" disabled={locked || uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <div className={`wedding-cover__dropzone${image ? " wedding-cover__dropzone--filled" : ""}`} onDragOver={(event) => { if (!locked && !uploading) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void upload(file); }}>
        {image?.url ? <Image src={image.url} alt={image.alt} width={image.width || 800} height={image.height || 400} unoptimized className="wedding-cover__preview" /> : <span className="wedding-cover__icon"><ImageIcon size={26} aria-hidden="true" /></span>}
        <div className="wedding-cover__copy"><strong>{uploading ? "Laster opp …" : imageId ? image?.filename || "Henter bilde …" : "Dra et bilde hit"}</strong><small>JPG, PNG eller WebP. Maks 10 MB.</small></div>
        <button type="button" className="wedding-button wedding-button--secondary" disabled={locked || uploading} onClick={() => input.current?.click()}>{imageId ? "Bytt bilde" : "Last opp bilde"}</button>
        <button type="button" className="wedding-cover__library" disabled={locked || uploading} onClick={() => openDrawer()}>Velg fra biblioteket</button>
        {imageId && <button type="button" className="wedding-icon-button" aria-label="Fjern forsidebilde" disabled={locked || uploading} onClick={() => { setValue(null); setPreview(null); setError(""); }}><X size={18} /></button>}
      </div>
      {error && <p className="wedding-field-error" role="alert">{error}</p>}
      <ListDrawer onSelect={({ doc }) => { if (!locked && !uploading) { setPreview(doc as Media); setValue(doc.id); setError(""); } closeDrawer(); }} />
    </div>
  );
};
