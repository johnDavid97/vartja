"use client";

import type { ReactNode } from "react";
import { ChartNoAxesColumn, Settings2, X } from "lucide-react";
import { AdminButton, adminButtonStyles } from "../AdminButton";

/** Shared presentation; each adapter retains its native form state and validation. */
export function PollEditorFrame({ children, settings, open, editable, onRemove, hint }: {
  children: ReactNode; settings: ReactNode; open: boolean; editable: boolean; onRemove: () => void; hint: string;
}) {
  return <div className="post-poll-block">
    <div className="post-poll-block__header">
      <strong><span className="post-poll-block__icon"><ChartNoAxesColumn size={22} aria-hidden="true" /></span> Avstemning</strong>
      <AdminButton variant="ghost" size="icon-sm" aria-label="Fjern avstemning" disabled={!editable} onClick={onRemove}><X size={20} aria-hidden="true" /></AdminButton>
    </div>
    {children}
    <details className="post-poll-block__settings" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary className={adminButtonStyles({ variant: "ghost", size: "sm" })}><Settings2 size={16} aria-hidden="true" /> Avstemningsinnstillinger{!open ? " · Avsluttet" : ""}</summary>
      {settings}
      <p className="post-poll-block__hint">{hint}</p>
    </details>
  </div>;
}
