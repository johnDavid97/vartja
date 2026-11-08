"use client";

import type { MouseEvent, ReactNode } from "react";

/** Keep Payload's semantic table, sorting and selection; share the frame and row interaction. */
export function AdminTable({ children, label }: { children: ReactNode; label: string }) {
  function openRow(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest("a, button, input, label, select, textarea, [role='button']")) return;
    if (window.getSelection()?.toString()) return;
    const row = target.closest("tbody tr");
    // Clicking a link/button remains the keyboard-accessible way to open/select a row.
    const action = row?.querySelector<HTMLAnchorElement | HTMLButtonElement>("a[href], button.default-cell__first-cell, .admin-table-title > button");
    action?.click();
  }
  return (
    <div className="admin-table" role="region" aria-label={label} tabIndex={0} onClick={openRow}>
      {children}
    </div>
  );
}
