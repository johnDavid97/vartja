import type { ReactNode } from "react";
import { memberInitials } from "@/lib/household-admin-presentation";
import styles from "./identity.module.css";

function guestAvatarTone(name: string): "taupe" | "mauve" {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return hash % 2 === 0 ? "taupe" : "mauve";
}

/** Shared guest-facing identity for household comments and replies. */
export function HouseholdIdentity({ name, administrator = false, children }: { name: string; administrator?: boolean; children?: ReactNode }) {
  return <div className={styles.identity}>
    <span className={styles.avatar} data-tone={administrator ? "administrator" : guestAvatarTone(name)} aria-hidden="true">{memberInitials(name)}</span>
    <div className={styles.content}>
      <span className={styles.heading}>
        <strong>{name}</strong>
        {administrator && <span className={styles.badge}>Brudeparet</span>}
      </span>
      {children}
    </div>
  </div>;
}
