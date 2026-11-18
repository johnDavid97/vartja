import { memberInitials } from "@/lib/household-admin-presentation";
import styles from "./identity.module.css";

/** Shared guest-facing identity for household comments and replies. */
export function HouseholdIdentity({ name, administrator = false }: { name: string; administrator?: boolean }) {
  return <span className={styles.identity}>
    <span className={styles.avatar} aria-hidden="true">{memberInitials(name)}</span>
    <strong>{name}</strong>
    {administrator && <span className={styles.badge}>Brudeparet</span>}
  </span>;
}
