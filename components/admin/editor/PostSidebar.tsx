"use client";

import { useRef } from "react";
import { ImageIcon, GripVertical, ChartNoAxesColumn, Minus } from "lucide-react";
import { getSelectionTarget, insertSidebarBlock } from "./insert-block";
import { POST_BLOCK_MIME, usePostEditor, type InsertTarget } from "./PostEditorProvider";

const blocks = [
  { kind: "photo", label: "Bilde", Icon: ImageIcon },
  { kind: "poll", label: "Avstemning", Icon: ChartNoAxesColumn },
  { kind: "horizontalRule", label: "Skillelinje", Icon: Minus },
] as const;

export function PostSidebar() {
  const { editor } = usePostEditor();
  const clickTarget = useRef<InsertTarget | null>(null);

  return (
    <section className="post-builder" aria-label="Byggeklosser">
      <h2>Byggeklosser</h2>
      <p>Dra en kloss inn i artikkelen. På mobil kan du plassere markøren og trykke på klossen.</p>
      <div className="post-builder__blocks">
        {blocks.map(({ kind, label, Icon }) => (
          <button
            key={kind}
            type="button"
            className="post-builder__block"
            draggable={Boolean(editor?.isEditable())}
            disabled={!editor?.isEditable()}
            onDragStart={(event) => {
              event.dataTransfer.setData(POST_BLOCK_MIME, kind);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onPointerDown={() => { if (editor) clickTarget.current = getSelectionTarget(editor); }}
            onClick={() => {
              if (!editor?.isEditable()) return;
              insertSidebarBlock(editor, kind, clickTarget.current || getSelectionTarget(editor));
              clickTarget.current = null;
            }}
            aria-label={`Legg til ${label.toLowerCase()}`}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            <GripVertical size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function PostInteractionNotice() {
  return (
    <p className="post-builder__notice">
      Kommentarer og likerklikk kommer senere. De vil alltid vises under artikkelen, ikke som flyttbare klosser.
    </p>
  );
}
