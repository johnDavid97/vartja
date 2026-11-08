"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useConfig, useField } from "@payloadcms/ui";
import { BlockRemoveButton } from "@payloadcms/richtext-lexical/client";
import { ImagePlus, Settings2 } from "lucide-react";
import type { Media } from "@/payload-types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoBlock() {
  const { config } = useConfig();
  const { value: image, setValue: setImage, disabled } = useField<number | Media | null>({ path: "image" });
  const { value: alt, setValue: setAlt } = useField<string>({ path: "alt" });
  const { value: caption, setValue: setCaption } = useField<string>({ path: "caption" });
  const [preview, setPreview] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const endpoint = `${config.serverURL || ""}${config.routes.api}/media`;
  const imageId = typeof image === "object" ? image?.id : image;

  useEffect(() => {
    if (!imageId) return;
    const controller = new AbortController();
    fetch(`${endpoint}/${imageId}`, { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((doc: Media | null) => { if (!controller.signal.aborted) setPreview(doc); })
      .catch(() => { /* A missing upload leaves a usable replacement button. */ });
    return () => controller.abort();
  }, [endpoint, imageId]);

  async function upload(file: File) {
    if (disabled) return;
    setError("");
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Velg et JPG-, PNG- eller WebP-bilde.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Bildet kan være maks 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const description = alt || file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
      const data = new FormData();
      data.append("file", file);
      data.append("_payload", JSON.stringify({ alt: description }));
      const response = await fetch(endpoint, { method: "POST", credentials: "include", body: data });
      if (!response.ok) throw new Error("Kunne ikke laste opp bildet. Prøv igjen.");
      const { doc }: { doc: Media } = await response.json();
      setPreview(doc);
      setAlt(description);
      setImage(doc.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke laste opp bildet.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="post-photo-block">
      <div className="post-photo-block__actions"><BlockRemoveButton /></div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="post-photo-block__input"
        aria-label="Velg bildefil"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}
      />
      <div className="post-photo-block__media">
      <button
        type="button"
        className={`post-photo-block__picker${preview?.url ? " post-photo-block__picker--filled" : ""}`}
        disabled={uploading || disabled}
        onClick={() => input.current?.click()}
        aria-label={preview?.url ? "Bytt bilde" : "Velg bilde fra datamaskinen"}
      >
        {preview?.url ? (
          <Image src={preview.url} alt={alt || preview.alt} width={preview.width || 1200} height={preview.height || 900} unoptimized />
        ) : (
          <><ImagePlus size={36} aria-hidden="true" /><strong>Klikk for å velge et bilde</strong><span>JPG, PNG eller WebP · maks 10 MB</span></>
        )}
      </button>
      {imageId && (
        <details
          className="post-photo-block__settings"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Bildeinnstillinger" title="Bildeinnstillinger">
            <Settings2 size={20} aria-hidden="true" />
          </summary>
          <div className="post-photo-block__fields">
            <strong>Bildeinnstillinger</strong>
            <label>Beskrivelse for skjermleser<input disabled={disabled || uploading} value={alt || ""} onChange={(event) => setAlt(event.target.value)} /></label>
            <label>Bildetekst (valgfritt)<input disabled={disabled || uploading} value={caption || ""} onChange={(event) => setCaption(event.target.value)} /></label>
          </div>
        </details>
      )}
      </div>
      {uploading && <p role="status">Laster opp bildet…</p>}
      {error && <p role="alert" className="post-photo-block__error">{error}</p>}
    </div>
  );
}
